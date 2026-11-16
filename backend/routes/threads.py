from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from backend.config import UPLOAD_DIR
from backend.db import connect
from backend.utils import extract_author_id, public_row

threads_bp = Blueprint("threads", __name__)


@threads_bp.get("/api/threads")
def get_threads():
    author_id = extract_author_id() or ""
    with connect() as con:
        rows = con.execute("""
            SELECT threads.*,
                (SELECT COUNT(*) FROM messages WHERE messages.thread_id = threads.id) AS message_count,
                COALESCE(
                    (SELECT MAX(messages.created_at) FROM messages WHERE messages.thread_id = threads.id),
                    threads.created_at
                ) AS last_posted_at,
                (CASE WHEN threads.author_id IS NOT NULL AND threads.author_id = ? THEN 1 ELSE 0 END) AS is_owner
            FROM threads
            ORDER BY last_posted_at DESC, threads.id DESC
        """, (author_id,)).fetchall()
    return jsonify([public_row(r) for r in rows])


@threads_bp.post("/api/threads")
def create_thread():
    data = request.get_json(silent=True) or {}
    title = str(data.get("title", "")).strip()[:60]
    name = str(data.get("name", "")).strip()[:30] or "匿名"
    message = str(data.get("message", "")).strip()[:300]
    author_id = extract_author_id(data)
    if not title:
        return jsonify({"error": "title is required"}), 400
    created_at = datetime.now(timezone.utc).isoformat()
    with connect() as con:
        cur = con.execute(
            "INSERT INTO threads(title, name, author_id, created_at) VALUES(?, ?, ?, ?)",
            (title, name, author_id, created_at),
        )
        thread_id = cur.lastrowid
        if message:
            con.execute(
                "INSERT INTO messages(thread_id, name, message, author_id, created_at) VALUES(?, ?, ?, ?, ?)",
                (thread_id, name, message, author_id, created_at),
            )
        row = con.execute("""
            SELECT threads.*,
                (SELECT COUNT(*) FROM messages WHERE messages.thread_id = threads.id) AS message_count,
                COALESCE(
                    (SELECT MAX(messages.created_at) FROM messages WHERE messages.thread_id = threads.id),
                    threads.created_at
                ) AS last_posted_at,
                (CASE WHEN threads.author_id IS NOT NULL AND threads.author_id = ? THEN 1 ELSE 0 END) AS is_owner
            FROM threads
            WHERE id = ?
        """, (author_id or "", thread_id)).fetchone()
    return jsonify(public_row(row)), 201


@threads_bp.delete("/api/threads/<int:thread_id>")
def delete_thread(thread_id):
    author_id = extract_author_id()
    with connect() as con:
        thread = con.execute("SELECT author_id FROM threads WHERE id = ?", (thread_id,)).fetchone()
        if thread is None:
            return jsonify({"error": "not found"}), 404
        if not thread["author_id"] or thread["author_id"] != author_id:
            return jsonify({"error": "forbidden"}), 403
        images = con.execute("""
            SELECT images.filename
            FROM images
            JOIN messages ON images.message_id = messages.id
            WHERE messages.thread_id = ?
        """, (thread_id,)).fetchall()
        con.execute("""
            DELETE FROM images
            WHERE message_id IN (SELECT id FROM messages WHERE thread_id = ?)
        """, (thread_id,))
        con.execute("DELETE FROM threads WHERE id = ?", (thread_id,))
    for img in images:
        (UPLOAD_DIR / img["filename"]).unlink(missing_ok=True)
    return "", 204
