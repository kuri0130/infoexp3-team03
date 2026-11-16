from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from backend.config import UPLOAD_DIR
from backend.db import connect
from backend.utils import extract_author_id, public_row

messages_bp = Blueprint("messages", __name__)


@messages_bp.get("/api/messages")
def get_messages():
    voter_id = request.args.get("voter_id", "")
    author_id = extract_author_id() or voter_id
    thread_id = request.args.get("thread_id", type=int)
    with connect() as con:
        if thread_id is not None:
            rows = con.execute("""
                SELECT messages.*,
                    (SELECT COUNT(*) FROM message_votes
                     WHERE message_id = messages.id AND vote = 'good') AS good_count,
                    (SELECT COUNT(*) FROM message_votes
                     WHERE message_id = messages.id AND vote = 'bad') AS bad_count,
                    (SELECT vote FROM message_votes
                     WHERE message_id = messages.id AND voter_id = ?) AS my_vote,
                    (CASE WHEN messages.author_id IS NOT NULL AND messages.author_id = ? THEN 1 ELSE 0 END) AS is_owner
                FROM messages
                WHERE messages.thread_id = ?
                ORDER BY id ASC
            """, (voter_id, author_id, thread_id)).fetchall()
        else:
            rows = con.execute("""
                SELECT messages.*,
                    (SELECT COUNT(*) FROM message_votes
                     WHERE message_id = messages.id AND vote = 'good') AS good_count,
                    (SELECT COUNT(*) FROM message_votes
                     WHERE message_id = messages.id AND vote = 'bad') AS bad_count,
                    (SELECT vote FROM message_votes
                     WHERE message_id = messages.id AND voter_id = ?) AS my_vote,
                    (CASE WHEN messages.author_id IS NOT NULL AND messages.author_id = ? THEN 1 ELSE 0 END) AS is_owner
                FROM messages
                ORDER BY id DESC
            """, (voter_id, author_id)).fetchall()
    return jsonify([public_row(r) for r in rows])


@messages_bp.post("/api/messages")
def create_message():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()[:30] or "匿名"
    message = str(data.get("message", "")).strip()[:300]
    thread_id = data.get("thread_id")
    parent_id = data.get("parent_id")
    author_id = extract_author_id(data)
    if not message:
        return jsonify({"error": "message is required"}), 400
    if parent_id is not None and (not isinstance(parent_id, int) or isinstance(parent_id, bool)):
        return jsonify({"error": "parent_id must be an integer"}), 400
    created_at = datetime.now(timezone.utc).isoformat()
    with connect() as con:
        if parent_id is not None:
            parent = con.execute("SELECT id, parent_id, thread_id FROM messages WHERE id=?", (parent_id,)).fetchone()
            if parent is None:
                return jsonify({"error": "parent message not found"}), 404
            # 返信は1階層まで：返信への返信は元の投稿にぶら下げる
            parent_id = parent["parent_id"] or parent["id"]
            if thread_id is None:
                thread_id = parent["thread_id"]

        if thread_id is not None:
            try:
                thread_id = int(thread_id)
            except (TypeError, ValueError):
                return jsonify({"error": "invalid thread_id"}), 400
            if con.execute("SELECT 1 FROM threads WHERE id = ?", (thread_id,)).fetchone() is None:
                return jsonify({"error": "thread not found"}), 404
        else:
            first_thread = con.execute("SELECT id FROM threads ORDER BY id ASC LIMIT 1").fetchone()
            thread_id = first_thread["id"] if first_thread else None

        cur = con.execute(
            "INSERT INTO messages(thread_id, name, message, author_id, created_at, parent_id) VALUES(?, ?, ?, ?, ?, ?)",
            (thread_id, name, message, author_id, created_at, parent_id),
        )
        row = con.execute(
            """SELECT *, (CASE WHEN author_id IS NOT NULL AND author_id = ? THEN 1 ELSE 0 END) AS is_owner
               FROM messages WHERE id=?""",
            (author_id or "", cur.lastrowid),
        ).fetchone()
    return jsonify(public_row(row)), 201


@messages_bp.put("/api/messages/<int:message_id>")
def update_message(message_id):
    data = request.get_json(silent=True) or {}
    message = str(data.get("message", "")).strip()[:300]
    author_id = extract_author_id(data)
    if not message:
        return jsonify({"error": "message is required"}), 400
    edited_at = datetime.now(timezone.utc).isoformat()
    with connect() as con:
        existing = con.execute("SELECT author_id FROM messages WHERE id=?", (message_id,)).fetchone()
        if existing is None:
            return jsonify({"error": "not found"}), 404
        if not existing["author_id"] or existing["author_id"] != author_id:
            return jsonify({"error": "forbidden"}), 403
        con.execute(
            "UPDATE messages SET message=?, edited_at=? WHERE id=?",
            (message, edited_at, message_id),
        )
        row = con.execute(
            """SELECT *, (CASE WHEN author_id IS NOT NULL AND author_id = ? THEN 1 ELSE 0 END) AS is_owner
               FROM messages WHERE id=?""",
            (author_id or "", message_id),
        ).fetchone()
    return jsonify(public_row(row))


@messages_bp.delete("/api/messages/<int:message_id>")
def delete_message(message_id):
    author_id = extract_author_id()
    with connect() as con:
        existing = con.execute("SELECT author_id FROM messages WHERE id=?", (message_id,)).fetchone()
        if existing is None:
            return jsonify({"error": "not found"}), 404
        if not existing["author_id"] or existing["author_id"] != author_id:
            return jsonify({"error": "forbidden"}), 403
        # 投稿本体と、その投稿への返信をまとめて削除する
        ids = [message_id] + [r["id"] for r in con.execute("SELECT id FROM messages WHERE parent_id=?", (message_id,))]
        marks = ",".join("?" * len(ids))
        images = con.execute(f"SELECT filename FROM images WHERE message_id IN ({marks})", ids).fetchall()
        con.execute(f"DELETE FROM images WHERE message_id IN ({marks})", ids)
        con.execute(f"DELETE FROM messages WHERE id IN ({marks})", ids)
    for img in images:
        (UPLOAD_DIR / img["filename"]).unlink(missing_ok=True)
    return "", 204
