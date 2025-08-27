"""
This module takes care of starting the API Server, Loading the DB and Adding the endpoints
"""
import os
from datetime import timedelta
from flask import Flask, request, jsonify, url_for, send_from_directory, make_response
from flask_migrate import Migrate
from api.utils import APIException, generate_sitemap
from api.models import db
from api.routes import api
from api.admin import setup_admin
from api.commands import setup_commands
from flask_jwt_extended import JWTManager
from flask_cors import CORS

ENV = "development" if os.getenv("FLASK_DEBUG") == "1" else "production"
static_file_dir = os.path.join(os.path.dirname(
    os.path.realpath(__file__)), '../dist/')

app = Flask(__name__)
app.url_map.strict_slashes = False

# ===== JWT =====
app.config["JWT_SECRET_KEY"] = os.getenv("FLASK_APP_KEY", "change-this-key")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=1)
jwt = JWTManager(app)

@jwt.unauthorized_loader
def _unauthorized_loader(msg):
    return jsonify({"message": "Missing or invalid Authorization header"}), 401

@jwt.invalid_token_loader
def _invalid_token_loader(msg):
    return jsonify({"message": "Invalid token"}), 401

@jwt.expired_token_loader
def _expired_token_loader(jwt_header, jwt_payload):
    return jsonify({"message": "Token expired"}), 401

# ===== CORS ultra-permisivo (DEV: Codespaces/local) =====
# En producción, sustituye origins="*" por tu dominio.
CORS(app, resources={r"/api/*": {
    "origins": "*",
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization"],
    "supports_credentials": False
}})

# Responde SIEMPRE a cualquier OPTIONS con cabeceras CORS
@app.before_request
def _cors_preflight():
    if request.method == "OPTIONS":
        resp = make_response("", 204)
        resp.headers["Access-Control-Allow-Origin"] = "*"
        resp.headers["Access-Control-Allow-Methods"] = request.headers.get(
            "Access-Control-Request-Method", "GET, POST, PUT, DELETE, OPTIONS"
        )
        resp.headers["Access-Control-Allow-Headers"] = request.headers.get(
            "Access-Control-Request-Headers", "Authorization, Content-Type"
        )
        resp.headers["Access-Control-Max-Age"] = "86400"
        return resp

# Asegura CORS también en todas las respuestas
@app.after_request
def _add_cors_headers(resp):
    resp.headers.setdefault("Access-Control-Allow-Origin", "*")
    resp.headers.setdefault("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    resp.headers.setdefault("Access-Control-Allow-Headers", "Content-Type, Authorization")
    return resp

# ===== DB =====
db_url = os.getenv("DATABASE_URL")
if db_url is not None:
    app.config['SQLALCHEMY_DATABASE_URI'] = db_url.replace("postgres://", "postgresql://")
else:
    app.config['SQLALCHEMY_DATABASE_URI'] = "sqlite:////tmp/test.db"

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
MIGRATE = Migrate(app, db, compare_type=True)
db.init_app(app)

# Admin / CLI
setup_admin(app)
setup_commands(app)

# API
app.register_blueprint(api, url_prefix='/api')


@app.errorhandler(APIException)
def handle_invalid_usage(error):
    return jsonify(error.to_dict()), error.status_code


@app.route('/')
def sitemap():
    if ENV == "development":
        return generate_sitemap(app)
    return send_from_directory(static_file_dir, 'index.html')


@app.route('/<path:path>', methods=['GET'])
def serve_any_other_file(path):
    if not os.path.isfile(os.path.join(static_file_dir, path)):
        path = 'index.html'
    response = send_from_directory(static_file_dir, path)
    response.cache_control.max_age = 0
    return response


if __name__ == '__main__':
    PORT = int(os.environ.get('PORT', 3001))
    app.run(host='0.0.0.0', port=PORT, debug=True)
