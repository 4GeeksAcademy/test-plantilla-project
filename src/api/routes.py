"""
API routes: auth (signup/login), private, events CRUD, tasks CRUD.
Incluye:
- /api/events/batch   → creación de múltiples eventos (uno por día)
- /api/tasks/<id>/toggle → toggle de tarea (hecha/pendiente)
- /api/calendar       → feed unificado (eventos + tareas como all-day)
"""
from flask import request, jsonify, Blueprint
from flask_cors import cross_origin
from api.models import db, User, Event, Task
from api.utils import APIException
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from datetime import datetime, timedelta, date

api = Blueprint('api', __name__)

# -------------------- Helpers --------------------

def _uid() -> int:
    identity = get_jwt_identity()
    try:
        return int(identity)
    except (TypeError, ValueError):
        raise APIException("Invalid token subject", 401)

def parse_iso(dt: str) -> datetime:
    if not isinstance(dt, str):
        raise APIException("Invalid date", 400)
    if dt.endswith("Z"):
        dt = dt[:-1] + "+00:00"
    try:
        d = datetime.fromisoformat(dt)
        if d.tzinfo is not None:
            d = d.astimezone(tz=None).replace(tzinfo=None)
        return d
    except Exception:
        raise APIException("Invalid date format. Use ISO 8601.", 400)

def _parse_date_yyyy_mm_dd(s: str) -> date:
    if s in (None, ""):
        return None
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except Exception:
        raise APIException("Invalid date (expected YYYY-MM-DD)", 400)

# Check de solapes (opcional pero útil)
from sqlalchemy import and_
def _overlaps(uid: int, start: datetime, end: datetime, exclude_id: int | None = None) -> bool:
    q = Event.query.filter_by(user_id=uid).filter(and_(Event.start < end, Event.end > start))
    if exclude_id:
        q = q.filter(Event.id != exclude_id)
    return q.first() is not None

# -------------------- Demo --------------------

@api.route('/hello', methods=['GET'])
def handle_hello():
    return jsonify({
        "message": "Hello! I'm a message that came from the backend, check the network tab on the google inspector and you will see the GET request"
    }), 200

# -------------------- Auth --------------------

@api.route('/signup', methods=['POST', 'OPTIONS'])
@cross_origin(origins="*", methods=["POST", "OPTIONS"],
              allow_headers=["Content-Type", "Authorization"])
def signup():
    if request.method == "OPTIONS":
        return ("", 204)

    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password')

    if not email or not password:
        raise APIException("Email and password are required", 400)

    if User.query.filter_by(email=email).first():
        raise APIException("User already exists", 409)

    user = User(email=email, is_active=True)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    return jsonify({"msg": "User created successfully"}), 201


@api.route('/token', methods=['POST', 'OPTIONS'])
@cross_origin(origins="*", methods=["POST", "OPTIONS"],
              allow_headers=["Content-Type", "Authorization"])
def login():
    if request.method == "OPTIONS":
        return ("", 204)

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
@cross_origin(origins="*", methods=["GET"], allow_headers=["Content-Type", "Authorization"])
def private():
    user_id = _uid()
    user = User.query.get(user_id)
    if not user:
        raise APIException("User not found", 404)
    return jsonify({"msg": f"Welcome, {user.email}!", "user": user.serialize()}), 200

# -------------------- Events CRUD --------------------

@api.route('/events', methods=['GET', 'POST', 'OPTIONS'])
@cross_origin(origins="*", methods=["GET", "POST", "OPTIONS"],
              allow_headers=["Content-Type", "Authorization"])
@jwt_required(optional=True)  # si quieres exigir token para GET, quita 'optional'
def events_collection():
    if request.method == "OPTIONS":
        return ("", 204)

    if request.method == "GET":
        uid = _uid()
        items = Event.query.filter_by(user_id=uid).order_by(Event.start.asc()).all()
        return jsonify([e.serialize() for e in items]), 200

    # POST
    uid = _uid()
    data = request.get_json() or {}
    title = (data.get('title') or '').strip()
    if not title:
        raise APIException("Title is required", 400)

    try:
        start = parse_iso(data['start'])
        end = parse_iso(data['end'])
    except KeyError:
        raise APIException("start and end are required", 400)

    if end <= start:
        raise APIException("end must be greater than start", 400)

    # opcional: bloquear solapes
    # if _overlaps(uid, start, end):
    #     raise APIException("Event overlaps with another one", 409)

    ev = Event(
        user_id=uid,
        title=title,
        start=start,
        end=end,
        all_day=bool(data.get('allDay', False)),
        color=data.get('color'),
        notes=data.get('notes')
    )
    db.session.add(ev)
    db.session.commit()
    return jsonify(ev.serialize()), 201


@api.route('/events/<int:event_id>', methods=['PUT', 'DELETE', 'OPTIONS'])
@cross_origin(origins="*", methods=["PUT", "DELETE", "OPTIONS"],
              allow_headers=["Content-Type", "Authorization"])
@jwt_required()
def event_item(event_id):
    if request.method == "OPTIONS":
        return ("", 204)

    uid = _uid()
    ev = Event.query.filter_by(id=event_id, user_id=uid).first()
    if not ev:
        raise APIException("Event not found", 404)

    if request.method == "DELETE":
        db.session.delete(ev)
        db.session.commit()
        return jsonify({"msg": "deleted"}), 200

    # PUT
    data = request.get_json() or {}

    if 'title' in data:
        title = (data.get('title') or '').strip()
        if not title:
            raise APIException("Title cannot be empty", 400)
        ev.title = title

    if 'start' in data:
        ev.start = parse_iso(data['start'])
    if 'end' in data:
        ev.end = parse_iso(data['end'])
    if ('start' in data) or ('end' in data):
        if ev.end <= ev.start:
            raise APIException("end must be greater than start", 400)
        # if _overlaps(uid, ev.start, ev.end, exclude_id=ev.id):
        #     raise APIException("Event overlaps with another one", 409)

    if 'allDay' in data:
        ev.all_day = bool(data['allDay'])
    if 'color' in data:
        ev.color = data['color']
    if 'notes' in data:
        ev.notes = data['notes']

    db.session.commit()
    return jsonify(ev.serialize()), 200

# --------- NUEVO: batch de eventos (uno por día) ---------

@api.route('/events/batch', methods=['POST', 'OPTIONS'])
@cross_origin(origins="*", methods=["POST", "OPTIONS"],
              allow_headers=["Content-Type", "Authorization"])
@jwt_required()
def events_batch():
    if request.method == "OPTIONS":
        return ("", 204)

    uid = _uid()
    data = request.get_json() or {}

    title = (data.get('title') or '').strip()
    if not title:
        raise APIException("Title is required", 400)

    try:
        start_day_str = data['startDay']   # "YYYY-MM-DD"
        end_day_str   = data['endDay']     # "YYYY-MM-DD" (inclusive)
        start_hhmm    = data['startTime']  # "HH:MM"
        end_hhmm      = data['endTime']    # "HH:MM"
    except KeyError:
        raise APIException("startDay, endDay, startTime, endTime are required", 400)

    # validar horas
    try:
        sh, sm = [int(x) for x in start_hhmm.split(":")]
        eh, em = [int(x) for x in end_hhmm.split(":")]
    except Exception:
        raise APIException("Invalid time (use HH:MM)", 400)

    if (eh, em) <= (sh, sm):
        raise APIException("endTime must be greater than startTime", 400)

    # rango de días
    from datetime import timedelta as TD
    try:
        s_day = datetime.strptime(start_day_str, "%Y-%m-%d").date()
        e_day = datetime.strptime(end_day_str, "%Y-%m-%d").date()
    except Exception:
        raise APIException("Days must be YYYY-MM-DD", 400)

    if e_day < s_day:
        raise APIException("endDay must be >= startDay", 400)

    created = []
    cur = s_day
    while cur <= e_day:
        start_dt = datetime(cur.year, cur.month, cur.day, sh, sm, 0)
        end_dt   = datetime(cur.year, cur.month, cur.day, eh, em, 0)

        # if _overlaps(uid, start_dt, end_dt):
        #     cur += TD(days=1); continue  # o lanza 409 si prefieres estricta

        ev = Event(
            user_id=uid,
            title=title,
            start=start_dt,
            end=end_dt,
            all_day=False,
            color=data.get('color'),
            notes=data.get('notes')
        )
        db.session.add(ev)
        created.append(ev)
        cur += TD(days=1)

    db.session.commit()
    return jsonify([e.serialize() for e in created]), 201

# -------------------- Tasks CRUD --------------------

@api.route('/tasks', methods=['GET', 'POST', 'OPTIONS'])
@cross_origin(origins="*", methods=["GET", "POST", "OPTIONS"],
              allow_headers=["Content-Type", "Authorization"])
@jwt_required(optional=True)
def tasks_collection():
    if request.method == "OPTIONS":
        return ("", 204)

    if request.method == "GET":
        uid = _uid()
        q = Task.query.filter_by(user_id=uid).order_by(Task.id.desc())
        d = request.args.get("date")
        if d:
            the_day = _parse_date_yyyy_mm_dd(d)
            q = q.filter(Task.date == the_day)
        items = q.all()
        return jsonify([t.serialize() for t in items]), 200

    # POST
    uid = _uid()
    data = request.get_json() or {}
    title = (data.get("title") or "").strip()
    if not title:
        raise APIException("Title is required", 400)
    task_date = _parse_date_yyyy_mm_dd(data.get("date")) if "date" in data else None

    t = Task(user_id=uid, title=title, done=bool(data.get("done", False)), date=task_date)
    db.session.add(t)
    db.session.commit()
    return jsonify(t.serialize()), 201


@api.route('/tasks/<int:task_id>', methods=['PUT', 'DELETE', 'OPTIONS'])
@cross_origin(origins="*", methods=["PUT", "DELETE", "OPTIONS"],
              allow_headers=["Content-Type", "Authorization"])
@jwt_required()
def task_item(task_id):
    if request.method == "OPTIONS":
        return ("", 204)

    uid = _uid()
    t = Task.query.filter_by(id=task_id, user_id=uid).first()
    if not t:
        raise APIException("Task not found", 404)

    if request.method == "DELETE":
        db.session.delete(t)
        db.session.commit()
        return jsonify({"msg": "deleted"}), 200

    # PUT
    data = request.get_json() or {}

    if "title" in data:
        title = (data.get("title") or "").strip()
        if not title:
            raise APIException("Title cannot be empty", 400)
        t.title = title

    if "done" in data:
        t.done = bool(data.get("done"))

    if "date" in data:
        t.date = _parse_date_yyyy_mm_dd(data["date"]) if data["date"] else None

    db.session.commit()
    return jsonify(t.serialize()), 200

# --------- NUEVO: toggle de tarea ---------

@api.route('/tasks/<int:task_id>/toggle', methods=['POST', 'OPTIONS'])
@cross_origin(origins="*", methods=["POST", "OPTIONS"],
              allow_headers=["Content-Type", "Authorization"])
@jwt_required()
def task_toggle(task_id):
    if request.method == "OPTIONS":
        return ("", 204)

    uid = _uid()
    t = Task.query.filter_by(id=task_id, user_id=uid).first()
    if not t:
        raise APIException("Task not found", 404)
    t.done = not bool(t.done)
    db.session.commit()
    return jsonify(t.serialize()), 200

# --------------- NUEVO: feed unificado ---------------

@api.route('/calendar', methods=['GET'])
@cross_origin(origins="*", methods=["GET"],
              allow_headers=["Content-Type", "Authorization"])
@jwt_required()
def calendar_feed():
    uid = _uid()

    # Rango opcional por query ?from=YYYY-MM-DD&to=YYYY-MM-DD
    from datetime import timedelta as TD
    dfrom = request.args.get("from")
    dto   = request.args.get("to")

    q_events = Event.query.filter_by(user_id=uid)
    q_tasks  = Task.query.filter_by(user_id=uid)

    if dfrom:
        s = datetime.strptime(dfrom, "%Y-%m-%d")
        q_events = q_events.filter(Event.start >= s)
        q_tasks  = q_tasks.filter(Task.date >= s.date())
    if dto:
        e = datetime.strptime(dto, "%Y-%m-%d") + TD(days=1)  # exclusivo
        q_events = q_events.filter(Event.start < e)
        q_tasks  = q_tasks.filter(Task.date < e.date())

    evs = [e.serialize() | {"isTask": False, "taskDone": False} for e in q_events.order_by(Event.start.asc()).all()]

    tasks = []
    for t in q_tasks.order_by(Task.id.desc()).all():
        if t.date is None:
            continue
        sdt = datetime(t.date.year, t.date.month, t.date.day, 0, 0, 0)
        edt = sdt + TD(days=1)
        tasks.append({
            "id": t.id,
            "title": t.title,
            "start": sdt.isoformat(),
            "end": edt.isoformat(),
            "allDay": True,
            "color": "#6c9c7b" if t.done else "#9aa0a6",
            "notes": None,
            "user_id": t.user_id,
            "isTask": True,
            "taskDone": bool(t.done)
        })

    return jsonify(evs + tasks), 200
