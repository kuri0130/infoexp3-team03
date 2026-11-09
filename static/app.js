async function loadMessages() {
    const r = await fetch('/api/messages');
    const xs = await r.json();
    document.querySelector('#messages').innerHTML = xs.map(x => `<article class="message"><b>${escapeHtml(x.name)}</b><p>${escapeHtml(x.message)}</p><div class="meta">#${x.id}</div></article>`).join('')
}

function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML
}

document.querySelector('#form').addEventListener('submit', async e => {
    e.preventDefault(); const name = document.querySelector('#name').value;
    const message = document.querySelector('#message').value;
    const r = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, message }) });
    document.querySelector('#status').textContent = r.ok ? '投稿しました' : '投稿に失敗しました';
    if (r.ok) {
        document.querySelector('#message').value = '';
        await loadMessages()
    }
}); loadMessages();
