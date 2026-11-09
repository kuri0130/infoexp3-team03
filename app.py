from flask import Flask, jsonify, render_template, request
from pathlib import Path
import sqlite3
from datetime import datetime, timezone

app = Flask(__name__)
DB = Path("data/miniboard.db")

def connect():
    DB.parent.mkdir(exist_ok=True)
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    return con

def init_db():
    with connect() as con:
        con.execute("""CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TEXT NOT NULL
        )""")
        con.execute("""CREATE TABLE IF NOT EXISTS message_votes (
            message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
            voter_id TEXT NOT NULL,
            vote TEXT NOT NULL CHECK (vote IN ('good', 'bad')),
            PRIMARY KEY (message_id, voter_id)
        )""")

@app.get("/")
def index():
    return render_template("index.html")

@app.get("/api/messages")
def get_messages():
    voter_id = request.args.get("voter_id", "")
    with connect() as con:
        rows = con.execute("""
            SELECT messages.*,
                (SELECT COUNT(*) FROM message_votes
                 WHERE message_id = messages.id AND vote = 'good') AS good_count,
                (SELECT COUNT(*) FROM message_votes
                 WHERE message_id = messages.id AND vote = 'bad') AS bad_count,
                (SELECT vote FROM message_votes
                 WHERE message_id = messages.id AND voter_id = ?) AS my_vote
            FROM messages
            ORDER BY id DESC
        """, (voter_id,)).fetchall()
    return jsonify([dict(r) for r in rows])

@app.post("/api/messages")
def create_message():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()[:30]
    message = str(data.get("message", "")).strip()[:300]
    if not name or not message:
        return jsonify({"error": "name and message are required"}), 400
    created_at = datetime.now(timezone.utc).isoformat()
    with connect() as con:
        cur = con.execute("INSERT INTO messages(name,message,created_at) VALUES(?,?,?)", (name,message,created_at))
        row = con.execute("SELECT * FROM messages WHERE id=?", (cur.lastrowid,)).fetchone()
    return jsonify(dict(row)), 201

@app.post("/api/messages/<int:message_id>/votes")
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
        counts = con.execute("""
            SELECT
                COUNT(CASE WHEN vote = 'good' THEN 1 END) AS good_count,
                COUNT(CASE WHEN vote = 'bad' THEN 1 END) AS bad_count
            FROM message_votes
            WHERE message_id = ?
        """, (message_id,)).fetchone()

    return jsonify({
        "good_count": counts["good_count"],
        "bad_count": counts["bad_count"],
        "my_vote": vote
    })

@app.put("/api/messages/<int:message_id>")
def update_message(message_id):
    data = request.get_json(silent=True) or {}
    message = str(data.get("message", "")).strip()[:300]
    if not message:
        return jsonify({"error": "message is required"}), 400
    with connect() as con:
        cur = con.execute("UPDATE messages SET message=? WHERE id=?", (message,message_id))
        if cur.rowcount == 0:
            return jsonify({"error": "not found"}), 404
    return jsonify({"ok": True})

@app.delete("/api/messages/<int:message_id>")
def delete_message(message_id):
    with connect() as con:
        cur = con.execute("DELETE FROM messages WHERE id=?", (message_id,))
        if cur.rowcount == 0:
            return jsonify({"error": "not found"}), 404
    return "", 204

if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, debug=False)
