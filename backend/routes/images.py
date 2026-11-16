from datetime import datetime, timezone
import uuid

from flask import Blueprint, jsonify, request, send_from_directory

from backend.config import MAX_IMAGES_PER_MESSAGE, MAX_IMAGE_BYTES, UPLOAD_DIR
from backend.db import connect
from backend.events import publish_event

images_bp = Blueprint("images", __name__)


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


@images_bp.get("/api/images")
def get_all_images():
    with connect() as con:
        rows = con.execute("SELECT * FROM images ORDER BY id ASC").fetchall()
    return jsonify([image_to_dict(r) for r in rows])


@images_bp.get("/api/messages/<int:message_id>/images")
def get_images(message_id):
    with connect() as con:
        if con.execute("SELECT 1 FROM messages WHERE id=?", (message_id,)).fetchone() is None:
            return jsonify({"error": "not found"}), 404
        rows = con.execute("SELECT * FROM images WHERE message_id=? ORDER BY id ASC", (message_id,)).fetchall()
    return jsonify([image_to_dict(r) for r in rows])


@images_bp.post("/api/messages/<int:message_id>/images")
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
        message = con.execute("SELECT thread_id FROM messages WHERE id=?", (message_id,)).fetchone()
        if message is None:
            return jsonify({"error": "not found"}), 404
        count = con.execute("SELECT COUNT(*) FROM images WHERE message_id=?", (message_id,)).fetchone()[0]
        if count + len(payloads) > MAX_IMAGES_PER_MESSAGE:
            return jsonify({"error": f"up to {MAX_IMAGES_PER_MESSAGE} images per message"}), 400
        ids = []
        for data, ext in payloads:
            filename = f"{uuid.uuid4().hex}.{ext}"
            (UPLOAD_DIR / filename).write_bytes(data)
            cur = con.execute(
                "INSERT INTO images(message_id,filename,created_at) VALUES(?,?,?)",
                (message_id, filename, created_at),
            )
            ids.append(cur.lastrowid)
        rows = con.execute(
            f"SELECT * FROM images WHERE id IN ({','.join('?' * len(ids))}) ORDER BY id",
            ids,
        ).fetchall()
    publish_event("board_updated", {
        "reason": "images_uploaded",
        "thread_id": message["thread_id"],
        "message_id": message_id,
    })
    return jsonify([image_to_dict(r) for r in rows]), 201


@images_bp.get("/uploads/<path:filename>")
def uploaded_file(filename):
    return send_from_directory(UPLOAD_DIR.resolve(), filename)
