import { useEffect, useState } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import {
  format, parse, startOfWeek, getDay,
  addDays, isBefore
} from "date-fns";
import es from "date-fns/locale/es";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { apiFetch } from "../lib/api";

const locales = { es };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales
});

// -------- Helpers --------
const startOfDayLocal = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const normalizeEndExclusiveFromRBC = (end) => {
  const e = new Date(end);
  if (e.getHours() === 0 && e.getMinutes() === 0 && e.getSeconds() === 0 && e.getMilliseconds() === 0) {
    return new Date(e.getTime() - 1);
  }
  return e;
};
const daysInRange = (start, end) => {
  const s = startOfDayLocal(start);
  const e0 = normalizeEndExclusiveFromRBC(end);
  const e = startOfDayLocal(e0);
  const days = [];
  let cur = new Date(s);
  while (!isBefore(e, cur)) { days.push(new Date(cur)); cur = addDays(cur, 1); }
  return days;
};
const withTime = (date, hhmm) => {
  const [hh, mm] = (hhmm || "12:00").split(":").map(Number);
  const d = new Date(date);
  d.setHours(hh ?? 0, mm ?? 0, 0, 0);
  return d;
};
const two = (n) => String(n).padStart(2, "0");
const hhmmFromDate = (d) => `${two(d.getHours())}:${two(d.getMinutes())}`;
const ymd = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${two(x.getMonth() + 1)}-${two(x.getDate())}`;
};
// Helpers para panel derecho
const isSameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
const inThisWeek = (d) => {
  const date = new Date(d);
  const now = new Date();
  const start = startOfWeek(now, { weekStartsOn: 1 });
  const end = addDays(start, 7);
  return date >= start && date < end;
};

// Texto superior: “Hoy es sábado, 25 de agosto a las 20:47”
const fmtTop = (d) => {
  const hoy = new Date();
  const isToday = d.toDateString() === hoy.toDateString();
  const prefix = isToday ? "Hoy es " : "Fecha: ";
  const dia = format(d, "eeee, d 'de' MMMM", { locale: es });
  const hora = format(d, "HH:mm");
  return `${prefix}${dia} a las ${hora}`;
};
// ---------------------------------------

export default function Agenda() {
  // ---- Reloj en vivo (actualiza cada 30s) ----
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // ---- DATA ----
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]); // con fecha (mapeadas a all-day)
  const [loading, setLoading] = useState(true);

  // ---- TAREAS SIN FECHA ----
  const [undated, setUndated] = useState([]); // {id,title,done,user_id}
  const [undatedInput, setUndatedInput] = useState("");
  const [undatedSaving, setUndatedSaving] = useState(false);
  const [undatedError, setUndatedError] = useState("");

  // ---- ELECCIÓN Evento/Tarea ----
  const [showChoice, setShowChoice] = useState(false);
  const [choiceDays, setChoiceDays] = useState([]);
  const [choiceDayForTask, setChoiceDayForTask] = useState(null);

  // ---- NUEVO EVENTO ----
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("13:00");
  const [color, setColor] = useState("#3f51b5");
  const [notes, setNotes] = useState("");
  const [selectedDays, setSelectedDays] = useState([]);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  // ---- DETALLE/EDICIÓN EVENTO ----
  const [showDetail, setShowDetail] = useState(false);
  const [detailEvent, setDetailEvent] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editStartTime, setEditStartTime] = useState("12:00");
  const [editEndTime, setEditEndTime] = useState("13:00");
  const [editColor, setEditColor] = useState("#3f51b5");
  const [editNotes, setEditNotes] = useState("");
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);

  // ---- CREACIÓN DE TAREAS (múltiples) ----
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskDay, setTaskDay] = useState(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskList, setTaskList] = useState([]);
  const [taskError, setTaskError] = useState("");
  const [taskSaving, setTaskSaving] = useState(false);

  // ---- DETALLE TAREA (toggle/del) ----
  const [showTaskInfo, setShowTaskInfo] = useState(false);
  const [taskDetail, setTaskDetail] = useState(null);
  const [taskMutating, setTaskMutating] = useState(false);

  // ---- EDICIÓN TAREA ----
  const [showTaskEdit, setShowTaskEdit] = useState(false);
  const [taskEditId, setTaskEditId] = useState(null);
  const [taskEditTitle, setTaskEditTitle] = useState("");
  const [taskEditDate, setTaskEditDate] = useState(""); // YYYY-MM-DD
  const [taskEditSaving, setTaskEditSaving] = useState(false);
  const [taskEditError, setTaskEditError] = useState("");

  // ------- LOAD DATA -------
  const loadCalendarFeed = async () => {
    const res = await apiFetch("/api/calendar");
    const raw = await res?.json().catch(() => []) || [];
    const normalized = (Array.isArray(raw) ? raw : []).map(it => ({
      ...it,
      start: new Date(it.start),
      end: new Date(it.end),
    }));
    setEvents(normalized.filter(x => !x.isTask));
    setTasks(normalized.filter(x => x.isTask));
  };

  const loadUndated = async () => {
    const res = await apiFetch("/api/tasks");
    const data = await res?.json().catch(() => []) || [];
    // Filtrar sin fecha (date == null)
    const und = data.filter(t => !t.date).map(t => ({
      id: t.id, title: t.title, done: !!t.done, user_id: t.user_id
    }));
    setUndated(und);
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadCalendarFeed(), loadUndated()]);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  // -------- Apariencia de eventos --------
  const eventPropGetter = (event) => {
    if (event.isTask) {
      const bg = event.color || "#9aa0a6";
      return {
        style: {
          backgroundColor: bg,
          borderColor: bg,
          color: "#fff",
          borderRadius: 8,
          padding: "2px 4px",
          opacity: 0.95,
          textDecoration: event.taskDone ? "line-through" : "none",
          fontStyle: event.taskDone ? "italic" : "normal"
        }
      };
    }
    const bg = event.color || "#3f51b5";
    return {
      style: {
        backgroundColor: bg,
        borderColor: bg,
        color: "#fff",
        borderRadius: 8,
        padding: "2px 4px",
        opacity: 0.95
      }
    };
  };

  // ---------- Selección en calendario ----------
  const onSelectSlot = ({ start, end }) => {
    const days = daysInRange(start, end);
    setChoiceDays(days);
    setChoiceDayForTask(days.length === 1 ? days[0] : null);
    setShowChoice(true);
  };

  const openModalForDays = (days) => {
    setSelectedDays(days);
    setTitle("");
    setStartTime("12:00");
    setEndTime("13:00");
    setColor("#3f51b5");
    setNotes("");
    setFormError("");
    setShowModal(true);
  };
  const closeModal = () => { if (!creating) setShowModal(false); };

  const chooseEvent = () => {
    setShowChoice(false);
    openModalForDays(choiceDays.length ? choiceDays : [startOfDayLocal(new Date())]);
  };
  const chooseTask = () => {
    if (!choiceDayForTask) return;
    setShowChoice(false);
    setTaskDay(choiceDayForTask);
    setTaskTitle("");
    setTaskList([]);
    setTaskError("");
    setShowTaskModal(true);
  };

  // ---------- Crear eventos (batch backend) ----------
  const createEvents = async () => {
    setFormError("");
    if (!title.trim()) return setFormError("Escribe un título.");

    const dummy = new Date();
    if (!(withTime(dummy, endTime) > withTime(dummy, startTime))) {
      return setFormError("La hora de fin debe ser posterior a la hora de inicio.");
    }

    setCreating(true);
    try {
      await apiFetch("/api/events/batch", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          startDay: ymd(selectedDays[0]),
          endDay: ymd(selectedDays[selectedDays.length - 1]),
          startTime,
          endTime,
          color,
          notes
        })
      });
      await loadAll();
      setShowModal(false);
    } catch {
      setFormError("No se pudo crear el evento. Revisa tu conexión.");
    } finally {
      setCreating(false);
    }
  };

  // ---------- Click en evento (evento o tarea) ----------
  const onSelectEvent = (event) => {
    if (event.isTask) {
      setTaskDetail(event);
      setShowTaskInfo(true);
      return;
    }
    // Evento normal
    setDetailEvent(event);
    setEditing(false);
    setEditError("");
    const start = new Date(event.start);
    const end = new Date(event.end);
    setEditTitle(event.title || "");
    setEditStartTime(hhmmFromDate(start));
    setEditEndTime(hhmmFromDate(end));
    setEditColor(event.color || "#3f51b5");
    setEditNotes(event.notes || "");
    setShowDetail(true);
  };

  // ---------- Eliminar evento ----------
  const deleteEventById = async (id) => {
    if (!confirm("¿Eliminar este evento?")) return;
    await apiFetch(`/api/events/${id}`, { method: "DELETE" });
    await loadAll();
  };

  const deleteCurrentEvent = async () => {
    if (!detailEvent) return;
    if (!confirm(`¿Eliminar "${detailEvent.title}"?`)) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/events/${detailEvent.id}`, { method: "DELETE" });
      if (res?.ok) {
        await loadAll();
        setShowDetail(false);
        setDetailEvent(null);
      }
    } finally {
      setDeleting(false);
    }
  };

  // ---------- Guardar edición evento ----------
  const saveCurrentEvent = async () => {
    setEditError("");
    if (!detailEvent) return;

    if (!editTitle.trim()) return setEditError("El título no puede estar vacío.");

    const baseDay = new Date(detailEvent.start);
    const s = withTime(baseDay, editStartTime);
    const e = withTime(baseDay, editEndTime);
    if (!(e > s)) return setEditError("La hora de fin debe ser posterior a la hora de inicio.");

    setSaving(true);
    try {
      const res = await apiFetch(`/api/events/${detailEvent.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: editTitle.trim(),
          start: s.toISOString(),
          end: e.toISOString(),
          color: editColor,
          notes: editNotes
        })
      });
      if (res?.ok) {
        await loadAll();
        setDetailEvent(prev => prev ? {
          ...prev, title: editTitle.trim(), start: s, end: e, color: editColor, notes: editNotes
        } : prev);
        setEditing(false);
      } else {
        const data = await res.json().catch(() => ({}));
        setEditError(data?.message || "No se pudo guardar el evento.");
      }
    } finally {
      setSaving(false);
    }
  };

  // ---------- Crear TAREAS múltiples ----------
  const addTaskToList = () => {
    setTaskError("");
    const t = taskTitle.trim();
    if (!t) return setTaskError("Escribe una tarea.");
    setTaskList(prev => [...prev, t]);
    setTaskTitle("");
  };
  const removeTask = (idx) => setTaskList(prev => prev.filter((_, i) => i !== idx));

  const saveTasks = async () => {
    setTaskError("");
    if (!taskDay) return;
    if (taskList.length === 0) return setTaskError("Agrega al menos una tarea.");
    setTaskSaving(true);
    try {
      await Promise.all(
        taskList.map(title =>
          apiFetch("/api/tasks", {
            method: "POST",
            body: JSON.stringify({ title, date: ymd(taskDay) })
          })
        )
      );
      setShowTaskModal(false);
      await loadAll();
    } catch {
      setTaskError("No se pudieron guardar las tareas.");
    } finally {
      setTaskSaving(false);
    }
  };

  // ---------- TAREAS: toggle / delete / edit ----------
  const toggleDoneTask = async (task) => {
    const id = task?.id ?? taskDetail?.id;
    await apiFetch(`/api/tasks/${id}/toggle`, { method: "POST" });
    await loadAll();
    setShowTaskInfo(false);
    setTaskDetail(null);
  };

  const deleteTask = async (task) => {
    const id = task?.id ?? taskDetail?.id;
    if (!confirm("¿Eliminar esta tarea?")) return;
    await apiFetch(`/api/tasks/${id}`, { method: "DELETE" });
    await loadAll();
    setShowTaskInfo(false);
    setTaskDetail(null);
  };

  const openEditTask = (task) => {
    setTaskEditId(task.id);
    setTaskEditTitle(task.title);
    // Si viene de "Sin fecha", no tendrá start -> fecha ""
    setTaskEditDate(task.start ? ymd(task.start) : "");
    setTaskEditError("");
    setShowTaskEdit(true);
  };

  const saveEditTask = async () => {
    setTaskEditError("");
    if (!taskEditTitle.trim()) {
      setTaskEditError("El título no puede estar vacío.");
      return;
    }
    setTaskEditSaving(true);
    try {
      const payload = { title: taskEditTitle.trim() };
      // Si taskEditDate está vacío => dejamos sin fecha (null)
      payload.date = taskEditDate || null;

      const res = await apiFetch(`/api/tasks/${taskEditId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      if (res?.ok) {
        await loadAll();
        setShowTaskEdit(false);
        setTaskEditId(null);
      } else {
        const data = await res.json().catch(() => ({}));
        setTaskEditError(data?.message || "No se pudo guardar la tarea.");
      }
    } finally {
      setTaskEditSaving(false);
    }
  };

  // ---------- SIN FECHA: crear ----------
  const addUndated = async () => {
    setUndatedError("");
    const t = undatedInput.trim();
    if (!t) { setUndatedError("Escribe una tarea."); return; }
    setUndatedSaving(true);
    try {
      const res = await apiFetch("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ title: t }) // sin date
      });
      if (!res?.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "No se pudo crear la tarea.");
      }
      setUndatedInput("");
      await loadAll();
    } catch (e) {
      setUndatedError(e.message || "Error al crear tarea.");
    } finally {
      setUndatedSaving(false);
    }
  };

  // -------- Formatos para modal --------
  const fmtDia = (d) => format(d, "eeee d 'de' MMMM, yyyy", { locale: es });
  const fmtHora = (d) => format(d, "HH:mm");

  // -------- RENDER --------
  return (
    <div className="container py-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <div className="text-muted small">{fmtTop(now)}</div>
          <h3 className="fw-semibold mb-0">Eventos y tareas</h3>
        </div>
        <button className="btn btn-outline-secondary" onClick={loadAll} disabled={loading}>
          {loading ? "Cargando..." : "Refrescar"}
        </button>
      </div>

      <div className="row g-4">
        {/* Calendario */}
        <div className="col-lg-8">
          <div className="card shadow-soft rounded-4 overflow-hidden">
            <div className="card-body p-2">
              <Calendar
                localizer={localizer}
                events={[...events, ...tasks]}
                startAccessor="start"
                endAccessor="end"
                style={{ height: 620 }}
                selectable
                popup
                onSelectSlot={onSelectSlot}
                onSelectEvent={onSelectEvent}
                culture="es"
                eventPropGetter={eventPropGetter}
                messages={{
                  today: "Hoy",
                  previous: "Atrás",
                  next: "Siguiente",
                  month: "Mes",
                  week: "Semana",
                  day: "Día",
                  agenda: "Agenda",
                  showMore: total => `+${total} más`
                }}
              />
            </div>
          </div>
        </div>

        {/* Panel derecho */}
        <div className="col-lg-4">
          {/* HOY */}
          <div className="panel-card rounded-4 mb-4">
            <div className="card-body">
              <h5 className="mb-3">Hoy</h5>

              {/* Eventos de hoy */}
              <div className="mb-2 fw-semibold small text-uppercase text-muted">Eventos</div>
              {[...events]
                .filter(e => isSameDay(e.start, new Date()))
                .map(e => (
                  <div key={`ev-hoy-${e.id}`} className="item-row d-flex align-items-center justify-content-between mb-2">
                    <div className="d-flex align-items-center gap-2">
                      <span className="badge-dot" style={{ background: e.color || "#3f51b5" }} />
                      <span>{format(new Date(e.start), "HH:mm")} — {e.title}</span>
                    </div>
                    <div className="d-flex gap-1">
                      <button className="btn btn-sm btn-outline-primary" title="Editar" onClick={() => { setDetailEvent(e); setEditing(true); setShowDetail(true); setEditTitle(e.title); setEditStartTime(hhmmFromDate(new Date(e.start))); setEditEndTime(hhmmFromDate(new Date(e.end))); setEditColor(e.color || "#3f51b5"); setEditNotes(e.notes || ""); }}>
                        ✏️
                      </button>
                      <button className="btn btn-sm btn-outline-danger" title="Eliminar" onClick={() => deleteEventById(e.id)}>
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              {[...events].filter(e => isSameDay(e.start, new Date())).length === 0 && (
                <div className="text-muted small mb-3">Sin eventos</div>
              )}

              {/* Tareas de hoy */}
              <div className="mt-3 mb-2 fw-semibold small text-uppercase text-muted">Tareas</div>
              {[...tasks]
                .filter(t => isSameDay(t.start, new Date()))
                .map(t => (
                  <div key={`tk-hoy-${t.id}`} className="item-row d-flex align-items-center justify-content-between mb-2">
                    <div className="d-flex align-items-center gap-2">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={!!t.taskDone}
                        onChange={() => toggleDoneTask(t)}
                        title={t.taskDone ? "Marcar pendiente" : "Marcar hecha"}
                      />
                      <span style={{
                        textDecoration: t.taskDone ? "line-through" : "none",
                        fontStyle: t.taskDone ? "italic" : "normal"
                      }}>{t.title}</span>
                    </div>
                    <div className="d-flex gap-1">
                      <button className="btn btn-sm btn-outline-primary" title="Editar" onClick={() => openEditTask(t)}>✏️</button>
                      <button className="btn btn-sm btn-outline-danger" title="Eliminar" onClick={() => deleteTask(t)}>🗑️</button>
                    </div>
                  </div>
                ))}
              {[...tasks].filter(t => isSameDay(t.start, new Date())).length === 0 && (
                <div className="text-muted small">Sin tareas</div>
              )}
            </div>
          </div>

          {/* ESTA SEMANA */}
          <div className="panel-card rounded-4 mb-4">
            <div className="card-body">
              <h5 className="mb-3">Esta semana</h5>

              {/* Eventos de la semana */}
              <div className="mb-2 fw-semibold small text-uppercase text-muted">Eventos</div>
              {[...events]
                .filter(e => inThisWeek(e.start))
                .map(e => (
                  <div key={`ev-week-${e.id}`} className="item-row d-flex align-items-center justify-content-between mb-2">
                    <div className="d-flex align-items-center gap-2">
                      <span className="badge-dot" style={{ background: e.color || "#3f51b5" }} />
                      <span>{format(new Date(e.start), "eee dd HH:mm", { locale: es })} — {e.title}</span>
                    </div>
                    <div className="d-flex gap-1">
                      <button className="btn btn-sm btn-outline-primary" title="Editar" onClick={() => { setDetailEvent(e); setEditing(true); setShowDetail(true); setEditTitle(e.title); setEditStartTime(hhmmFromDate(new Date(e.start))); setEditEndTime(hhmmFromDate(new Date(e.end))); setEditColor(e.color || "#3f51b5"); setEditNotes(e.notes || ""); }}>
                        ✏️
                      </button>
                      <button className="btn btn-sm btn-outline-danger" title="Eliminar" onClick={() => deleteEventById(e.id)}>
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              {[...events].filter(e => inThisWeek(e.start)).length === 0 && (
                <div className="text-muted small mb-3">Sin eventos</div>
              )}

              {/* Tareas de la semana */}
              <div className="mt-3 mb-2 fw-semibold small text-uppercase text-muted">Tareas</div>
              {[...tasks]
                .filter(t => inThisWeek(t.start))
                .map(t => (
                  <div key={`tk-week-${t.id}`} className="item-row d-flex align-items-center justify-content-between mb-2">
                    <div className="d-flex align-items-center gap-2">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={!!t.taskDone}
                        onChange={() => toggleDoneTask(t)}
                        title={t.taskDone ? "Marcar pendiente" : "Marcar hecha"}
                      />
                      <span style={{
                        textDecoration: t.taskDone ? "line-through" : "none",
                        fontStyle: t.taskDone ? "italic" : "normal"
                      }}>
                        {format(new Date(t.start), "eee dd", { locale: es })} — {t.title}
                      </span>
                    </div>
                    <div className="d-flex gap-1">
                      <button className="btn btn-sm btn-outline-primary" title="Editar" onClick={() => openEditTask(t)}>✏️</button>
                      <button className="btn btn-sm btn-outline-danger" title="Eliminar" onClick={() => deleteTask(t)}>🗑️</button>
                    </div>
                  </div>
                ))}
              {[...tasks].filter(t => inThisWeek(t.start)).length === 0 && (
                <div className="text-muted small">Sin tareas</div>
              )}
            </div>
          </div>

          {/* SIN FECHA */}
          <div className="panel-card rounded-4">
            <div className="card-body">
              <h5 className="mb-3">Sin fecha</h5>

              {/* Input para agregar */}
              <div className="d-flex gap-2">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Nueva tarea (sin fecha)"
                  value={undatedInput}
                  onChange={e => setUndatedInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addUndated(); } }}
                />
                <button className="btn btn-outline-primary" onClick={addUndated} disabled={undatedSaving}>
                  {undatedSaving ? "Agregando..." : "Agregar"}
                </button>
              </div>
              {undatedError && <div className="alert alert-danger mt-2 mb-0">{undatedError}</div>}

              {/* Lista */}
              <div className="mt-3">
                {undated.length === 0 && <div className="text-muted small">No hay tareas sin fecha.</div>}
                {undated.map(t => (
                  <div key={`tk-und-${t.id}`} className="item-row d-flex align-items-center justify-content-between mb-2">
                    <div className="d-flex align-items-center gap-2">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={!!t.done}
                        onChange={() => toggleDoneTask({ id: t.id })}
                        title={t.done ? "Marcar pendiente" : "Marcar hecha"}
                      />
                      <span style={{
                        textDecoration: t.done ? "line-through" : "none",
                        fontStyle: t.done ? "italic" : "normal"
                      }}>{t.title}</span>
                    </div>
                    <div className="d-flex gap-1">
                      {/* Al editar, reusamos el modal y permitimos asignar fecha */}
                      <button className="btn btn-sm btn-outline-primary" title="Asignar fecha / Editar" onClick={() => openEditTask({ id: t.id, title: t.title, start: null })}>✏️</button>
                      <button className="btn btn-sm btn-outline-danger" title="Eliminar" onClick={() => deleteTask({ id: t.id })}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-muted small mt-2">
                Consejo: edita una tarea para asignarle una fecha y aparecerá en el calendario.
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Modal ELECCIÓN: Evento o Tarea */}
      {showChoice && (
        <div className="modal d-block" tabIndex="-1" role="dialog" style={{ background: "rgba(0,0,0,.35)" }}>
          <div className="modal-dialog" role="document">
            <div className="modal-content rounded-4 shadow">
              <div className="modal-header">
                <h5 className="modal-title">¿Qué quieres crear?</h5>
                <button type="button" className="btn-close" onClick={() => setShowChoice(false)} aria-label="Close"></button>
              </div>
              <div className="modal-body">
                {choiceDays.length === 1 ? (
                  <p>Día seleccionado: <strong>{format(choiceDays[0], "eeee d 'de' MMMM, yyyy", { locale: es })}</strong></p>
                ) : (
                  <p>Rango seleccionado: <strong>{choiceDays.length}</strong> días.</p>
                )}
                {choiceDays.length > 1 && (
                  <div className="alert alert-info mb-0">
                    Para <strong>Tareas</strong> selecciona un único día con clic. Con rango puedes crear <strong>Eventos</strong>.
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-primary" onClick={chooseEvent}>Crear evento</button>
                <button className="btn btn-outline-secondary" onClick={chooseTask} disabled={!choiceDayForTask}>
                  Crear tarea(s)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Nuevo evento */}
      {showModal && (
        <div className="modal d-block" tabIndex="-1" role="dialog" style={{ background: "rgba(0,0,0,.35)" }}>
          <div className="modal-dialog" role="document">
            <div className="modal-content rounded-4 shadow">
              <div className="modal-header">
                <h5 className="modal-title">Nuevo evento</h5>
                <button type="button" className="btn-close" onClick={closeModal} disabled={creating} aria-label="Close"></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Título</label>
                  <input
                    type="text"
                    className="form-control"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Reunión, cita, recordatorio…"
                    autoFocus
                  />
                </div>
                <div className="row g-3">
                  <div className="col-6">
                    <label className="form-label">Hora inicio</label>
                    <input type="time" className="form-control" value={startTime} onChange={e => setStartTime(e.target.value)} step="300" />
                  </div>
                  <div className="col-6">
                    <label className="form-label">Hora fin</label>
                    <input type="time" className="form-control" value={endTime} onChange={e => setEndTime(e.target.value)} step="300" />
                  </div>
                </div>
                <div className="row g-3 mt-2">
                  <div className="col-6">
                    <label className="form-label d-block">Color</label>
                    <input type="color" className="form-control form-control-color" value={color} onChange={e => setColor(e.target.value)} title="Elige un color" />
                  </div>
                  <div className="col-12">
                    <label className="form-label">Notas</label>
                    <textarea className="form-control" rows="3" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Detalles, enlace de reunión, etc." />
                  </div>
                </div>
                {selectedDays.length > 1 && (
                  <p className="mt-3 small text-muted">
                    Se crearán <strong>{selectedDays.length}</strong> eventos (uno por cada día seleccionado) con el mismo horario.
                  </p>
                )}
                {formError && <div className="alert alert-danger mt-3 mb-0">{formError}</div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={closeModal} disabled={creating}>
                  Cancelar
                </button>
                <button type="button" className="btn btn-primary" onClick={createEvents} disabled={creating}>
                  {creating ? "Creando..." : "Crear evento"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Detalles / Editar / Eliminar (Evento) */}
      {showDetail && detailEvent && (
        <div className="modal d-block" tabIndex="-1" role="dialog" style={{ background: "rgba(0,0,0,.35)" }}>
          <div className="modal-dialog" role="document">
            <div className="modal-content rounded-4 shadow">
              <div className="modal-header">
                <h5 className="modal-title">{editing ? "Editar evento" : "Detalles del evento"}</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => { if (!deleting && !saving) { setShowDetail(false); setDetailEvent(null); setEditing(false); } }}
                  disabled={deleting || saving}
                  aria-label="Close"
                />
              </div>
              <div className="modal-body">
                {!editing ? (
                  <>
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <span style={{ width: 14, height: 14, borderRadius: 4, background: detailEvent.color || "#3f51b5" }} />
                      <h5 className="m-0">{detailEvent.title}</h5>
                    </div>
                    <div className="mb-2 text-muted">
                      <div><strong>Día:</strong> {fmtDia(new Date(detailEvent.start))}</div>
                      <div><strong>Horario:</strong> {fmtHora(new Date(detailEvent.start))} – {fmtHora(new Date(detailEvent.end))}</div>
                    </div>
                    {detailEvent.notes && (
                      <div className="mt-3">
                        <label className="form-label">Notas</label>
                        <div className="border rounded p-2 bg-light" style={{ whiteSpace: "pre-wrap" }}>
                          {detailEvent.notes}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="mb-3">
                      <label className="form-label">Título</label>
                      <input type="text" className="form-control" value={editTitle} onChange={e => setEditTitle(e.target.value)} autoFocus />
                    </div>
                    <div className="row g-3">
                      <div className="col-6">
                        <label className="form-label">Hora inicio</label>
                        <input type="time" className="form-control" value={editStartTime} onChange={e => setEditStartTime(e.target.value)} step="300" />
                      </div>
                      <div className="col-6">
                        <label className="form-label">Hora fin</label>
                        <input type="time" className="form-control" value={editEndTime} onChange={e => setEditEndTime(e.target.value)} step="300" />
                      </div>
                    </div>
                    <div className="row g-3 mt-2">
                      <div className="col-6">
                        <label className="form-label d-block">Color</label>
                        <input type="color" className="form-control form-control-color" value={editColor} onChange={e => setEditColor(e.target.value)} title="Elige un color" />
                      </div>
                      <div className="col-12">
                        <label className="form-label">Notas</label>
                        <textarea className="form-control" rows="3" value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Detalles, enlace de reunión, etc." />
                      </div>
                    </div>
                    {editError && <div className="alert alert-danger mt-3 mb-0">{editError}</div>}
                  </>
                )}
              </div>
              <div className="modal-footer justify-content-between">
                {!editing ? (
                  <>
                    <button type="button" className="btn btn-outline-secondary" onClick={() => { if (!deleting) { setShowDetail(false); setDetailEvent(null); } }} disabled={deleting}>
                      Cerrar
                    </button>
                    <div className="d-flex gap-2">
                      <button type="button" className="btn btn-outline-primary" onClick={() => setEditing(true)} disabled={deleting}>
                        Editar
                      </button>
                      <button type="button" className="btn btn-danger" onClick={deleteCurrentEvent} disabled={deleting}>
                        {deleting ? "Eliminando..." : "Eliminar"}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <button type="button" className="btn btn-outline-secondary" onClick={() => { if (!saving) { setEditing(false); setEditError(""); } }} disabled={saving}>
                      Cancelar
                    </button>
                    <button type="button" className="btn btn-primary" onClick={saveCurrentEvent} disabled={saving}>
                      {saving ? "Guardando..." : "Guardar cambios"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Crear TAREAS para un día */}
      {showTaskModal && taskDay && (
        <div className="modal d-block" tabIndex="-1" role="dialog" style={{ background: "rgba(0,0,0,.35)" }}>
          <div className="modal-dialog" role="document">
            <div className="modal-content rounded-4 shadow">
              <div className="modal-header">
                <h5 className="modal-title">Tareas para {fmtDia(taskDay)}</h5>
                <button type="button" className="btn-close" onClick={() => setShowTaskModal(false)} disabled={taskSaving} aria-label="Close"></button>
              </div>
              <div className="modal-body">
                <div className="d-flex gap-2">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Escribe una tarea y pulsa Agregar"
                    value={taskTitle}
                    onChange={e => setTaskTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTaskToList(); } }}
                    autoFocus
                  />
                  <button className="btn btn-outline-primary" type="button" onClick={addTaskToList}>Agregar</button>
                </div>

                {taskList.length > 0 && (
                  <ul className="list-group mt-3">
                    {taskList.map((t, idx) => (
                      <li key={idx} className="list-group-item d-flex justify-content-between align-items-center">
                        <span>{t}</span>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => removeTask(idx)}>&times;</button>
                      </li>
                    ))}
                  </ul>
                )}

                {taskError && <div className="alert alert-danger mt-3 mb-0">{taskError}</div>}
                {taskList.length === 0 && <div className="text-muted small mt-3">No hay tareas aún. Añade una usando el campo de arriba.</div>}
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary" onClick={() => setShowTaskModal(false)} disabled={taskSaving}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={saveTasks} disabled={taskSaving}>
                  {taskSaving ? "Guardando..." : `Guardar ${taskList.length || ""} tarea(s)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Detalle TAREA (toggle hecho / eliminar) */}
      {showTaskInfo && taskDetail && (
        <div className="modal d-block" tabIndex="-1" role="dialog" style={{ background: "rgba(0,0,0,.35)" }}>
          <div className="modal-dialog" role="document">
            <div className="modal-content rounded-4 shadow">
              <div className="modal-header">
                <h5 className="modal-title">Tarea</h5>
                <button type="button" className="btn-close" onClick={() => { if (!taskMutating) { setShowTaskInfo(false); setTaskDetail(null); } }} disabled={taskMutating} aria-label="Close"></button>
              </div>
              <div className="modal-body">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={!!taskDetail.taskDone}
                    onChange={() => toggleDoneTask(taskDetail)}
                    title={taskDetail.taskDone ? "Marcar pendiente" : "Marcar hecha"}
                  />
                  <h5 className="m-0" style={{ textDecoration: taskDetail.taskDone ? "line-through" : "none" }}>
                    {taskDetail.title}
                  </h5>
                </div>
                <div className="text-muted">
                  <div><strong>Día:</strong> {fmtDia(new Date(taskDetail.start))}</div>
                  <div><strong>Estado:</strong> {taskDetail.taskDone ? "Hecha" : "Pendiente"}</div>
                </div>
              </div>
              <div className="modal-footer justify-content-between">
                <button className="btn btn-outline-secondary" onClick={() => { if (!taskMutating) { setShowTaskInfo(false); setTaskDetail(null); } }} disabled={taskMutating}>
                  Cerrar
                </button>
                <div className="d-flex gap-2">
                  <button className="btn btn-outline-primary" onClick={() => openEditTask(taskDetail)} disabled={taskMutating}>
                    Editar
                  </button>
                  <button className="btn btn-danger" onClick={() => deleteTask(taskDetail)} disabled={taskMutating}>
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar TAREA */}
      {showTaskEdit && (
        <div className="modal d-block" tabIndex="-1" role="dialog" style={{ background: "rgba(0,0,0,.35)" }}>
          <div className="modal-dialog" role="document">
            <div className="modal-content rounded-4 shadow">
              <div className="modal-header">
                <h5 className="modal-title">Editar tarea</h5>
                <button type="button" className="btn-close" onClick={() => setShowTaskEdit(false)} disabled={taskEditSaving} aria-label="Close"></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Título</label>
                  <input
                    type="text"
                    className="form-control"
                    value={taskEditTitle}
                    onChange={e => setTaskEditTitle(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Fecha</label>
                  <input
                    type="date"
                    className="form-control"
                    value={taskEditDate}
                    onChange={e => setTaskEditDate(e.target.value)}
                    placeholder="(vacío = sin fecha)"
                  />
                  <div className="form-text">Deja vacío para mantener la tarea sin fecha.</div>
                </div>
                {taskEditError && <div className="alert alert-danger mt-2 mb-0">{taskEditError}</div>}
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary" onClick={() => setShowTaskEdit(false)} disabled={taskEditSaving}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={saveEditTask} disabled={taskEditSaving}>
                  {taskEditSaving ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
