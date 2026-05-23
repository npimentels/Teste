import base64
import hashlib
import hmac
import json
from datetime import datetime, timezone, timedelta
from functools import wraps

from flask import Blueprint, request, jsonify

from models import db, Thought
from config import Config

api = Blueprint("api", __name__, url_prefix="/api")

# ── Minimal HS256 JWT (stdlib only) ──────────────────────────

def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def _b64url_decode(s: str) -> bytes:
    padding = 4 - len(s) % 4
    return base64.urlsafe_b64decode(s + "=" * (padding % 4))

def jwt_encode(payload: dict, secret: str) -> str:
    header = _b64url_encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    body = _b64url_encode(json.dumps(payload).encode())
    sig_input = f"{header}.{body}".encode()
    sig = _b64url_encode(hmac.new(secret.encode(), sig_input, hashlib.sha256).digest())
    return f"{header}.{body}.{sig}"

class TokenExpired(Exception): pass
class TokenInvalid(Exception): pass

def jwt_decode(token: str, secret: str) -> dict:
    try:
        header_b64, body_b64, sig_b64 = token.split(".")
    except ValueError:
        raise TokenInvalid("malformed token")
    sig_input = f"{header_b64}.{body_b64}".encode()
    expected_sig = _b64url_encode(hmac.new(secret.encode(), sig_input, hashlib.sha256).digest())
    if not hmac.compare_digest(expected_sig, sig_b64):
        raise TokenInvalid("bad signature")
    payload = json.loads(_b64url_decode(body_b64))
    if "exp" in payload and datetime.now(timezone.utc).timestamp() > payload["exp"]:
        raise TokenExpired("token expired")
    return payload


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "missing token"}), 401
        token = auth_header[7:]
        try:
            jwt_decode(token, Config.JWT_SECRET)
        except TokenExpired:
            return jsonify({"error": "token expired"}), 401
        except TokenInvalid:
            return jsonify({"error": "invalid token"}), 401
        return f(*args, **kwargs)
    return decorated


@api.post("/auth")
def auth():
    data = request.get_json(silent=True) or {}
    password = data.get("password", "")
    if password != Config.SECRET_PASSWORD:
        return jsonify({"error": "wrong password"}), 403
    now = datetime.now(timezone.utc).timestamp()
    payload = {
        "sub": "owner",
        "iat": now,
        "exp": now + Config.JWT_EXPIRATION_HOURS * 3600,
    }
    token = jwt_encode(payload, Config.JWT_SECRET)
    return jsonify({"token": token})


@api.get("/thoughts")
def list_thoughts():
    date_from = request.args.get("from")
    date_to = request.args.get("to")

    query = Thought.query.order_by(Thought.created_at.desc())

    if date_from:
        try:
            dt_from = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
            query = query.filter(Thought.created_at >= dt_from)
        except ValueError:
            return jsonify({"error": "invalid 'from' date"}), 400

    if date_to:
        try:
            dt_to = datetime.fromisoformat(date_to).replace(tzinfo=timezone.utc)
            query = query.filter(Thought.created_at <= dt_to)
        except ValueError:
            return jsonify({"error": "invalid 'to' date"}), 400

    thoughts = query.all()
    return jsonify([t.to_dict() for t in thoughts])


@api.post("/thoughts")
@require_auth
def create_thought():
    data = request.get_json(silent=True) or {}
    content = (data.get("content") or "").strip()
    if not content:
        return jsonify({"error": "content is required"}), 400
    thought = Thought(content=content)
    db.session.add(thought)
    db.session.commit()
    return jsonify(thought.to_dict()), 201


@api.get("/thoughts/search")
def search_thoughts():
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify([])
    pattern = f"%{q}%"
    thoughts = (
        Thought.query
        .filter(Thought.content.ilike(pattern))
        .order_by(Thought.created_at.desc())
        .all()
    )
    return jsonify([t.to_dict() for t in thoughts])
