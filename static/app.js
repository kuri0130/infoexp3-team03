async function loadMessages() {
    const [r, ri] = await Promise.all([fetch('/api/messages'), fetch('/api/images')]);
    if (!r.ok) {
        throw new Error('投稿の読み込みに失敗しました');
    }

    const messages = await r.json();
    const images = ri.ok ? await ri.json() : [];
    // 投稿IDごとに画像をまとめる
    const imagesByMessage = {};
    for (const img of images) (imagesByMessage[img.message_id] ||= []).push(img);

    document.querySelector('#messages').innerHTML = messages.map(message => `
        <article class="message" data-message-id="${message.id}" role="button" tabindex="0"
            aria-label="投稿 #${message.id}を削除">
            <b>${escapeHtml(message.name)}</b>
            <p>${escapeHtml(message.message)}</p>
            ${renderImages(imagesByMessage[message.id] || [])}
            <div class="meta">#${message.id} ・クリックで削除</div>
        </article>
    `).join('');
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
    if (event.target.closest('.message-images')) return; // 画像クリックは削除しない（画像を開く）

    try {
        await deleteMessage(message.dataset.messageId);
    } catch (error) {
        document.querySelector('#status').textContent = error.message;
    }
});

document.querySelector('#messages').addEventListener('keydown', async event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (!event.target.matches('.message')) return; // 画像リンク上のEnterは画像を開く
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