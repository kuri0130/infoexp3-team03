from flask import request


def extract_author_id(data=None):
    raw = None
    if data is not None:
        raw = data.get("author_id")
    if not raw:
        raw = request.args.get("author_id")
    if not raw and data is None:
        body = request.get_json(silent=True) or {}
        raw = body.get("author_id")
    author_id = str(raw or "").strip()[:64]
    return author_id or None


def public_row(row):
    d = dict(row)
    d.pop("author_id", None)
    if "is_owner" in d:
        d["is_owner"] = bool(d["is_owner"])
    return d
