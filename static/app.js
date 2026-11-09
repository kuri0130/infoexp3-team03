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
    const r = await fetch(`/api/messages?voter_id=${encodeURIComponent(voterId)}`);
    if (!r.ok) {
        throw new Error('投稿の読み込みに失敗しました');
    }

    const messages = await r.json();
    document.querySelector('#messages').innerHTML = messages.map(message => `
        <article class="message" data-message-id="${message.id}">
            <b>${escapeHtml(message.name)}</b>
            <p class="message-text">${escapeHtml(message.message)}</p>
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
    article.querySelector('[data-vote="good"] .vote-count').textContent = result.good_count;
    article.querySelector('[data-vote="bad"] .vote-count').textContent = result.bad_count;
    article.querySelectorAll('.vote-button').forEach(button => {
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
    if (!button) return;
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

    if (event.target.closest('.cancel-edit')) {
        event.stopPropagation();
        await loadMessages();
        return;
    }

    if (event.target.closest('form')) return;
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
