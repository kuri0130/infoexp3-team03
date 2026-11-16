from flask import Blueprint, jsonify, request

from backend.db import connect
from backend.events import publish_event

votes_bp = Blueprint("votes", __name__)


def _fetch_vote_counts(con, message_id):
    return con.execute("""
        SELECT
            COUNT(CASE WHEN vote = 'good' THEN 1 END) AS good_count,
            COUNT(CASE WHEN vote = 'bad' THEN 1 END) AS bad_count
        FROM message_votes
        WHERE message_id = ?
    """, (message_id,)).fetchone()


@votes_bp.post("/api/messages/<int:message_id>/votes")
def vote_message(message_id):
    data = request.get_json(silent=True) or {}
    voter_id = str(data.get("voter_id", ""))
    vote = data.get("vote")
    if not voter_id or len(voter_id) > 64 or vote not in ("good", "bad"):
        return jsonify({"error": "a voter_id and a good or bad vote are required"}), 400

    with connect() as con:
        message = con.execute("SELECT id FROM messages WHERE id = ?", (message_id,)).fetchone()
        if message is None:
            return jsonify({"error": "not found"}), 404

        con.execute("""
            INSERT INTO message_votes (message_id, voter_id, vote)
            VALUES (?, ?, ?)
            ON CONFLICT (message_id, voter_id)
            DO UPDATE SET vote = excluded.vote
        """, (message_id, voter_id, vote))
        counts = _fetch_vote_counts(con, message_id)

    publish_event("vote", {
        "message_id": message_id,
        "good_count": counts["good_count"],
        "bad_count": counts["bad_count"],
    })
    return jsonify({
        "good_count": counts["good_count"],
        "bad_count": counts["bad_count"],
        "my_vote": vote,
    })


@votes_bp.delete("/api/messages/<int:message_id>/votes")
def delete_vote(message_id):
    data = request.get_json(silent=True) or {}
    voter_id = str(data.get("voter_id", ""))
    if not voter_id or len(voter_id) > 64:
        return jsonify({"error": "a voter_id is required"}), 400

    with connect() as con:
        message = con.execute("SELECT id FROM messages WHERE id = ?", (message_id,)).fetchone()
        if message is None:
            return jsonify({"error": "not found"}), 404

        con.execute(
            "DELETE FROM message_votes WHERE message_id = ? AND voter_id = ?",
            (message_id, voter_id),
        )
        counts = _fetch_vote_counts(con, message_id)

    publish_event("vote", {
        "message_id": message_id,
        "good_count": counts["good_count"],
        "bad_count": counts["bad_count"],
    })
    return jsonify({
        "good_count": counts["good_count"],
        "bad_count": counts["bad_count"],
        "my_vote": None,
    })
