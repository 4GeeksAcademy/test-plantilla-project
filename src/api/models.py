from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from werkzeug.security import generate_password_hash, check_password_hash  # ⬅️ NUEVO

db = SQLAlchemy()

class User(db.Model):
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    password: Mapped[str] = mapped_column(nullable=False)  # almacenamos hash
    is_active: Mapped[bool] = mapped_column(Boolean(), nullable=False)

    # ⬇️ Helpers de seguridad
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
    color: Mapped[str] = mapped_column(String(20), nullable=True)
    notes: Mapped[str] = mapped_column(String(500), nullable=True)

    user = relationship("User")

    def serialize(self):
        return {
            "id": self.id,
            "title": self.title,
            "start": self.start.isoformat(),
            "end": self.end.isoformat(),
            "allDay": self.all_day,
            "color": self.color,
            "notes": self.notes
        }