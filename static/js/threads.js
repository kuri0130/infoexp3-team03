import {
    getCurrentThread,
    getCurrentThreadId,
    getThreads,
    setCurrentThreadId,
    setThreads
} from './state.js';
import {
    escapeHtml,
    formatDateTime,
    getVoterId,
    initCharCounters,
    setStatus,
    updateCharCount
} from './utils.js';

export function updateThreadContextUI() {
    const current = getCurrentThread();
    const badge = document.querySelector('#current-thread-badge');
    const heading = document.querySelector('#messages-heading');
    const postButton = document.querySelector('#form button[type="submit"]');

    if (current) {
        badge.textContent = `投稿先スレッド: ${current.title}`;
        heading.textContent = `📋 ${current.title}`;
        postButton.disabled = false;
    } else {
        badge.textContent = 'スレッドを選択するか、新しくスレッドを立ててください';
        heading.textContent = '📋 みんなの投稿';
        postButton.disabled = true;
    }
}

export function renderThreads() {
    const list = document.querySelector('#threads');
    const threads = getThreads();
    const currentThreadId = getCurrentThreadId();

    if (!threads.length) {
        list.innerHTML = '<p class="empty-state">スレッドがまだありません。「＋ スレッドを立てる」から作成できます。</p>';
        updateThreadContextUI();
        return;
    }

    list.innerHTML = threads.map(thread => `
        <div class="thread-item${thread.id === currentThreadId ? ' active' : ''}"
             data-thread-id="${thread.id}" tabindex="0" role="button"
             aria-pressed="${thread.id === currentThreadId}">
            <div class="thread-item-main">
                <div class="thread-title">${escapeHtml(thread.title)}</div>
                <div class="thread-meta">
                    <span>作成: ${escapeHtml(thread.name)}</span>
                    <span>投稿数: ${thread.message_count}件</span>
                    <span>更新: ${formatDateTime(thread.last_posted_at || thread.created_at)}</span>
                </div>
            </div>
            ${thread.is_owner ? '<button type="button" class="delete-thread-button" aria-label="スレッドを削除">削除</button>' : ''}
        </div>
    `).join('');

    updateThreadContextUI();
}

export async function loadThreads() {
    const r = await fetch(`/api/threads?author_id=${encodeURIComponent(getVoterId())}`);
    if (!r.ok) {
        throw new Error('スレッドの読み込みに失敗しました');
    }
    setThreads(await r.json());
    renderThreads();
}

async function deleteThread(threadId, onThreadChange) {
    if (!window.confirm('このスレッドと中の投稿をすべて削除しますか？')) {
        return;
    }

    const r = await fetch(`/api/threads/${threadId}?author_id=${encodeURIComponent(getVoterId())}`, {
        method: 'DELETE'
    });
    if (!r.ok) {
        throw new Error(r.status === 403 ? '自分が立てたスレッド以外は削除できません' : 'スレッドの削除に失敗しました');
    }

    if (getCurrentThreadId() === threadId) {
        setCurrentThreadId(null);
    }
    await loadThreads();
    await onThreadChange();
    setStatus('スレッドを削除しました');
}

async function selectThread(threadId, onThreadChange) {
    if (getCurrentThreadId() === threadId) return;
    setCurrentThreadId(threadId);
    renderThreads();
    await onThreadChange();
}

export function initThreads({ onThreadChange }) {
    const threadForm = document.querySelector('#thread-form');
    const threadInputs = threadForm.querySelectorAll('#thread-title, #thread-name, #thread-message');
    initCharCounters(threadInputs);

    document.querySelector('#toggle-thread-form').addEventListener('click', () => {
        threadForm.hidden = !threadForm.hidden;
        if (!threadForm.hidden) {
            document.querySelector('#thread-title').focus();
        }
    });

    document.querySelector('#cancel-thread-form').addEventListener('click', () => {
        threadForm.reset();
        threadInputs.forEach(updateCharCount);
        threadForm.hidden = true;
    });

    threadForm.addEventListener('submit', async event => {
        event.preventDefault();

        const titleInput = document.querySelector('#thread-title');
        const nameInput = document.querySelector('#thread-name');
        const messageInput = document.querySelector('#thread-message');

        const r = await fetch('/api/threads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: titleInput.value,
                name: nameInput.value,
                message: messageInput.value,
                author_id: getVoterId()
            })
        });

        if (!r.ok) {
            setStatus('スレッドの作成に失敗しました');
            return;
        }

        const created = await r.json();
        setCurrentThreadId(created.id);
        threadForm.reset();
        threadInputs.forEach(updateCharCount);
        threadForm.hidden = true;

        await loadThreads();
        await onThreadChange();
        setStatus('スレッドを立てました');
    });

    const threadsContainer = document.querySelector('#threads');

    threadsContainer.addEventListener('click', async event => {
        const item = event.target.closest('.thread-item');
        if (!item) return;
        const threadId = Number(item.dataset.threadId);

        if (event.target.closest('.delete-thread-button')) {
            event.stopPropagation();
            try {
                await deleteThread(threadId, onThreadChange);
            } catch (error) {
                setStatus(error.message);
            }
            return;
        }

        try {
            await selectThread(threadId, onThreadChange);
        } catch (error) {
            setStatus(error.message);
        }
    });

    threadsContainer.addEventListener('keydown', async event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        if (event.target.closest('.delete-thread-button')) return;
        const item = event.target.closest('.thread-item');
        if (!item) return;
        event.preventDefault();
        try {
            await selectThread(Number(item.dataset.threadId), onThreadChange);
        } catch (error) {
            setStatus(error.message);
        }
    });
}
