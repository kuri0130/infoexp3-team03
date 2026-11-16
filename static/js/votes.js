import { getVoterId, setStatus } from './utils.js';

export function updateVoteCounts(messageId, goodCount, badCount, myVote = undefined) {
    const article = document.querySelector(`.message[data-message-id="${messageId}"]`);
    if (!article) return;

    // 返信の中の評価ボタンを拾わないよう、この投稿自身のボタンだけを対象にする
    const votes = article.querySelector(':scope > .message-actions .vote-actions');
    if (!votes) return;

    const goodBtn = votes.querySelector('[data-vote="good"]');
    const badBtn = votes.querySelector('[data-vote="bad"]');
    if (goodBtn) {
        goodBtn.querySelector('.vote-count').textContent = goodCount;
        goodBtn.setAttribute('aria-label', `Good ${goodCount}`);
    }
    if (badBtn) {
        badBtn.querySelector('.vote-count').textContent = badCount;
        badBtn.setAttribute('aria-label', `Bad ${badCount}`);
    }
    if (myVote !== undefined) {
        votes.querySelectorAll('.vote-button').forEach(button => {
            button.setAttribute('aria-pressed', String(button.dataset.vote === myVote));
        });
    }
}

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
    updateVoteCounts(messageId, result.good_count, result.bad_count, result.my_vote);
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
