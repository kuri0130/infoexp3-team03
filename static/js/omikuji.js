import { getCurrentThread } from './state.js';
import { escapeHtml, getSavedName, getVoterId, saveName, setStatus } from './utils.js';

const CONFETTI_COLORS = {
    daikichi: ['#fbbf24', '#f59e0b', '#fef08a', '#ef4444', '#ffffff', '#ec4899', '#38bdf8'],
    chukichi: ['#fb7185', '#f43f5e', '#fbbf24', '#fda4af', '#ffffff'],
    shokichi: ['#34d399', '#10b981', '#a7f3d0', '#38bdf8'],
    kichi: ['#60a5fa', '#818cf8', '#a5b4fc', '#f472b6']
};

const SPARKLE_SYMBOLS = ['✨', '★', '✦', '🌸', '🎉'];

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function spawnConfetti(container, tier) {
    const colors = CONFETTI_COLORS[tier];
    if (!colors) return;

    const count = tier === 'daikichi' ? 95 : tier === 'chukichi' ? 45 : 24;
    const isDaikichi = tier === 'daikichi';

    for (let i = 0; i < count; i++) {
        const piece = document.createElement('span');
        const useSymbol = isDaikichi && i % 4 === 0;
        piece.className = useSymbol ? 'omikuji-particle omikuji-particle-symbol' : 'omikuji-particle';

        if (useSymbol) {
            piece.textContent = SPARKLE_SYMBOLS[i % SPARKLE_SYMBOLS.length];
            piece.style.fontSize = `${16 + Math.random() * 18}px`;
        } else {
            const width = 8 + Math.random() * 8;
            const height = 10 + Math.random() * 12;
            piece.style.width = `${width}px`;
            piece.style.height = `${height}px`;
            piece.style.backgroundColor = colors[i % colors.length];
            if (i % 3 === 0) {
                piece.style.borderRadius = '50%';
            }
        }

        const burstFromCenter = isDaikichi && i < 45;
        let startX;
        let startY;
        let endX;
        let endY;

        if (burstFromCenter) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 180 + Math.random() * 360;
            startX = window.innerWidth / 2;
            startY = window.innerHeight / 2;
            endX = startX + Math.cos(angle) * distance;
            endY = startY + Math.sin(angle) * distance + 120;
        } else {
            startX = Math.random() * window.innerWidth;
            startY = -30 - Math.random() * 120;
            endX = startX + (Math.random() - 0.5) * 240;
            endY = window.innerHeight + 60;
        }

        piece.style.left = `${startX}px`;
        piece.style.top = `${startY}px`;
        container.appendChild(piece);

        const duration = burstFromCenter
            ? 1400 + Math.random() * 900
            : 2000 + Math.random() * 1800;
        const delay = burstFromCenter ? Math.random() * 150 : Math.random() * 700;
        const rotate = (Math.random() - 0.5) * 900;

        const anim = piece.animate(
            [
                {
                    transform: 'translate(0px, 0px) rotate(0deg) scale(0.7)',
                    opacity: 1
                },
                {
                    transform: `translate(${endX - startX}px, ${endY - startY}px) rotate(${rotate}deg) scale(1)`,
                    opacity: 0.1
                }
            ],
            {
                duration,
                delay,
                easing: burstFromCenter ? 'cubic-bezier(0.16, 1, 0.3, 1)' : 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                fill: 'forwards'
            }
        );

        anim.onfinish = () => piece.remove();
    }
}

function getTierBadge(tier) {
    switch (tier) {
        case 'daikichi':
            return '🎊 超絶ラッキー！ 🎊';
        case 'chukichi':
            return '✨ いいことありそう！ ✨';
        case 'shokichi':
        case 'kichi':
            return '🌿 本日の運勢 🌿';
        case 'suekichi':
            return '🌱 のびしろ十分！ 🌱';
        case 'kyo':
        case 'daikyo':
            return '⚡ 逆にレア！？厄落とし ⚡';
        default:
            return '🎋 本日の運勢';
    }
}

function showOmikujiOverlay(omikuji) {
    const overlay = document.querySelector('#omikuji-overlay');
    if (!overlay) return;

    const { tier, label, advice, lucky_item: luckyItem, lucky_color: luckyColor } = omikuji;
    const isDaikichi = tier === 'daikichi';

    overlay.className = `omikuji-overlay omikuji-tier-${tier}`;
    overlay.innerHTML = `
        <div class="omikuji-fx-layer" aria-hidden="true">
            ${isDaikichi ? '<div class="omikuji-sunburst"></div><div class="omikuji-flash"></div>' : ''}
        </div>
        <div class="omikuji-modal">
            <div class="omikuji-modal-ribbon">${escapeHtml(getTierBadge(tier))}</div>
            <div class="omikuji-fortune-stamp">
                <span class="omikuji-fortune-sub">運勢</span>
                <h2 id="omikuji-modal-title" class="omikuji-fortune-label">${escapeHtml(label)}</h2>
            </div>
            <p class="omikuji-modal-advice">${escapeHtml(advice)}</p>
            <div class="omikuji-lucky-grid">
                <div class="omikuji-lucky-item">
                    <span class="omikuji-lucky-key">✨ ラッキーアイテム</span>
                    <span class="omikuji-lucky-val">${escapeHtml(luckyItem)}</span>
                </div>
                <div class="omikuji-lucky-item">
                    <span class="omikuji-lucky-key">🎨 ラッキーカラー</span>
                    <span class="omikuji-lucky-val">${escapeHtml(luckyColor)}</span>
                </div>
            </div>
            <button type="button" id="close-omikuji-overlay" class="omikuji-close-button">
                スレッドで結果を見る
            </button>
        </div>
    `;

    overlay.hidden = false;

    const fxLayer = overlay.querySelector('.omikuji-fx-layer');
    spawnConfetti(fxLayer, tier);

    const closeButton = overlay.querySelector('#close-omikuji-overlay');
    const closeOverlay = () => {
        overlay.hidden = true;
        overlay.innerHTML = '';
        document.removeEventListener('keydown', onKeyDown);
    };

    const onKeyDown = event => {
        if (event.key === 'Escape') {
            closeOverlay();
        }
    };

    closeButton.addEventListener('click', closeOverlay);
    overlay.addEventListener('click', event => {
        if (event.target === overlay || event.target === fxLayer) {
            closeOverlay();
        }
    });
    document.addEventListener('keydown', onKeyDown);
    closeButton.focus();
}

export function initOmikuji({ onOmikujiDrawn }) {
    const drawButton = document.querySelector('#draw-omikuji-button');
    const shrineIcon = document.querySelector('#omikuji-shrine-icon');
    if (!drawButton) return;

    drawButton.addEventListener('click', async () => {
        const current = getCurrentThread();
        if (!current || current.thread_type !== 'omikuji') return;

        const nameInput = document.querySelector('#name');
        const rawName = (nameInput?.value || '').trim() || getSavedName();
        if (rawName) {
            saveName(rawName);
        }

        drawButton.disabled = true;
        drawButton.textContent = '🎋 おみくじを振っています...';
        shrineIcon?.classList.add('is-shaking');

        try {
            const [res] = await Promise.all([
                fetch(`/api/threads/${current.id}/omikuji`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: rawName,
                        author_id: getVoterId()
                    })
                }),
                wait(650)
            ]);

            if (!res.ok) {
                throw new Error('おみくじを引けませんでした');
            }

            const data = await res.json();
            showOmikujiOverlay(data.omikuji);
            await onOmikujiDrawn();
            setStatus(`おみくじを引きました！（結果：${data.omikuji.label}）`);
        } catch (error) {
            setStatus(error.message);
        } finally {
            shrineIcon?.classList.remove('is-shaking');
            drawButton.disabled = false;
            drawButton.textContent = '🎋 おみくじを引く！';
        }
    });
}
