from datetime import datetime, timezone
import sqlite3

from backend.config import DB_PATH


def connect():
    DB_PATH.parent.mkdir(exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    return con


def init_db():
    with connect() as con:
        con.execute("""CREATE TABLE IF NOT EXISTS threads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            name TEXT NOT NULL,
            author_id TEXT,
            created_at TEXT NOT NULL
        )""")
        thread_columns = {row["name"] for row in con.execute("PRAGMA table_info(threads)")}
        if "author_id" not in thread_columns:
            con.execute("ALTER TABLE threads ADD COLUMN author_id TEXT")

        con.execute("""CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            thread_id INTEGER REFERENCES threads(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            message TEXT NOT NULL,
            author_id TEXT,
            created_at TEXT NOT NULL,
            edited_at TEXT
        )""")
        columns = {row["name"] for row in con.execute("PRAGMA table_info(messages)")}
        if "edited_at" not in columns:
            con.execute("ALTER TABLE messages ADD COLUMN edited_at TEXT")
        if "thread_id" not in columns:
            con.execute("ALTER TABLE messages ADD COLUMN thread_id INTEGER REFERENCES threads(id) ON DELETE CASCADE")
        if "author_id" not in columns:
            con.execute("ALTER TABLE messages ADD COLUMN author_id TEXT")

        # 既存メッセージや初期状態のためにデフォルトスレッドを用意する
        thread_count = con.execute("SELECT COUNT(*) FROM threads").fetchone()[0]
        if thread_count == 0:
            now = datetime.now(timezone.utc).isoformat()
            cur = con.execute(
                "INSERT INTO threads(title, name, created_at) VALUES(?, ?, ?)",
                ("総合スレッド", "システム", now),
            )
            con.execute("UPDATE messages SET thread_id = ? WHERE thread_id IS NULL", (cur.lastrowid,))
        else:
            orphan_exists = con.execute("SELECT 1 FROM messages WHERE thread_id IS NULL LIMIT 1").fetchone()
            if orphan_exists:
                first_thread = con.execute("SELECT id FROM threads ORDER BY id ASC LIMIT 1").fetchone()
                con.execute("UPDATE messages SET thread_id = ? WHERE thread_id IS NULL", (first_thread["id"],))

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
