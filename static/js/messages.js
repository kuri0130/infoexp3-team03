import {
    clearSelectedImages,
    hasSelectedImages,
    renderImages,
    uploadSelectedImages
} from './images.js';
import { getCurrentThreadId } from './state.js';
import {
    escapeHtml,
    formatDateTime,
    getVoterId,
    initCharCounters,
    setStatus,
    updateCharCount
} from './utils.js';

export async function loadMessages() {
    const currentThreadId = getCurrentThreadId();
    if (currentThreadId === null) {
        document.querySelector('#messages').innerHTML =
            '<p class="empty-state">スレッドが選択されていません。</p>';
        return;
    }

    const voterId = getVoterId();
    const [r, ri] = await Promise.all([
        fetch(`/api/messages?voter_id=${encodeURIComponent(voterId)}&author_id=${encodeURIComponent(voterId)}&thread_id=${currentThreadId}`),
        fetch('/api/images')
    ]);
    if (!r.ok) {
        throw new Error('投稿の読み込みに失敗しました');
    }

    const messages = await r.json();
    const images = ri.ok ? await ri.json() : [];
    // 投稿IDごとに画像をまとめる
    const imagesByMessage = {};
    for (const img of images) (imagesByMessage[img.message_id] ||= []).push(img);

    if (!messages.length) {
        document.querySelector('#messages').innerHTML =
            '<p class="empty-state">このスレッドにはまだ投稿がありません。最初の投稿を書いてみましょう！</p>';
        return;
    }

    document.querySelector('#messages').innerHTML = messages.map(message => `
        <article class="message" data-message-id="${message.id}">
            <b>${escapeHtml(message.name)}</b>
            <p class="message-text">${escapeHtml(message.message)}</p>
            ${renderImages(imagesByMessage[message.id] || [])}
            <div class="meta">
                <span>#${message.id} ・ ${formatDateTime(message.created_at)}${message.edited_at ? ` ・ 編集済み (${formatDateTime(message.edited_at)})` : ''}</span>
                ${message.is_owner ? `
                <div class="message-actions">
                    <button type="button" class="edit-button">編集</button>
                    <button type="button" class="delete-button">削除</button>
                </div>` : ''}
            </div>
            <div class="message-actions">
                <div class="vote-actions" aria-label="投稿を評価">
                    <button class="vote-button" type="button" data-vote="good"
                        aria-pressed="${message.my_vote === 'good'}"
                        aria-label="Good ${message.good_count}">
                        <span aria-hidden="true">👍</span>
                        <span class="vote-count">${message.good_count}</span>
                    </button>
                    <button class="vote-button" type="button" data-vote="bad"
                        aria-pressed="${message.my_vote === 'bad'}"
                        aria-label="Bad ${message.bad_count}">
                        <span aria-hidden="true">👎</span>
                        <span class="vote-count">${message.bad_count}</span>
                    </button>
                </div>
            </div>
        </article>
    `).join('');
}

function startEditing(messageElement) {
    const text = messageElement.querySelector('.message-text').textContent;
    const form = document.createElement('form');
    form.className = 'edit-form';
    form.innerHTML = `
        <textarea maxlength="300" required>${escapeHtml(text)}</textarea>
        <div class="edit-actions">
            <button type="submit">保存</button>
            <button type="button" class="cancel-edit">キャンセル</button>
        </div>
    `;

    messageElement.querySelector('.message-text').replaceWith(form);
    form.querySelector('textarea').focus();
}

async function updateMessage(messageElement) {
    const messageId = messageElement.dataset.messageId;
    const message = messageElement.querySelector('textarea').value;
    const r = await fetch(`/api/messages/${messageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, author_id: getVoterId() })
    });

    if (!r.ok) {
        throw new Error(r.status === 403 ? '自分の投稿以外は編集できません' : '投稿の編集に失敗しました');
    }

    await loadMessages();
    setStatus('投稿を編集しました');
}

async function deleteMessage(messageId, onMessagesChanged) {
    if (!window.confirm('この投稿を削除しますか？')) {
        return;
    }

    const r = await fetch(`/api/messages/${messageId}?author_id=${encodeURIComponent(getVoterId())}`, {
        method: 'DELETE'
    });
    if (!r.ok) {
        throw new Error(r.status === 403 ? '自分の投稿以外は削除できません' : '投稿の削除に失敗しました');
    }

    await onMessagesChanged();
    setStatus('投稿を削除しました');
}

export function initMessages({ onMessagesChanged }) {
    const postForm = document.querySelector('#form');
    initCharCounters(postForm.querySelectorAll('#name, #message'));

    const messagesContainer = document.querySelector('#messages');

    messagesContainer.addEventListener('click', async event => {
        const button = event.target.closest('button');
        if (!button) return; // 画像リンクのクリックはそのまま画像を開く
        const message = button.closest('.message');
        if (!message) return;

        if (button.classList.contains('edit-button')) {
            startEditing(message);
            return;
        }

        if (button.classList.contains('delete-button')) {
            try {
                await deleteMessage(message.dataset.messageId, onMessagesChanged);
            } catch (error) {
                setStatus(error.message);
            }
            return;
        }

        if (button.classList.contains('cancel-edit')) {
            await loadMessages();
        }
    });

    messagesContainer.addEventListener('submit', async event => {
        if (!event.target.classList.contains('edit-form')) return;
        event.preventDefault();
        event.stopPropagation();

        try {
            await updateMessage(event.target.closest('.message'));
        } catch (error) {
            setStatus(error.message);
        }
    });

    postForm.addEventListener('submit', async event => {
        event.preventDefault();

        const currentThreadId = getCurrentThreadId();
        if (currentThreadId === null) {
            setStatus('先にスレッドを立ててください');
            return;
        }

        const nameInput = document.querySelector('#name');
        const messageInput = document.querySelector('#message');
        const r = await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                thread_id: currentThreadId,
                name: nameInput.value,
                message: messageInput.value,
                author_id: getVoterId()
            })
        });

        setStatus(r.ok ? '投稿しました' : '投稿に失敗しました');

        if (r.ok) {
            // 画像があれば、作成された投稿IDに対してアップロードする
            if (hasSelectedImages()) {
                const created = await r.json();
                const uploaded = await uploadSelectedImages(created.id);
                if (!uploaded) {
                    setStatus('投稿しましたが、画像のアップロードに失敗しました');
                }
            }
            clearSelectedImages();
            nameInput.value = '';
            messageInput.value = '';
            updateCharCount(nameInput);
            updateCharCount(messageInput);
            await onMessagesChanged();
        }
    });
}
