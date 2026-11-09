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
        document.querySelector('#message').value = '';
        updateCharCount(document.querySelector('#message'));
        await loadMessages()
    }
}); loadMessages();

