async function loadMessages() {
    const r = await fetch('/api/messages');
    if (!r.ok) {
        throw new Error('投稿の読み込みに失敗しました');
    }
    const xs = await r.json();
    document.querySelector('#messages').innerHTML = xs.map(x => `
        <article class="message" data-message-id="${x.id}" role="button" tabindex="0"
            aria-label="投稿 #${x.id}を削除">
            <b>${escapeHtml(x.name)}</b>
            <p>${escapeHtml(x.message)}</p>
            <div class="meta">#${x.id} ・クリックで削除</div>
        </article>`).join('')
}

function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML
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

document.querySelector('#messages').addEventListener('click', async e => {
    const message = e.target.closest('.message');
    if (!message) return;

    try {
        await deleteMessage(message.dataset.messageId);
    } catch (error) {
        document.querySelector('#status').textContent = error.message;
    }
});

document.querySelector('#messages').addEventListener('keydown', async e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();

    try {
        await deleteMessage(e.target.dataset.messageId);
    } catch (error) {
        document.querySelector('#status').textContent = error.message;
    }
    // 入力文字数カウンター（上限は各入力欄の maxlength 属性を参照）
    function updateCharCount(input) {
        const counter = document.querySelector(`.char-count[data-for="${input.id}"]`);
        if (!counter) return;
        const max = input.maxLength;
        const len = input.value.length;
        counter.textContent = `${len} / ${max}`;
        counter.classList.toggle('near-limit', len >= max * 0.9);
    }

    document.querySelectorAll('#name, #message').forEach(input => {
        input.addEventListener('input', () => updateCharCount(input));
        updateCharCount(input);
    });

    document.querySelector('#form').addEventListener('submit', async e => {
        e.preventDefault(); const name = document.querySelector('#name').value;
        const message = document.querySelector('#message').value;
        const r = await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, message })
        });
        document.querySelector('#status').textContent = r.ok ? '投稿しました' : '投稿に失敗しました';
        if (r.ok) {
            document.querySelector('#name').value = '';
            document.querySelector('#message').value = '';
            updateCharCount(document.querySelector('#message'));
            await loadMessages()
        }
    });

    loadMessages().catch(error => {
        document.querySelector('#status').textContent = error.message;
    });
});
