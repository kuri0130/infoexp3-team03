import json
import queue
import threading
from contextlib import contextmanager


class EventBroadcaster:
    """SSE クライアントへリアルタイムイベントを配信するシンプルなブローカー"""

    def __init__(self):
        self._lock = threading.Lock()
        self._clients = set()

    @contextmanager
    def subscribe(self):
        client_queue = queue.Queue(maxsize=100)
        with self._lock:
            self._clients.add(client_queue)
        try:
            yield client_queue
        finally:
            with self._lock:
                self._clients.discard(client_queue)

    def publish(self, event_type, data=None):
        payload = json.dumps(data or {}, ensure_ascii=False)
        with self._lock:
            clients = list(self._clients)
        for client_queue in clients:
            try:
                client_queue.put_nowait((event_type, payload))
            except queue.Full:
                # 読み取りが追いついていないクライアントはブロックせずスキップする
                pass


broadcaster = EventBroadcaster()


def publish_event(event_type, data=None):
    broadcaster.publish(event_type, data)
