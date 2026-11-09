async function loadMessages() {
    const r = await fetch('/api/messages');
    if (!r.ok) {
        throw new Error('投稿の読み込みに失敗しました');
    }

    const messages = await r.json();
    document.querySelector('#messages').innerHTML = messages.map(message => `
        <article class="message" data-message-id="${message.id}" role="button" tabindex="0"
            aria-label="投稿 #${message.id}をクリックで削除">
            <b>${escapeHtml(message.name)}</b>
            <p class="message-text">${escapeHtml(message.message)}</p>
            <div class="meta">
                <span>#${message.id}${message.edited_at ? ' ・ 編集済み' : ''}</span>
                <button type="button" class="edit-button">編集</button>
            </div>
        </article>
    `).join('');
}

function escapeHtml(value) {
    const element = document.createElement('div');
    element.textContent = value;
    return element.innerHTML;
}

async function deleteMessage(messageId) {
    if (!window.confirm('この投稿を削除しますか？')) {
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
        body: JSON.stringify({ message })
    });

    if (!r.ok) {
        throw new Error('投稿の編集に失敗しました');
    }

    await loadMessages();
    document.querySelector('#status').textContent = '投稿を編集しました';
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
    const message = event.target.closest('.message');
    if (!message) return;

    if (event.target.closest('.edit-button')) {
        event.stopPropagation();
        startEditing(message);
        return;
    }

    if (event.target.closest('.cancel-edit')) {
        event.stopPropagation();
        await loadMessages();
        return;
    }

    if (event.target.closest('button, form')) return;

    try {
        await deleteMessage(message.dataset.messageId);
    } catch (error) {
        document.querySelector('#status').textContent = error.message;
    }
});

document.querySelector('#messages').addEventListener('submit', async event => {
    if (!event.target.classList.contains('edit-form')) return;
    event.preventDefault();
    event.stopPropagation();

    try {
        await updateMessage(event.target.closest('.message'));
    } catch (error) {
        document.querySelector('#status').textContent = error.message;
    }
});

document.querySelector('#messages').addEventListener('keydown', async event => {
    if (event.target.closest('form, button')) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();

    try {
        await deleteMessage(event.target.dataset.messageId);
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
