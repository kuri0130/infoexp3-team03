import { getVoterId, setStatus } from './utils.js';

async function voteMessage(messageId, vote, removeVote = false) {
    const response = await fetch(`/api/messages/${messageId}/votes`, {
        method: removeVote ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(removeVote
            ? { voter_id: getVoterId() }
            : { voter_id: getVoterId(), vote })
    });
    if (!response.ok) {
        throw new Error('評価の送信に失敗しました');
    }

    const result = await response.json();
    const article = document.querySelector(`.message[data-message-id="${messageId}"]`);
    // 返信の中の評価ボタンを拾わないよう、この投稿自身のボタンだけを対象にする
    const votes = article.querySelector(':scope > .message-actions .vote-actions');
    votes.querySelector('[data-vote="good"] .vote-count').textContent = result.good_count;
    votes.querySelector('[data-vote="bad"] .vote-count').textContent = result.bad_count;
    votes.querySelector('[data-vote="good"]').setAttribute('aria-label', `Good ${result.good_count}`);
    votes.querySelector('[data-vote="bad"]').setAttribute('aria-label', `Bad ${result.bad_count}`);
    votes.querySelectorAll('.vote-button').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.vote === result.my_vote));
    });
    setStatus(removeVote ? '評価を取り消しました' : '評価を更新しました');
}

export function initVotes() {
    document.querySelector('#messages').addEventListener('click', async event => {
        const button = event.target.closest('.vote-button');
        if (!button) return;
        const message = button.closest('.message');
        if (!message) return;

        const removeVote = button.getAttribute('aria-pressed') === 'true';
        try {
            await voteMessage(message.dataset.messageId, button.dataset.vote, removeVote);
        } catch (error) {
            setStatus(error.message);
        }
    });
}
