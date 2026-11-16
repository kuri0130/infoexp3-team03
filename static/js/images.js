import { escapeHtml, setStatus } from './utils.js';

const MAX_IMAGES = 2;
let selectedImages = [];

export function renderImages(imgs) {
    if (!imgs.length) return '';
    return `<div class="message-images">${imgs.map(img => `<a href="${escapeHtml(img.url)}" target="_blank" rel="noopener"><img src="${escapeHtml(img.url)}" alt="添付画像" loading="lazy"></a>`).join('')}</div>`;
}

export function renderSelectedImages() {
    const box = document.querySelector('#image-previews');
    box.querySelectorAll('img').forEach(img => URL.revokeObjectURL(img.src));
    box.innerHTML = selectedImages.map((file, i) => `<div class="preview"><img src="${URL.createObjectURL(file)}" alt=""><button type="button" class="remove-image" data-index="${i}" aria-label="画像を外す">×</button></div>`).join('');
    const count = document.querySelector('.image-count');
    count.textContent = `${selectedImages.length} / ${MAX_IMAGES}枚`;
    count.classList.toggle('near-limit', selectedImages.length >= MAX_IMAGES);
}

export function hasSelectedImages() {
    return selectedImages.length > 0;
}

export function clearSelectedImages() {
    selectedImages = [];
    renderSelectedImages();
}

export async function uploadSelectedImages(messageId) {
    if (!selectedImages.length) return true;
    const formData = new FormData();
    selectedImages.forEach(file => formData.append('images', file));
    const response = await fetch(`/api/messages/${messageId}/images`, {
        method: 'POST',
        body: formData
    });
    return response.ok;
}

export function initImages() {
    document.querySelector('#images').addEventListener('change', event => {
        const picked = [...event.target.files];
        const room = MAX_IMAGES - selectedImages.length;
        if (picked.length > room) {
            setStatus(`画像は${MAX_IMAGES}枚までです`);
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
}
