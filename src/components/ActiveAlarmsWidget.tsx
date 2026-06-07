// src/components/ActiveAlarmsWidget.tsx
import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "../config";

interface AlarmEvent {
  id: number;
  variable: string;
  deviceLabel: string;
  value: number;
  severity: number;      // 1 = baja, 2 = media, 3 = alta
  firedAt: string;
}

interface ActiveAlarmsWidgetProps {
  compact?: boolean;     // true = versión chiquita (Dashboard)
}

const EVENTS_URL = `${API_BASE_URL}/api/eventos-alarma/activos`;

const formatDateTime = (value: string) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getVariableLabel = (v: string) => {
  const key = v.toLowerCase();
  switch (key) {
    case "co2":
      return "CO₂ (ppm)";
    case "co":
      return "CO (ppm)";
    case "voc":
      return "VOC (ppb)";
    case "nox":
      return "NOx (ppb)";
    case "temperatura":
      return "Temperatura (°C)";
    case "humedad":
      return "Humedad (%)";
    default:
      return key.toUpperCase();
  }
};

const getSeverityStyles = (severity: number) => {
  switch (severity) {
    case 3:
      return {
        label: "SEVERIDAD ALTA",
        badgeClass: "text-red-700",
        cardClass: "border-l-4 border-red-400 bg-red-50",
      };
    case 2:
      return {
        label: "SEVERIDAD MEDIA",
        badgeClass: "text-amber-700",
        cardClass: "border-l-4 border-amber-300 bg-amber-50",
      };
    default:
      return {
        label: "SEVERIDAD BAJA",
        badgeClass: "text-sky-700",
        cardClass: "border-l-4 border-sky-300 bg-sky-50",
      };
  }
};

const ActiveAlarmsWidget: React.FC<ActiveAlarmsWidgetProps> = ({
  compact = false,
}) => {
  const [events, setEvents] = useState<AlarmEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(EVENTS_URL);
        if (!res.ok) {
          throw new Error("Error al cargar eventos de alarma");
        }
        const data = await res.json();

        const mapped: AlarmEvent[] = data.map((e: any) => ({
          id:
            e.id_evento_alarma ??
            e.id ??
            e.idEvento ??
            Number(new Date()) + Math.random(),
          variable: (e.nombre_variable ?? e.variable ?? "").toLowerCase(),
          deviceLabel:
            e.nombre_dispositivo ??
            (e.id_dispositivo
              ? `Dispositivo #${e.id_dispositivo}`
              : "Dispositivo"),
          value: Number(e.valor ?? 0),
          severity: Number(e.nivel_severidad ?? 1),
          firedAt: e.fecha_disparo ?? e.fecha ?? "",
        }));

        setEvents(mapped);
      } catch (err: any) {
        console.error(err);
        setError(err.message ?? "Error desconocido al cargar alarmas");
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const handleResolve = async (id: number) => {
    setResolvingId(id);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/eventos-alarma/${id}/resolver`,
        { method: "PATCH" }
      );
      if (!res.ok) {
        throw new Error("Error al marcar la alarma como resuelta");
      }

      // Quitamos la alarma de la lista local
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Error al marcar como resuelta");
    } finally {
      setResolvingId(null);
    }
  };

  const containerClass = compact
    ? "bg-white rounded-xl p-4 shadow-md flex flex-col max-h-[260px]"
    : "bg-white rounded-xl p-5 shadow-md flex flex-col max-h-[420px]";

  const listClass = compact
    ? "mt-3 space-y-3 overflow-y-auto pr-2"
    : "mt-4 space-y-3 overflow-y-auto pr-2";

  return (
    <div className={containerClass}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Alarmas activas</h2>
        <span className="text-xs text-gray-500">
          {loading ? "Cargando..." : `${events.length} activas`}
        </span>
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-500">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-4 text-sm text-gray-500">Cargando alarmas...</p>
      ) : events.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">
          No hay alarmas activas 🎉
        </p>
      ) : (
        <div className={listClass}>
          {events.map((ev) => {
            const { label, badgeClass, cardClass } = getSeverityStyles(
              ev.severity
            );
            const variableLabel = getVariableLabel(ev.variable);

            return (
              <div
                key={ev.id}
                className={`rounded-lg px-4 py-3 shadow-sm ${cardClass}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">{variableLabel}</p>
                    <p className="text-xs text-gray-600">
                      {ev.deviceLabel} — Valor:{" "}
                      <span className="font-semibold">
                        {ev.value.toFixed(2)}
                      </span>
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Disparada: {formatDateTime(ev.firedAt)}
                    </p>
                  </div>

                  <span
                    className={`text-[11px] font-semibold uppercase ${badgeClass}`}
                  >
                    {label}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleResolve(ev.id)}
                  disabled={resolvingId === ev.id}
                  className="mt-2 text-[11px] text-[#0982A0] hover:underline disabled:opacity-60"
                >
                  {resolvingId === ev.id
                    ? "Marcando..."
                    : "Marcar como resuelta"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ActiveAlarmsWidget;
