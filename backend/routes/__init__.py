from backend.routes.danmaku import danmaku_bp
from backend.routes.events import events_bp
from backend.routes.images import images_bp
from backend.routes.messages import messages_bp
from backend.routes.omikuji import omikuji_bp
from backend.routes.pages import pages_bp
from backend.routes.threads import threads_bp
from backend.routes.votes import votes_bp


def register_blueprints(app):
    app.register_blueprint(pages_bp)
    app.register_blueprint(events_bp)
    app.register_blueprint(danmaku_bp)
    app.register_blueprint(threads_bp)
    app.register_blueprint(messages_bp)
    app.register_blueprint(omikuji_bp)
    app.register_blueprint(votes_bp)
    app.register_blueprint(images_bp)
