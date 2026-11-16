from flask import Flask, jsonify

from backend.config import MAX_CONTENT_LENGTH
from backend.db import init_db
from backend.routes import register_blueprints


def create_app():
    flask_app = Flask(__name__)
    flask_app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

    register_blueprints(flask_app)

    @flask_app.errorhandler(413)
    def too_large(e):
        return jsonify({"error": "request too large"}), 413

    init_db()
    return flask_app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
