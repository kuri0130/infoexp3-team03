import { getCurrentThreadId } from './state.js';
import { getVoterId } from './utils.js';

const DANMAKU_COLORS = [
    '#7563b8',
    '#e11d48',
    '#0284c7',
    '#059669',
    '#d97706',
    '#9333ea',
    '#334155'
];

const QUICK_STAMPS = ['🎉', '👏', '🔥', '草', '神', '💡'];

let enabled = false;
let loopTimer = null;
let messageCursor = 0;
let stageElement = null;

function getBoardTexts() {
    return Array.from(document.querySelectorAll('#messages .message-text'))
        .map(el => el.textContent.trim())
        .filter(Boolean);
}

function spawnDanmaku(stage, text, { highlight = false } = {}) {
    if (!text) return;

    const item = document.createElement('span');
    item.className = `danmaku-item${highlight ? ' danmaku-highlight' : ''}`;
    item.textContent = text;

    const laneTop = 8 + Math.random() * 76; // 画面の 8%〜84% の高さに配置
    const fontSize = highlight ? 24 + Math.random() * 6 : 16 + Math.random() * 10;
    const duration = highlight ? 4800 + Math.random() * 1200 : 5500 + Math.random() * 3500;
    const color = DANMAKU_COLORS[Math.floor(Math.random() * DANMAKU_COLORS.length)];

    item.style.top = `${laneTop}vh`;
    item.style.fontSize = `${fontSize}px`;
    item.style.color = color;

    stage.appendChild(item);

    const distance = window.innerWidth + item.offsetWidth + 120;
    const animation = item.animate(
        [
            { transform: 'translateX(0px)' },
            { transform: `translateX(-${distance}px)` }
        ],
        {
            duration,
            easing: 'linear'
        }
    );

    animation.onfinish = () => item.remove();
}

async function broadcastDanmaku(text) {
    try {
        await fetch('/api/danmaku', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text,
                thread_id: getCurrentThreadId(),
                sender_id: getVoterId()
            })
        });
    } catch (error) {
        console.error('弾幕の送信に失敗しました:', error);
    }
}

function shootDanmaku(stage, text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    spawnDanmaku(stage, trimmed, { highlight: true });
    broadcastDanmaku(trimmed);
}

export function receiveDanmaku(data) {
    if (!enabled || !stageElement || !data?.text) return;
    if (data.sender_id && data.sender_id === getVoterId()) return;
    const currentThreadId = getCurrentThreadId();
    if (data.thread_id != null && currentThreadId !== null && data.thread_id !== currentThreadId) {
        return;
    }
    spawnDanmaku(stageElement, data.text, { highlight: true });
}

function createStage() {
    const stage = document.createElement('div');
    stage.id = 'danmaku-stage';
    stage.className = 'danmaku-stage';
    stage.setAttribute('aria-hidden', 'true');
    document.body.appendChild(stage);
    return stage;
}

function createControlBar(stage) {
    const bar = document.createElement('div');
    bar.id = 'danmaku-bar';
    bar.className = 'danmaku-bar';
    bar.hidden = true;
    bar.innerHTML = `
        <div class="danmaku-stamps">
            ${QUICK_STAMPS.map(stamp => `<button type="button" class="danmaku-stamp" data-text="${stamp}">${stamp}</button>`).join('')}
        </div>
        <form class="danmaku-shot-form">
            <input type="text" class="danmaku-shot-input" maxlength="40" placeholder="画面にコメントを飛ばす...">
            <button type="submit" class="danmaku-shot-button">🚀 飛ばす</button>
        </form>
    `;

    bar.addEventListener('click', event => {
        const stamp = event.target.closest('.danmaku-stamp');
        if (!stamp) return;
        shootDanmaku(stage, stamp.dataset.text);
    });

    bar.querySelector('.danmaku-shot-form').addEventListener('submit', event => {
        event.preventDefault();
        const input = bar.querySelector('.danmaku-shot-input');
        if (!input.value.trim()) return;
        shootDanmaku(stage, input.value);
        input.value = '';
    });

    document.body.appendChild(bar);
    return bar;
}

export function initDanmaku() {
    const toggleButton = document.querySelector('#toggle-danmaku');
    if (!toggleButton) return;

    const stage = createStage();
    stageElement = stage;
    const bar = createControlBar(stage);

    function startLoop() {
        const initialTexts = getBoardTexts();
        initialTexts.slice(0, 4).forEach((text, index) => {
            setTimeout(() => {
                if (enabled) spawnDanmaku(stage, text);
            }, index * 350);
        });

        loopTimer = window.setInterval(() => {
            const texts = getBoardTexts();
            if (!texts.length) return;
            const text = texts[messageCursor % texts.length];
            messageCursor += 1;
            spawnDanmaku(stage, text);
        }, 1200);
    }

    function stopLoop() {
        if (loopTimer !== null) {
            window.clearInterval(loopTimer);
            loopTimer = null;
        }
        stage.innerHTML = '';
    }

    toggleButton.addEventListener('click', () => {
        enabled = !enabled;
        toggleButton.setAttribute('aria-pressed', String(enabled));
        const textEl = toggleButton.querySelector('.fun-toggle-text');
        const badgeEl = toggleButton.querySelector('.fun-toggle-badge');
        if (textEl && badgeEl) {
            textEl.textContent = enabled ? '弾幕モード: ON' : '弾幕モード: OFF';
            badgeEl.textContent = enabled ? '発動中 🔥' : '画面にコメントが流れる！';
        }
        bar.hidden = !enabled;

        if (enabled) {
            startLoop();
        } else {
            stopLoop();
        }
    });
}
