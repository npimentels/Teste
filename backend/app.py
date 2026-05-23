from flask import Flask, send_from_directory
from flask_cors import CORS

from config import Config
from models import db
from routes import api

import os


def create_app():
    app = Flask(
        __name__,
        static_folder=os.path.join(os.path.dirname(__file__), "..", "frontend"),
        static_url_path="",
    )
    app.config["SQLALCHEMY_DATABASE_URI"] = Config.get_sqlalchemy_url()
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    CORS(app, resources={r"/api/*": {"origins": "*"}})

    db.init_app(app)

    app.register_blueprint(api)

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_frontend(path):
        frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")
        target = os.path.join(frontend_dir, path)
        if path and os.path.exists(target):
            return send_from_directory(frontend_dir, path)
        return send_from_directory(frontend_dir, "index.html")

    with app.app_context():
        db.create_all()

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, host="0.0.0.0", port=int(os.getenv("PORT", 5000)))
