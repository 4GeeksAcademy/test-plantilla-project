from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import String, Boolean, ForeignKey, DateTime, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()


class User(db.Model):
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    password: Mapped[str] = mapped_column(nullable=False)  # se almacena hash
    is_active: Mapped[bool] = mapped_column(Boolean(), nullable=False)

    # relación con eventos
    events = relationship("Event", back_populates="user", cascade="all, delete-orphan")

    # Helpers de seguridad
    def set_password(self, raw_password: str):
        self.password = generate_password_hash(raw_password)

    def check_password(self, raw_password: str) -> bool:
        return check_password_hash(self.password, raw_password)

    def serialize(self):
        return {
            "id": self.id,
            "email": self.email,
        }


class Event(db.Model):
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    start: Mapped[DateTime] = mapped_column(DateTime(timezone=False), nullable=False)
    end: Mapped[DateTime] = mapped_column(DateTime(timezone=False), nullable=False)
    all_day: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=False)
    color: Mapped[str] = mapped_column(String(20), nullable=True)     # ⬅️ color personalizado
    notes: Mapped[str] = mapped_column(String(500), nullable=True)    # ⬅️ notas opcionales

    # relación inversa
    user = relationship("User", back_populates="events")

    def serialize(self):
        return {
            "id": self.id,
            "title": self.title,
            "start": self.start.isoformat(),
            "end": self.end.isoformat(),
            "allDay": self.all_day,
            "color": self.color,
            "notes": self.notes,
            "user_id": self.user_id
        }

class Task(db.Model):
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    done: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=False)
    date: Mapped[Date] = mapped_column(nullable=True)  # día al que pertenece la tarea (opcional)

    user = relationship("User")
    tasks = relationship("Task", cascade="all, delete-orphan")


    def serialize(self):
        return {
            "id": self.id,
            "title": self.title,
            "done": self.done,
            "date": self.date.isoformat() if self.date else None
        }