"""
This module takes care of starting the API Server, Loading the DB and Adding the endpoints
"""
from flask import request, jsonify, Blueprint
from api.models import db, User
from api.utils import APIException
from flask_cors import CORS
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from datetime import timedelta
from datetime import datetime
from api.models import Event
from flask_jwt_extended import jwt_required, get_jwt_identity

api = Blueprint('api', __name__)

CORS(api)

@api.route('/hello', methods=['GET'])
def handle_hello():
    response_body = {
        "message": "Hello! I'm a message that came from the backend, check the network tab on the google inspector and you will see the GET request"
    }
    return jsonify(response_body), 200


@api.route('/signup', methods=['POST'])
def signup():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password')

    if not email or not password:
        raise APIException("Email and password are required", 400)

    if User.query.filter_by(email=email).first():
        raise APIException("User already exists", 409)

    user = User(email=email, is_active=True)
    user.set_password(password)  # guarda hash
    db.session.add(user)
    db.session.commit()

    return jsonify({"msg": "User created successfully"}), 201


@api.route('/token', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password')

    if not email or not password:
        raise APIException("Email and password are required", 400)

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        raise APIException("Invalid credentials", 401)

    access_token = create_access_token(identity=str(user.id), expires_delta=timedelta(hours=1))
    return jsonify({"access_token": access_token, "user": user.serialize()}), 200


@api.route('/private', methods=['GET'])
@jwt_required()
def private():
    user_id = get_jwt_identity()  # viene como string porque así lo generamos
    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        raise APIException("Invalid token subject", 401)

    user = User.query.get(user_id)
    if not user:
        raise APIException("User not found", 404)

    return jsonify({"msg": f"Welcome, {user.email}!", "user": user.serialize()}), 200


def _uid() -> int:
    uid = get_jwt_identity()
    try: return int(uid)
    except: raise APIException("Invalid token subject", 401)

@api.route('/events', methods=['GET'])
@jwt_required()
def list_events():
    uid = _uid()
    items = Event.query.filter_by(user_id=uid).order_by(Event.start.asc()).all()
    return jsonify([e.serialize() for e in items]), 200

@api.route('/events', methods=['POST'])
@jwt_required()
def create_event():
    uid = _uid()
    data = request.get_json() or {}
    try:
        start = datetime.fromisoformat(data['start'])
        end = datetime.fromisoformat(data['end'])
    except Exception:
        raise APIException("Invalid date format. Use ISO 8601.", 400)

    ev = Event(
        user_id=uid,
        title=(data.get('title') or '').strip() or 'Evento',
        start=start, end=end,
        all_day=bool(data.get('allDay', False)),
        color=data.get('color'),
        notes=data.get('notes')
    )
    db.session.add(ev); db.session.commit()
    return jsonify(ev.serialize()), 201

@api.route('/events/<int:event_id>', methods=['PUT'])
@jwt_required()
def update_event(event_id):
    uid = _uid()
    ev = Event.query.filter_by(id=event_id, user_id=uid).first()
    if not ev: raise APIException("Event not found", 404)
    data = request.get_json() or {}
    if 'title' in data: ev.title = data['title']
    if 'start' in data: ev.start = datetime.fromisoformat(data['start'])
    if 'end'   in data: ev.end   = datetime.fromisoformat(data['end'])
    if 'allDay' in data: ev.all_day = bool(data['allDay'])
    if 'color' in data: ev.color = data['color']
    if 'notes' in data: ev.notes = data['notes']
    db.session.commit()
    return jsonify(ev.serialize()), 200

@api.route('/events/<int:event_id>', methods=['DELETE'])
@jwt_required()
def delete_event(event_id):
    uid = _uid()
    ev = Event.query.filter_by(id=event_id, user_id=uid).first()
    if not ev: raise APIException("Event not found", 404)
    db.session.delete(ev); db.session.commit()
    return jsonify({"msg":"deleted"}), 200