const VOTER_ID_KEY = 'miniboard-voter-id';

function getVoterId() {
    let voterId = localStorage.getItem(VOTER_ID_KEY);
    if (!voterId) {
        voterId = crypto.randomUUID();
        localStorage.setItem(VOTER_ID_KEY, voterId);
    }
    return voterId;
}

async function loadMessages() {
    const voterId = getVoterId();
    const [r, ri] = await Promise.all([
        fetch(`/api/messages?voter_id=${encodeURIComponent(voterId)}`),
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

    // 返信（parent_id あり）を親投稿ごとにまとめる。返信は古い順に表示
    const repliesByParent = {};
    for (const m of messages) {
        if (m.parent_id != null) (repliesByParent[m.parent_id] ||= []).unshift(m);
    }
    const topLevel = messages.filter(m => m.parent_id == null);

    document.querySelector('#messages').innerHTML = topLevel
        .map(message => renderMessage(message, imagesByMessage, repliesByParent[message.id] || []))
        .join('');
}

function renderMessage(message, imagesByMessage, replies = null) {
    const isReply = replies === null;
    return `
        <article class="message${isReply ? ' reply' : ''}" data-message-id="${message.id}">
            <b>${isReply ? '<span class="reply-mark">↳</span> ' : ''}${escapeHtml(message.name)}</b>
            <p class="message-text">${escapeHtml(message.message)}</p>
            ${renderImages(imagesByMessage[message.id] || [])}
            <div class="meta">
                <span>#${message.id}${message.edited_at ? ' ・ 編集済み' : ''}</span>
                <div class="message-actions">
                    <button type="button" class="edit-button">編集</button>
                    <button type="button" class="delete-button">削除</button>
                </div>
            </div>
            <div class="message-actions">
                <div class="vote-actions" aria-label="投稿を評価">
                    <button class="vote-button" type="button" data-vote="good"
                        aria-pressed="${message.my_vote === 'good'}">
                        Good <span class="vote-count">${message.good_count}</span>
                    </button>
                    <button class="vote-button" type="button" data-vote="bad"
                        aria-pressed="${message.my_vote === 'bad'}">
                        Bad <span class="vote-count">${message.bad_count}</span>
                    </button>
                </div>
                ${isReply ? '' : `<button type="button" class="reply-button">💬 返信${replies.length ? ` (${replies.length})` : ''}</button>`}
            </div>
            ${isReply ? '' : `<div class="replies">${replies.map(r => renderMessage(r, imagesByMessage)).join('')}</div>`}
        </article>
    `;
}

// ---- 返信 ----
const NAME_KEY = 'miniboard-name'; // 最後に使ったニックネーム

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
        <input class="reply-name" maxlength="30" placeholder="ニックネーム" required>
        <textarea class="reply-message" maxlength="300" placeholder="返信を書く..." required></textarea>
        <div class="char-count reply-count" aria-live="polite">0 / 300</div>
        <div class="edit-actions">
            <button type="submit">返信する</button>
            <button type="button" class="cancel-reply">キャンセル</button>
        </div>
    `;
    // 投稿フォームに入力中の名前、なければ前回使った名前を入れておく
    form.querySelector('.reply-name').value =
        document.querySelector('#name').value || localStorage.getItem(NAME_KEY) || '';
    const textarea = form.querySelector('textarea');
    textarea.addEventListener('input', () => {
        const counter = form.querySelector('.reply-count');
        counter.textContent = `${textarea.value.length} / ${textarea.maxLength}`;
        counter.classList.toggle('near-limit', textarea.value.length >= textarea.maxLength * 0.9);
    });
    repliesBox.append(form);
    (form.querySelector('.reply-name').value ? textarea : form.querySelector('.reply-name')).focus();
}

async function sendReply(form) {
    const parentId = Number(form.closest('.message').dataset.messageId);
    const name = form.querySelector('.reply-name').value;
    const message = form.querySelector('.reply-message').value;
    const r = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, message, parent_id: parentId })
    });
    if (!r.ok) {
        throw new Error('返信に失敗しました');
    }
    localStorage.setItem(NAME_KEY, name.trim());
    await loadMessages();
    document.querySelector('#status').textContent = '返信しました';
}

// ---- 画像添付 ----
const MAX_IMAGES = 2;
let selectedImages = [];

function renderImages(imgs) {
    if (!imgs.length) return '';
    return `<div class="message-images">${imgs.map(img => `<a href="${escapeHtml(img.url)}" target="_blank" rel="noopener"><img src="${escapeHtml(img.url)}" alt="添付画像" loading="lazy"></a>`).join('')}</div>`;
}

function renderSelectedImages() {
    const box = document.querySelector('#image-previews');
    box.querySelectorAll('img').forEach(img => URL.revokeObjectURL(img.src));
    box.innerHTML = selectedImages.map((file, i) => `<div class="preview"><img src="${URL.createObjectURL(file)}" alt=""><button type="button" class="remove-image" data-index="${i}" aria-label="画像を外す">×</button></div>`).join('');
    const count = document.querySelector('.image-count');
    count.textContent = `${selectedImages.length} / ${MAX_IMAGES}枚`;
    count.classList.toggle('near-limit', selectedImages.length >= MAX_IMAGES);
}

document.querySelector('#images').addEventListener('change', event => {
    const picked = [...event.target.files];
    const room = MAX_IMAGES - selectedImages.length;
    if (picked.length > room) {
        document.querySelector('#status').textContent = `画像は${MAX_IMAGES}枚までです`;
    }
    selectedImages = selectedImages.concat(picked.slice(0, Math.max(room, 0)));
    event.target.value = ''; // 同じファイルを選び直せるようにリセット
    renderSelectedImages();
});

document.querySelector('#image-previews').addEventListener('click', event => {
    const button = event.target.closest('.remove-image');
    if (!button) return;
    selectedImages.splice(Number(button.dataset.index), 1);
    renderSelectedImages();
});

function escapeHtml(value) {
    const element = document.createElement('div');
    element.textContent = value;
    return element.innerHTML;
}

async function deleteMessage(messageId) {
    const hasReplies = document.querySelector(`.message[data-message-id="${messageId}"] .replies .message`);
    if (!window.confirm(hasReplies ? 'この投稿と返信をすべて削除しますか？' : 'この投稿を削除しますか？')) {
        return;
    }

    const r = await fetch(`/api/messages/${messageId}`, { method: 'DELETE' });
    if (!r.ok) {
        throw new Error('投稿の削除に失敗しました');
    }

    await loadMessages();
    document.querySelector('#status').textContent = '投稿を削除しました';
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
        body: JSON.stringify({ message })
    });

    if (!r.ok) {
        throw new Error('投稿の編集に失敗しました');
    }

    await loadMessages();
    document.querySelector('#status').textContent = '投稿を編集しました';
}

async function voteMessage(messageId, vote) {
    const response = await fetch(`/api/messages/${messageId}/votes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voter_id: getVoterId(), vote })
    });
    if (!response.ok) {
        throw new Error('評価の送信に失敗しました');
    }

    const result = await response.json();
    const article = document.querySelector(`.message[data-message-id="${messageId}"]`);
    const votes = article.querySelector(':scope > .message-actions .vote-actions');
    votes.querySelector('[data-vote="good"] .vote-count').textContent = result.good_count;
    votes.querySelector('[data-vote="bad"] .vote-count').textContent = result.bad_count;
    votes.querySelectorAll('.vote-button').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.vote === result.my_vote));
    });
    document.querySelector('#status').textContent = '評価を更新しました';
}

function updateCharCount(input) {
    const counter = document.querySelector(`.char-count[data-for="${input.id}"]`);
    if (!counter) return;

    const max = input.maxLength;
    const length = input.value.length;
    counter.textContent = `${length} / ${max}`;
    counter.classList.toggle('near-limit', length >= max * 0.9);
}

document.querySelector('#messages').addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button) return; // 画像リンクのクリックはそのまま画像を開く
    const message = button.closest('.message');
    if (!message) return;

    if (event.target.closest('.edit-button')) {
        event.stopPropagation();
        startEditing(message);
        return;
    }

    if (event.target.closest('.vote-button')) {
        event.stopPropagation();
        try {
            await voteMessage(message.dataset.messageId, button.dataset.vote);
        } catch (error) {
            document.querySelector('#status').textContent = error.message;
        }
        return;
    }

    if (event.target.closest('.delete-button')) {
        event.stopPropagation();
        try {
            await deleteMessage(message.dataset.messageId);
        } catch (error) {
            document.querySelector('#status').textContent = error.message;
        }
        return;
    }

    if (event.target.closest('.reply-button')) {
        event.stopPropagation();
        openReplyForm(message);
        return;
    }

    if (event.target.closest('.cancel-reply')) {
        event.stopPropagation();
        button.closest('.reply-form').remove();
        return;
    }

    if (event.target.closest('.cancel-edit')) {
        event.stopPropagation();
        await loadMessages();
        return;
    }
});

document.querySelector('#messages').addEventListener('submit', async event => {
    if (event.target.classList.contains('reply-form')) {
        event.preventDefault();
        const submit = event.target.querySelector('button[type="submit"]');
        submit.disabled = true; // 二重送信防止
        try {
            await sendReply(event.target);
        } catch (error) {
            document.querySelector('#status').textContent = error.message;
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
        document.querySelector('#status').textContent = error.message;
    }
});

document.querySelectorAll('#name, #message').forEach(input => {
    input.addEventListener('input', () => updateCharCount(input));
    updateCharCount(input);
});

document.querySelector('#form').addEventListener('submit', async event => {
    event.preventDefault();

    const nameInput = document.querySelector('#name');
    const messageInput = document.querySelector('#message');
    const r = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: nameInput.value,
            message: messageInput.value
        })
    });

    document.querySelector('#status').textContent = r.ok
        ? '投稿しました'
        : '投稿に失敗しました';

    if (r.ok) {
        localStorage.setItem(NAME_KEY, nameInput.value.trim());
        // 画像があれば、作成された投稿IDに対してアップロードする
        if (selectedImages.length) {
            const created = await r.json();
            const formData = new FormData();
            selectedImages.forEach(file => formData.append('images', file));
            const ri = await fetch(`/api/messages/${created.id}/images`, { method: 'POST', body: formData });
            if (!ri.ok) {
                document.querySelector('#status').textContent = '投稿しましたが、画像のアップロードに失敗しました';
            }
        }
        selectedImages = [];
        renderSelectedImages();
        nameInput.value = '';
        messageInput.value = '';
        updateCharCount(nameInput);
        updateCharCount(messageInput);
        await loadMessages();
    }
});

loadMessages().catch(error => {
    document.querySelector('#status').textContent = error.message;
});