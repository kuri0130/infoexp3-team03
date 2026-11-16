let threads = [];
let currentThreadId = null;

export function getThreads() {
    return threads;
}

export function setThreads(nextThreads) {
    threads = nextThreads;
    if (!threads.some(t => t.id === currentThreadId)) {
        currentThreadId = threads.length ? threads[0].id : null;
    }
}

export function getCurrentThreadId() {
    return currentThreadId;
}

export function setCurrentThreadId(threadId) {
    currentThreadId = threadId;
}

export function getCurrentThread() {
    return threads.find(t => t.id === currentThreadId) || null;
}
