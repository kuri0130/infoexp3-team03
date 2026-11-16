from pathlib import Path

DB_PATH = Path("data/miniboard.db")

# ---- 画像添付の設定 ----
UPLOAD_DIR = Path("data/uploads")
MAX_IMAGES_PER_MESSAGE = 2
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 1枚あたり5MBまで
MAX_CONTENT_LENGTH = MAX_IMAGES_PER_MESSAGE * MAX_IMAGE_BYTES + 64 * 1024
