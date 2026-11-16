from flask import Blueprint, jsonify, request

from backend.events import publish_event

danmaku_bp = Blueprint("danmaku", __name__)


@danmaku_bp.post("/api/danmaku")
def post_danmaku():
    data = request.get_json(silent=True) or {}
    text = str(data.get("text", "")).strip()[:40]
    if not text:
        return jsonify({"error": "text is required"}), 400

    thread_id = data.get("thread_id")
    if thread_id is not None:
        try:
            thread_id = int(thread_id)
        except (TypeError, ValueError):
            return jsonify({"error": "invalid thread_id"}), 400

    sender_id = str(data.get("sender_id", ""))[:64]

    publish_event("danmaku", {
        "text": text,
        "thread_id": thread_id,
        "sender_id": sender_id,
    })
    return jsonify({"ok": True}), 202
