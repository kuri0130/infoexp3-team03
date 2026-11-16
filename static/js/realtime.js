import { getCurrentThreadId } from './state.js';
import { updateVoteCounts } from './votes.js';

function hasActiveInlineForm() {
    return Boolean(document.querySelector('#messages .edit-form, #messages .reply-form'));
}

export function initRealtime({ onThreadsRefresh, onMessagesRefresh }) {
    if (typeof EventSource === 'undefined') return null;

    let syncTimer = null;
    let pendingThreads = false;
    let pendingMessages = false;
    let deferredMessages = false;
    let isSyncing = false;
    let hasConnectedOnce = false;

    async function runSync() {
        if (isSyncing) return;
        isSyncing = true;
        try {
            while (pendingThreads || pendingMessages) {
                const needThreads = pendingThreads;
                const needMessages = pendingMessages;
                pendingThreads = false;
                pendingMessages = false;

                if (needThreads) {
                    await onThreadsRefresh();
                }
                if (needMessages) {
                    if (hasActiveInlineForm()) {
                        deferredMessages = true;
                    } else {
                        deferredMessages = false;
                        await onMessagesRefresh();
                    }
                }
            }
        } catch (error) {
            console.error('リアルタイム同期エラー:', error);
        } finally {
            isSyncing = false;
        }
    }

    function scheduleSync({ threads = true, messages = true } = {}) {
        if (threads) pendingThreads = true;
        if (messages) pendingMessages = true;

        clearTimeout(syncTimer);
        syncTimer = setTimeout(runSync, 150);
    }

    // 編集・返信フォームを閉じた直後に保留中のメッセージ更新があれば反映する
    const messagesEl = document.querySelector('#messages');
    if (messagesEl && typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver(() => {
            if (deferredMessages && !hasActiveInlineForm()) {
                deferredMessages = false;
                scheduleSync({ threads: false, messages: true });
            }
        });
        observer.observe(messagesEl, { childList: true, subtree: true });
    }

    const source = new EventSource('/api/events');

    source.addEventListener('open', () => {
        if (hasConnectedOnce) {
            scheduleSync({ threads: true, messages: true });
        }
        hasConnectedOnce = true;
    });

    source.addEventListener('vote', event => {
        try {
            const data = JSON.parse(event.data);
            updateVoteCounts(data.message_id, data.good_count, data.bad_count);
        } catch (error) {
            console.error('いいね更新イベントの解析に失敗しました:', error);
        }
    });

    source.addEventListener('board_updated', event => {
        try {
            const data = JSON.parse(event.data);
            const currentThreadId = getCurrentThreadId();
            const affectsCurrentMessages =
                data.thread_id == null ||
                data.thread_id === currentThreadId ||
                data.reason === 'thread_deleted';
            scheduleSync({ threads: true, messages: affectsCurrentMessages });
        } catch (error) {
            console.error('掲示板更新イベントの解析に失敗しました:', error);
        }
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            scheduleSync({ threads: true, messages: true });
        }
    });

    return source;
}
