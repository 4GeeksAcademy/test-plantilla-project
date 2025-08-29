# src/api/models.py
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import String, Boolean, ForeignKey, DateTime, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, date as PyDate  # ← tipos Python para anotaciones

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = "user"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    password: Mapped[str] = mapped_column(nullable=False)  # se almacena hash
    is_active: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)

    # relaciones
    events = relationship("Event", back_populates="user", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="user", cascade="all, delete-orphan")

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
    __tablename__ = "event"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(150), nullable=False)

    # Anotaciones con tipos Python; columnas con tipos SQLAlchemy:
    start: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    end: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)

    all_day: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=False)
    color: Mapped[str] = mapped_column(String(20), nullable=True)     # color personalizado
    notes: Mapped[str] = mapped_column(String(500), nullable=True)    # notas opcionales

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
    __tablename__ = "task"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    done: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=False)

    # Anotación Python (datetime.date) + columna SQLAlchemy Date:
    date: Mapped[PyDate] = mapped_column(Date, nullable=True)

    user = relationship("User", back_populates="tasks")

    def serialize(self):
        return {
            "id": self.id,
            "title": self.title,
            "done": self.done,
            "date": self.date.isoformat() if self.date else None,
            "user_id": self.user_id
        }
