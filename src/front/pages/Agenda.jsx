import { useEffect, useMemo, useState } from "react";
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
// ---------------------------------------

export default function Agenda() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal "Nuevo evento"
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("13:00");
  const [color, setColor] = useState("#3f51b5");
  const [notes, setNotes] = useState("");
  const [selectedDays, setSelectedDays] = useState([]);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  // Modal "Detalles / Editar"
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

  const load = async () => {
    setLoading(true);
    const res = await apiFetch("/api/events");
    if (!res) { setLoading(false); return; }
    const data = await res.json();
    if (!res.ok || !Array.isArray(data)) {
      console.warn("No se pudo cargar eventos:", data);
      setEvents([]);
      setLoading(false);
      return;
    }
    setEvents(data.map(e => ({
      ...e,
      start: new Date(e.start),
      end: new Date(e.end)
    })));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // Apariencia de eventos según color
  const eventPropGetter = (event) => {
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

  // Abre modal "Nuevo evento" según selección
  const onSelectSlot = ({ start, end, action }) => {
    if (action === "click") {
      openModalForDays([startOfDayLocal(start)]);
      return;
    }
    const days = daysInRange(start, end);
    openModalForDays(days);
  };

  // Crear uno o varios eventos
  const createEvents = async () => {
    setFormError("");

    if (!title.trim()) {
      setFormError("Escribe un título.");
      return;
    }
    const dummy = new Date();
    if (!(withTime(dummy, endTime) > withTime(dummy, startTime))) {
      setFormError("La hora de fin debe ser posterior a la hora de inicio.");
      return;
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
      await load();
      setShowModal(false);
    } catch {
      setFormError("No se pudo crear el evento. Revisa tu conexión.");
    } finally {
      setCreating(false);
    }
  };

  // Abrir detalles
  const onSelectEvent = (event) => {
    setDetailEvent(event);
    setEditing(false);
    setEditError("");
    // precargar valores de edición
    const start = new Date(event.start);
    const end = new Date(event.end);
    setEditTitle(event.title || "");
    setEditStartTime(hhmmFromDate(start));
    setEditEndTime(hhmmFromDate(end));
    setEditColor(event.color || "#3f51b5");
    setEditNotes(event.notes || "");
    setShowDetail(true);
  };

  // Eliminar actual
  const deleteCurrentEvent = async () => {
    if (!detailEvent) return;
    if (!confirm(`¿Eliminar "${detailEvent.title}"?`)) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/events/${detailEvent.id}`, { method: "DELETE" });
      if (res?.ok) {
        await load();
        setShowDetail(false);
        setDetailEvent(null);
      }
    } finally {
      setDeleting(false);
    }
  };

  // Guardar edición
  const saveCurrentEvent = async () => {
    setEditError("");
    if (!detailEvent) return;

    if (!editTitle.trim()) {
      setEditError("El título no puede estar vacío.");
      return;
    }
    const baseDay = new Date(detailEvent.start);
    const s = withTime(baseDay, editStartTime);
    const e = withTime(baseDay, editEndTime);
    if (!(e > s)) {
      setEditError("La hora de fin debe ser posterior a la hora de inicio.");
      return;
    }

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
        await load();
        // refresca datos en modal
        setDetailEvent(prev => prev ? {
          ...prev,
          title: editTitle.trim(),
          start: s,
          end: e,
          color: editColor,
          notes: editNotes
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

  // Formatos para modal
  const fmtDia = (d) => format(d, "eeee d 'de' MMMM, yyyy", { locale: es });
  const fmtHora = (d) => format(d, "HH:mm");

  return (
    <div className="container py-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3 className="fw-semibold mb-0">Eventos y tareas</h3>
        <button className="btn btn-outline-secondary" onClick={load} disabled={loading}>
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
                events={events}
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
          <div className="card shadow-sm rounded-4 mb-4">
            <div className="card-body">
              <h5 className="mb-3">Hoy</h5>
              {events.filter(e => new Date(e.start).toDateString() === new Date().toDateString())
                .map(e => (
                  <div key={e.id} className="small border rounded px-2 py-1 mb-2 d-flex align-items-center gap-2">
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: e.color || "#3f51b5" }} />
                    {format(new Date(e.start), "HH:mm")} — {e.title}
                  </div>
                ))}
              {events.filter(e => new Date(e.start).toDateString() === new Date().toDateString()).length === 0 &&
                <div className="text-muted small">Sin eventos</div>}
            </div>
          </div>

          <div className="card shadow-sm rounded-4">
            <div className="card-body">
              <h5 className="mb-3">Esta semana</h5>
              {events.filter(e => {
                const s = new Date(e.start);
                const d = new Date();
                const inicio = startOfWeek(d, { weekStartsOn: 1 });
                const fin = addDays(inicio, 7);
                return s >= inicio && s < fin;
              }).map(e => (
                <div key={e.id} className="small border rounded px-2 py-1 mb-2 d-flex align-items-center gap-2">
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: e.color || "#3f51b5" }} />
                  {format(new Date(e.start), "eee dd HH:mm", { locale: es })} — {e.title}
                </div>
              ))}
              {events.filter(e => {
                const s = new Date(e.start);
                const d = new Date();
                const inicio = startOfWeek(d, { weekStartsOn: 1 });
                const fin = addDays(inicio, 7);
                return s >= inicio && s < fin;
              }).length === 0 && <div className="text-muted small">Sin eventos</div>}
            </div>
          </div>
        </div>
      </div>

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

      {/* Modal: Detalles / Editar / Eliminar */}
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
                      <input
                        type="text"
                        className="form-control"
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        autoFocus
                      />
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

    </div>
  );
}
