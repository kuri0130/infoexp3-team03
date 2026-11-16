import queue

from flask import Blueprint, Response, stream_with_context

from backend.events import broadcaster

events_bp = Blueprint("events", __name__)


@events_bp.get("/api/events")
def stream_events():
    def generate():
        with broadcaster.subscribe() as client_queue:
            yield ": connected\n\n"
            while True:
                try:
                    event_type, payload = client_queue.get(timeout=15)
                except queue.Empty:
                    yield ": keepalive\n\n"
                    continue
                yield f"event: {event_type}\ndata: {payload}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
