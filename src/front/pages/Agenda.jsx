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
// ---------------------------------------

export default function Agenda() {
  // ---- DATA ----
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

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

  // ------- LOAD DATA -------
  const loadEvents = async () => {
    const res = await apiFetch("/api/events");
    if (!res) return [];
    const data = await res.json().catch(() => []);
    if (!Array.isArray(data)) return [];
    return data.map(e => ({ ...e, start: new Date(e.start), end: new Date(e.end), isTask: false }));
  };

  const loadTasks = async () => {
    const res = await apiFetch("/api/tasks");
    if (!res) return [];
    const data = await res.json().catch(() => []);
    if (!Array.isArray(data)) return [];
    // Mapear tareas a eventos all-day (end = start + 1 día para RBC)
    return data.map(t => {
      const start = startOfDayLocal(new Date(t.date ?? new Date()));
      const end = addDays(start, 1);
      return {
        id: t.id,
        title: t.title,
        start,
        end,
        allDay: true,
        color: t.done ? "#6c9c7b" : "#9aa0a6", // hecho: verde suave, pendiente: gris
        notes: null,
        user_id: t.user_id,
        isTask: true,
        taskDone: !!t.done,
        _rawTask: t
      };
    });
  };

  const loadAll = async () => {
    setLoading(true);
    const [evs, tks] = await Promise.all([loadEvents(), loadTasks()]);
    setEvents(evs);
    setTasks(tks);
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

  // ---------- Crear eventos ----------
  const createEvents = async () => {
    setFormError("");
    if (!title.trim()) return setFormError("Escribe un título.");

    const dummy = new Date();
    if (!(withTime(dummy, endTime) > withTime(dummy, startTime))) {
      return setFormError("La hora de fin debe ser posterior a la hora de inicio.");
    }

    setCreating(true);
    try {
      await Promise.all(selectedDays.map(day => {
        const start = withTime(day, startTime);
        const end = withTime(day, endTime);
        return apiFetch("/api/events", {
          method: "POST",
          body: JSON.stringify({
            title: title.trim(),
            start: start.toISOString(),
            end: end.toISOString(),
            allDay: false,
            color,
            notes
          })
        });
      }));
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

  // ---------- Detalle TAREA: toggle & delete ----------
  const toggleDoneTask = async () => {
    if (!taskDetail) return;
    setTaskMutating(true);
    try {
      const res = await apiFetch(`/api/tasks/${taskDetail.id}`, {
        method: "PUT",
        body: JSON.stringify({ done: !taskDetail.taskDone })
      });
      if (res?.ok) {
        await loadAll();
        setShowTaskInfo(false);
        setTaskDetail(null);
      }
    } finally {
      setTaskMutating(false);
    }
  };

  const deleteTask = async () => {
    if (!taskDetail) return;
    if (!confirm(`¿Eliminar tarea "${taskDetail.title}"?`)) return;
    setTaskMutating(true);
    try {
      const res = await apiFetch(`/api/tasks/${taskDetail.id}`, { method: "DELETE" });
      if (res?.ok) {
        await loadAll();
        setShowTaskInfo(false);
        setTaskDetail(null);
      }
    } finally {
      setTaskMutating(false);
    }
  };

  // -------- Formatos para modal --------
  const fmtDia = (d) => format(d, "eeee d 'de' MMMM, yyyy", { locale: es });
  const fmtHora = (d) => format(d, "HH:mm");

  // -------- RENDER --------
  return (
    <div className="container py-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3 className="fw-semibold mb-0">Eventos y tareas</h3>
        <button className="btn btn-outline-secondary" onClick={loadAll} disabled={loading}>
          {loading ? "Cargando..." : "Refrescar"}
        </button>
      </div>

      <div className="row g-4">
        {/* Calendario */}
        <div className="col-lg-8">
          <div className="card shadow-sm rounded-4 overflow-hidden">
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
          <div className="card shadow-sm rounded-4 mb-4">
            <div className="card-body">
              <h5 className="mb-3">Hoy</h5>

              {/* Eventos de hoy */}
              <div className="mb-2 fw-semibold small text-uppercase text-muted">Eventos</div>
              {[...events]
                .filter(e => isSameDay(e.start, new Date()))
                .map(e => (
                  <div key={`ev-hoy-${e.id}`} className="small border rounded px-2 py-1 mb-2 d-flex align-items-center gap-2">
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: e.color || "#3f51b5" }} />
                    {format(new Date(e.start), "HH:mm")} — {e.title}
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
                  <div
                    key={`tk-hoy-${t.id}`}
                    className="small border rounded px-2 py-1 mb-2 d-flex align-items-center gap-2"
                    title={t.taskDone ? "Hecha" : "Pendiente"}
                    style={{ textDecoration: t.taskDone ? "line-through" : "none", fontStyle: t.taskDone ? "italic" : "normal" }}
                  >
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: t.color || "#9aa0a6" }} />
                    {t.title}
                  </div>
                ))}
              {[...tasks].filter(t => isSameDay(t.start, new Date())).length === 0 && (
                <div className="text-muted small">Sin tareas</div>
              )}
            </div>
          </div>

          {/* ESTA SEMANA */}
          <div className="card shadow-sm rounded-4">
            <div className="card-body">
              <h5 className="mb-3">Esta semana</h5>

              {/* Eventos de la semana */}
              <div className="mb-2 fw-semibold small text-uppercase text-muted">Eventos</div>
              {[...events]
                .filter(e => inThisWeek(e.start))
                .map(e => (
                  <div key={`ev-week-${e.id}`} className="small border rounded px-2 py-1 mb-2 d-flex align-items-center gap-2">
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: e.color || "#3f51b5" }} />
                    {format(new Date(e.start), "eee dd HH:mm", { locale: es })} — {e.title}
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
                  <div
                    key={`tk-week-${t.id}`}
                    className="small border rounded px-2 py-1 mb-2 d-flex align-items-center gap-2"
                    title={t.taskDone ? "Hecha" : "Pendiente"}
                    style={{ textDecoration: t.taskDone ? "line-through" : "none", fontStyle: t.taskDone ? "italic" : "normal" }}
                  >
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: t.color || "#9aa0a6" }} />
                    {format(new Date(t.start), "eee dd", { locale: es })} — {t.title}
                  </div>
                ))}
              {[...tasks].filter(t => inThisWeek(t.start)).length === 0 && (
                <div className="text-muted small">Sin tareas</div>
              )}
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
                  <span style={{ width: 14, height: 14, borderRadius: 4, background: taskDetail.color || "#9aa0a6" }} />
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
                  <button className="btn btn-outline-primary" onClick={toggleDoneTask} disabled={taskMutating}>
                    {taskDetail.taskDone ? "Marcar pendiente" : "Marcar hecha"}
                  </button>
                  <button className="btn btn-danger" onClick={deleteTask} disabled={taskMutating}>
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
