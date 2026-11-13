from flask import Flask, jsonify, render_template, request, send_from_directory
from pathlib import Path
import sqlite3
import uuid
from datetime import datetime, timezone

app = Flask(__name__)
DB = Path("data/miniboard.db")

# ---- 画像添付の設定 ----
UPLOAD_DIR = Path("data/uploads")
MAX_IMAGES_PER_MESSAGE = 2
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 1枚あたり5MBまで
app.config["MAX_CONTENT_LENGTH"] = MAX_IMAGES_PER_MESSAGE * MAX_IMAGE_BYTES + 64 * 1024

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
            created_at TEXT NOT NULL,
            edited_at TEXT
        )""")
        columns = {row["name"] for row in con.execute("PRAGMA table_info(messages)")}
        if "edited_at" not in columns:
            con.execute("ALTER TABLE messages ADD COLUMN edited_at TEXT")
        con.execute("""CREATE TABLE IF NOT EXISTS message_votes (
            message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
            voter_id TEXT NOT NULL,
            vote TEXT NOT NULL CHECK (vote IN ('good', 'bad')),
            PRIMARY KEY (message_id, voter_id)
        )""")
        con.execute("""CREATE TABLE IF NOT EXISTS images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            created_at TEXT NOT NULL
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
    edited_at = datetime.now(timezone.utc).isoformat()
    with connect() as con:
        cur = con.execute(
            "UPDATE messages SET message=?, edited_at=? WHERE id=?",
            (message, edited_at, message_id),
        )
        if cur.rowcount == 0:
            return jsonify({"error": "not found"}), 404
        row = con.execute("SELECT * FROM messages WHERE id=?", (message_id,)).fetchone()
    return jsonify(dict(row))

@app.delete("/api/messages/<int:message_id>")
def delete_message(message_id):
    with connect() as con:
        cur = con.execute("DELETE FROM messages WHERE id=?", (message_id,))
        if cur.rowcount == 0:
            return jsonify({"error": "not found"}), 404
        images = con.execute("SELECT filename FROM images WHERE message_id=?", (message_id,)).fetchall()
        con.execute("DELETE FROM images WHERE message_id=?", (message_id,))
    for img in images:
        (UPLOAD_DIR / img["filename"]).unlink(missing_ok=True)
    return "", 204

# ---- 画像添付（既存APIとは別のエンドポイントとして追加） ----

def detect_image_ext(head):
    """ファイル先頭のバイト列から画像形式を判定する（拡張子は信用しない）"""
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if head.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if head[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    return None

def image_to_dict(row):
    d = dict(row)
    d["url"] = f"/uploads/{row['filename']}"
    return d

@app.get("/api/images")
def get_all_images():
    with connect() as con:
        rows = con.execute("SELECT * FROM images ORDER BY id ASC").fetchall()
    return jsonify([image_to_dict(r) for r in rows])

@app.get("/api/messages/<int:message_id>/images")
def get_images(message_id):
    with connect() as con:
        if con.execute("SELECT 1 FROM messages WHERE id=?", (message_id,)).fetchone() is None:
            return jsonify({"error": "not found"}), 404
        rows = con.execute("SELECT * FROM images WHERE message_id=? ORDER BY id ASC", (message_id,)).fetchall()
    return jsonify([image_to_dict(r) for r in rows])

@app.post("/api/messages/<int:message_id>/images")
def upload_images(message_id):
    files = [f for f in request.files.getlist("images") if f and f.filename]
    if not files:
        return jsonify({"error": "images are required"}), 400
    # 中身を検証してから保存する（1枚でも不正なら全体を拒否）
    payloads = []
    for f in files:
        data = f.read(MAX_IMAGE_BYTES + 1)
        if len(data) > MAX_IMAGE_BYTES:
            return jsonify({"error": "image too large (max 5MB each)"}), 413
        ext = detect_image_ext(data[:16])
        if ext is None:
            return jsonify({"error": "unsupported image type (png/jpeg/gif/webp only)"}), 400
        payloads.append((data, ext))
    created_at = datetime.now(timezone.utc).isoformat()
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    with connect() as con:
        if con.execute("SELECT 1 FROM messages WHERE id=?", (message_id,)).fetchone() is None:
            return jsonify({"error": "not found"}), 404
        count = con.execute("SELECT COUNT(*) FROM images WHERE message_id=?", (message_id,)).fetchone()[0]
        if count + len(payloads) > MAX_IMAGES_PER_MESSAGE:
            return jsonify({"error": f"up to {MAX_IMAGES_PER_MESSAGE} images per message"}), 400
        ids = []
        for data, ext in payloads:
            filename = f"{uuid.uuid4().hex}.{ext}"
            (UPLOAD_DIR / filename).write_bytes(data)
            cur = con.execute("INSERT INTO images(message_id,filename,created_at) VALUES(?,?,?)", (message_id,filename,created_at))
            ids.append(cur.lastrowid)
        rows = con.execute(f"SELECT * FROM images WHERE id IN ({','.join('?'*len(ids))}) ORDER BY id", ids).fetchall()
    return jsonify([image_to_dict(r) for r in rows]), 201

@app.get("/uploads/<path:filename>")
def uploaded_file(filename):
    return send_from_directory(UPLOAD_DIR.resolve(), filename)

@app.errorhandler(413)
def too_large(e):
    return jsonify({"error": "request too large"}), 413

if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, debug=False)