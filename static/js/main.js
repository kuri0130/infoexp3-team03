import { initImages } from './images.js';
import { initMessages, loadMessages } from './messages.js';
import { initThreads, loadThreads } from './threads.js';
import { setStatus } from './utils.js';
import { initVotes } from './votes.js';
import { initTopicRoulette } from './topic-roulette.js';

async function reloadBoard() {
    await loadThreads();
    await loadMessages();
}

initImages();
initVotes();
initThreads({ onThreadChange: loadMessages });
initMessages({ onMessagesChanged: reloadBoard });
initTopicRoulette();

reloadBoard().catch(error => {
    setStatus(error.message);
});
