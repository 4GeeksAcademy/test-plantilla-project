import { useEffect, useMemo, useState } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, startOfDay, endOfDay } from "date-fns";
import es from "date-fns/locale/es";
import "react-big-calendar/lib/css/react-big-calendar.css"; // ⬅️ estilos del calendario
import { apiFetch } from "../lib/api"; // helper de fetch con token

const locales = { es };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales
});

export default function Agenda() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await apiFetch("/api/events");
    const data = res ? await res.json() : [];
    setEvents((data || []).map(e => ({
      ...e,
      start: new Date(e.start),
      end: new Date(e.end)
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const components = useMemo(() => ({
    event: ({ event }) => (
      <div title={event.notes || ""} style={{ borderRadius: 8, padding: 2 }}>
        <div style={{ opacity: .95 }}>{event.title}</div>
      </div>
    )
  }), []);

  const onSelectSlot = async ({ start, end, action }) => {
    // Si se hizo click simple en un día, crea un evento de "todo el día"
    if (action === "click") {
      start = startOfDay(start);
      end = endOfDay(start);
    }
    const title = prompt("Título del evento:");
    if (!title) return;

    const res = await apiFetch("/api/events", {
      method: "POST",
      body: JSON.stringify({
        title,
        start: start.toISOString(),
        end: end.toISOString()
      })
    });
    if (res?.ok) load();
  };

  const onSelectEvent = async (event) => {
    const del = confirm(`¿Eliminar "${event.title}"?`);
    if (!del) return;
    const res = await apiFetch(`/api/events/${event.id}`, { method: "DELETE" });
    if (res?.ok) load();
  };

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
                onSelectSlot={onSelectSlot}
                onSelectEvent={onSelectEvent}
                popup
                culture="es"
                components={components}
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
              {events.filter(e => {
                const s = new Date(e.start);
                const d = new Date();
                return s.toDateString() === d.toDateString();
              }).map(e => (
                <div key={e.id} className="small border rounded px-2 py-1 mb-2">
                  {format(new Date(e.start), "HH:mm")} — {e.title}
                </div>
              ))}
              {events.filter(e => {
                const s = new Date(e.start);
                const d = new Date();
                return s.toDateString() === d.toDateString();
              }).length === 0 && <div className="text-muted small">Sin eventos</div>}
            </div>
          </div>

          <div className="card shadow-sm rounded-4">
            <div className="card-body">
              <h5 className="mb-3">Esta semana</h5>
              {events.filter(e => {
                const s = new Date(e.start);
                const d = new Date();
                const inicio = startOfWeek(d, { weekStartsOn: 1 });
                const fin = new Date(inicio); fin.setDate(fin.getDate() + 7);
                return s >= inicio && s < fin;
              }).map(e => (
                <div key={e.id} className="small border rounded px-2 py-1 mb-2">
                  {format(new Date(e.start), "eee dd HH:mm", { locale: es })} — {e.title}
                </div>
              ))}
              {events.filter(e => {
                const s = new Date(e.start);
                const d = new Date();
                const inicio = startOfWeek(d, { weekStartsOn: 1 });
                const fin = new Date(inicio); fin.setDate(fin.getDate() + 7);
                return s >= inicio && s < fin;
              }).length === 0 && <div className="text-muted small">Sin eventos</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
