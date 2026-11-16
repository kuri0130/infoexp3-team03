const VOTER_ID_KEY = 'miniboard-voter-id';
const NAME_KEY = 'miniboard-name'; // 最後に使ったニックネーム

// crypto.randomUUID() は https か localhost でしか使えないため、
// IPアドレス等の http で開いた場合は getRandomValues() でIDを作る
function createId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return Array.from(crypto.getRandomValues(new Uint8Array(16)),
        b => b.toString(16).padStart(2, '0')).join('');
}

export function getVoterId() {
    let voterId = localStorage.getItem(VOTER_ID_KEY);
    if (!voterId) {
        voterId = createId();
        localStorage.setItem(VOTER_ID_KEY, voterId);
    }
    return voterId;
}

export function getSavedName() {
    return localStorage.getItem(NAME_KEY) || '';
}

export function saveName(name) {
    localStorage.setItem(NAME_KEY, String(name || '').trim());
}

export function formatDateTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

export function escapeHtml(value) {
    const element = document.createElement('div');
    element.textContent = value;
    return element.innerHTML;
}

export function setStatus(message) {
    document.querySelector('#status').textContent = message;
}

export function updateCharCount(input) {
    const counter = document.querySelector(`.char-count[data-for="${input.id}"]`);
    if (!counter) return;

    const max = input.maxLength;
    const length = input.value.length;
    counter.textContent = `${length} / ${max}`;
    counter.classList.toggle('near-limit', length >= max * 0.9);
}

export function initCharCounters(inputs) {
    inputs.forEach(input => {
        input.addEventListener('input', () => updateCharCount(input));
        updateCharCount(input);
    });
}
