import { initDanmaku } from './danmaku.js';
import { initImages } from './images.js';
import { initMessages, loadMessages } from './messages.js';
import { initThreads, loadThreads } from './threads.js';
import { setStatus } from './utils.js';
import { initVotes } from './votes.js';

async function reloadBoard() {
    await loadThreads();
    await loadMessages();
}

initDanmaku();
initImages();
initVotes();
initThreads({ onThreadChange: loadMessages });
initMessages({ onMessagesChanged: reloadBoard });

reloadBoard().catch(error => {
    setStatus(error.message);
});
