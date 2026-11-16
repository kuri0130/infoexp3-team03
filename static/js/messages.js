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
    getSavedName,
    getVoterId,
    initCharCounters,
    saveName,
    setStatus,
    updateCharCount
} from './utils.js';

function renderMessage(message, imagesByMessage, replies = null) {
    const isReply = replies === null;
    return `
        <article class="message${isReply ? ' reply' : ''}" data-message-id="${message.id}">
            <b>${isReply ? '<span class="reply-mark">↳</span> ' : ''}${escapeHtml(message.name)}</b>
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
                ${isReply ? '' : `<button type="button" class="reply-button">💬 返信${replies.length ? ` (${replies.length})` : ''}</button>`}
            </div>
            ${isReply ? '' : `<div class="replies">${replies.map(r => renderMessage(r, imagesByMessage)).join('')}</div>`}
        </article>
    `;
}

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

    // 返信（parent_id あり）を親投稿ごとにまとめる。スレッド内は昇順のためそのまま追加で古い順になる
    const repliesByParent = {};
    for (const m of messages) {
        if (m.parent_id != null) (repliesByParent[m.parent_id] ||= []).push(m);
    }
    const topLevel = messages.filter(m => m.parent_id == null);

    if (!topLevel.length) {
        document.querySelector('#messages').innerHTML =
            '<p class="empty-state">このスレッドにはまだ投稿がありません。最初の投稿を書いてみましょう！</p>';
        return;
    }

    document.querySelector('#messages').innerHTML = topLevel
        .map(message => renderMessage(message, imagesByMessage, repliesByParent[message.id] || []))
        .join('');
}

function openReplyForm(messageElement) {
    const repliesBox = messageElement.querySelector(':scope > .replies');
    const existing = repliesBox.querySelector(':scope > .reply-form');
    if (existing) {
        existing.querySelector('textarea').focus();
        return;
    }
    const form = document.createElement('form');
    form.className = 'reply-form';
    form.innerHTML = `
        <input class="reply-name" maxlength="30" placeholder="ニックネーム（任意）">
        <textarea class="reply-message" maxlength="300" placeholder="返信を書く..." required></textarea>
        <div class="char-count reply-count" aria-live="polite">0 / 300</div>
        <div class="edit-actions">
            <button type="submit">返信する</button>
            <button type="button" class="cancel-reply">キャンセル</button>
        </div>
    `;
    // 投稿フォームに入力中の名前、なければ前回使った名前を入れておく
    form.querySelector('.reply-name').value =
        document.querySelector('#name').value || getSavedName();
    const textarea = form.querySelector('textarea');
    textarea.addEventListener('input', () => {
        const counter = form.querySelector('.reply-count');
        counter.textContent = `${textarea.value.length} / ${textarea.maxLength}`;
        counter.classList.toggle('near-limit', textarea.value.length >= textarea.maxLength * 0.9);
    });
    repliesBox.append(form);
    (form.querySelector('.reply-name').value ? textarea : form.querySelector('.reply-name')).focus();
}

async function sendReply(form, onMessagesChanged) {
    const parentId = Number(form.closest('.message').dataset.messageId);
    const name = form.querySelector('.reply-name').value;
    const message = form.querySelector('.reply-message').value;
    const r = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name,
            message,
            parent_id: parentId,
            thread_id: getCurrentThreadId(),
            author_id: getVoterId()
        })
    });
    if (!r.ok) {
        throw new Error('返信に失敗しました');
    }
    saveName(name);
    await onMessagesChanged();
    setStatus('返信しました');
}

function startEditing(messageElement) {
    const text = messageElement.querySelector(':scope > .message-text').textContent;
    const form = document.createElement('form');
    form.className = 'edit-form';
    form.innerHTML = `
        <textarea maxlength="300" required>${escapeHtml(text)}</textarea>
        <div class="edit-actions">
            <button type="submit">保存</button>
            <button type="button" class="cancel-edit">キャンセル</button>
        </div>
    `;

    messageElement.querySelector(':scope > .message-text').replaceWith(form);
    form.querySelector('textarea').focus();
}

async function updateMessage(messageElement) {
    const messageId = messageElement.dataset.messageId;
    const message = messageElement.querySelector(':scope > .edit-form textarea').value;
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
    const hasReplies = document.querySelector(`.message[data-message-id="${messageId}"] .replies .message`);
    if (!window.confirm(hasReplies ? 'この投稿と返信をすべて削除しますか？' : 'この投稿を削除しますか？')) {
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

        if (button.classList.contains('reply-button')) {
            openReplyForm(message);
            return;
        }

        if (button.classList.contains('cancel-reply')) {
            button.closest('.reply-form').remove();
            return;
        }

        if (button.classList.contains('cancel-edit')) {
            await loadMessages();
        }
    });

    messagesContainer.addEventListener('submit', async event => {
        if (event.target.classList.contains('reply-form')) {
            event.preventDefault();
            const submit = event.target.querySelector('button[type="submit"]');
            submit.disabled = true; // 二重送信防止
            try {
                await sendReply(event.target, onMessagesChanged);
            } catch (error) {
                setStatus(error.message);
                submit.disabled = false;
            }
            return;
        }

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
            saveName(nameInput.value);
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
