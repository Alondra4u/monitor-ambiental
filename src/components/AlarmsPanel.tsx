import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "../config";
import ActiveAlarmsWidget from "./ActiveAlarmsWidget";

type Station = "Rural" | "Urbana";
type Parameter = "CO2" | "CO" | "NOx" | "VOC" | "Temperatura" | "Humedad";
type Operator = ">" | ">=" | "<" | "<=";
type Severity = 1 | 2 | 3; // 1=baja, 2=media, 3=alta

interface AlarmRule {
  id: number;
  station: Station;
  parameter: Parameter;
  operator: Operator;
  threshold: number;
  unit: string;
  enabled: boolean;
  createdAt: string;
  severity: Severity;
}

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

const PARAM_UNITS: Record<Parameter, string> = {
  CO2: "ppm",
  CO: "ppm",
  NOx: "ppb",
  VOC: "ppb",
  Temperatura: "°C",
  Humedad: "%",
};

const SEVERITY_LABEL: Record<Severity, string> = {
  1: "BAJA",
  2: "MEDIA",
  3: "ALTA",
};

const SEVERITY_PILL: Record<Severity, string> = {
  1: "bg-emerald-100 text-emerald-800",
  2: "bg-amber-100 text-amber-900",
  3: "bg-red-100 text-red-700",
};

const API_URL = `${API_BASE_URL}/api/alarmas`;

interface AlarmsPanelProps {
  showButton: boolean; // false = resumen (Dashboard), true = página completa (Alarmas)
}

// Helpers: tu BD maneja nombre_variable en minúsculas, tu UI en “bonito”
const normalizeStation = (raw: any): Station => {
  const v = String(raw ?? "").toLowerCase();
  if (v.includes("urb")) return "Urbana";
  return "Rural";
};

const normalizeParameter = (raw: any): Parameter => {
  const v = String(raw ?? "").toLowerCase();
  if (v === "co2") return "CO2";
  if (v === "co") return "CO";
  if (v === "nox") return "NOx";
  if (v === "voc") return "VOC";
  if (v === "temperatura") return "Temperatura";
  if (v === "humedad") return "Humedad";

  // por si te llega ya en formato UI
  const up = String(raw ?? "").toUpperCase();
  if (up === "CO2") return "CO2";
  if (up === "CO") return "CO";
  if (up === "NOX") return "NOx";
  if (up === "VOC") return "VOC";
  if (up === "TEMPERATURA") return "Temperatura";
  if (up === "HUMEDAD") return "Humedad";

  return "CO2";
};

const normalizeSeverity = (raw: any): Severity => {
  const n = Number(raw);
  if (n === 1 || n === 2 || n === 3) return n;
  return 1;
};

// Si tu API te regresa valor_minimo/valor_maximo (modelo BD), lo convertimos a operador+umbral
const normalizeOperatorAndThreshold = (a: any): { operator: Operator; threshold: number } => {
  // contrato "viejo"
  if (a.operator ?? a.operador) {
    const op = (a.operator ?? a.operador) as Operator;
    const th = Number(a.threshold ?? a.umbral ?? 0);
    return { operator: op, threshold: Number.isFinite(th) ? th : 0 };
  }

  const min = a.valor_minimo ?? a.minimo ?? null;
  const max = a.valor_maximo ?? a.maximo ?? null;

  if (min !== null && min !== undefined && (max === null || max === undefined)) {
    return { operator: ">", threshold: Number(min) };
  }
  if (max !== null && max !== undefined && (min === null || min === undefined)) {
    return { operator: "<", threshold: Number(max) };
  }

  // fallback
  const th = Number(a.threshold ?? a.umbral ?? min ?? max ?? 0);
  return { operator: ">", threshold: Number.isFinite(th) ? th : 0 };
};

const AlarmsPanel: React.FC<AlarmsPanelProps> = ({ showButton }) => {
  const [alarms, setAlarms] = useState<AlarmRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newAlarm, setNewAlarm] = useState<{
    station: Station;
    parameter: Parameter;
    operator: Operator;
    threshold: string;
    severity: Severity;
  }>({
    station: "Rural",
    parameter: "CO2",
    operator: ">",
    threshold: "",
    severity: 2, // default: MEDIA
  });

  const totalAlarms = alarms.length;
  const activeAlarms = alarms.filter((a) => a.enabled).length;
  const inactiveAlarms = totalAlarms - activeAlarms;

  useEffect(() => {
    const fetchAlarms = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error("Error al cargar las alarmas desde la API");

        const data = await res.json();

        const mapped: AlarmRule[] = (data ?? []).map((a: any) => {
          const station = normalizeStation(a.station ?? a.estacion);
          const parameter = normalizeParameter(
            a.parameter ?? a.parametro ?? a.nombre_variable
          );

          const { operator, threshold } = normalizeOperatorAndThreshold(a);

          const unit =
            a.unit ??
            a.unidad ??
            PARAM_UNITS[parameter];

          const enabled = Boolean(
            a.enabled ?? a.activa ?? a.habilitada ?? a.esta_activa
          );

          const createdAt = a.createdAt ?? a.fecha_creacion ?? "";

          const severity = normalizeSeverity(
            a.nivel_severidad ?? a.severity ?? a.severidad
          );

          return {
            id: a.id ?? a.id_alarma ?? a.id_config_alarma,
            station,
            parameter,
            operator,
            threshold: Number(threshold),
            unit,
            enabled,
            createdAt,
            severity,
          };
        });

        setAlarms(mapped);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Error desconocido al cargar alarmas");
      } finally {
        setLoading(false);
      }
    };

    fetchAlarms();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>
  ) => {
    const { name, value } = e.target;

    setNewAlarm((prev) => {
      if (name === "severity") {
        return { ...prev, severity: normalizeSeverity(value) };
      }
      return { ...prev, [name]: value };
    });
  };

  const handleAddAlarm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newAlarm.threshold) return;

    const valueNumber = Number(newAlarm.threshold);
    if (Number.isNaN(valueNumber)) return;

    setSaving(true);
    setError(null);

    try {
      // Mandamos "nivel_severidad" (como tu BD) + "severity" por compatibilidad
      const payload = {
        station: newAlarm.station,
        parameter: newAlarm.parameter,
        operator: newAlarm.operator,
        threshold: valueNumber,
        unit: PARAM_UNITS[newAlarm.parameter],

        nivel_severidad: newAlarm.severity,
        severity: newAlarm.severity,
      };

      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Error al guardar la alarma en la API");

      const saved = await res.json();
      const now = new Date();

      const station = normalizeStation(saved.station ?? saved.estacion ?? newAlarm.station);
      const parameter = normalizeParameter(
        saved.parameter ?? saved.parametro ?? saved.nombre_variable ?? newAlarm.parameter
      );

      const { operator, threshold } = normalizeOperatorAndThreshold({
        ...saved,
        operator: saved.operator ?? newAlarm.operator,
        threshold: saved.threshold ?? valueNumber,
      });

      const alarm: AlarmRule = {
        id: saved.id ?? saved.id_alarma ?? saved.id_config_alarma ?? Date.now(),
        station,
        parameter,
        operator,
        threshold: Number(threshold ?? valueNumber),
        unit: saved.unit ?? saved.unidad ?? PARAM_UNITS[parameter],
        enabled: Boolean(saved.enabled ?? saved.activa ?? saved.habilitada ?? saved.esta_activa ?? true),
        createdAt: saved.createdAt ?? saved.fecha_creacion ?? now.toISOString(),
        severity: normalizeSeverity(saved.nivel_severidad ?? saved.severity ?? newAlarm.severity),
      };

      setAlarms((prev) => [alarm, ...prev]);
      setNewAlarm((prev) => ({ ...prev, threshold: "" }));
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error al crear la alarma");
    } finally {
      setSaving(false);
    }
  };

  const toggleAlarm = async (id: number) => {
    const current = alarms.find((a) => a.id === id);
    if (!current) return;

    const newEnabled = !current.enabled;
    setError(null);

    try {
      const res = await fetch(`${API_URL}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // mandamos ambos por compatibilidad
        body: JSON.stringify({ enabled: newEnabled, esta_activa: newEnabled ? 1 : 0 }),
      });

      if (!res.ok) throw new Error("Error al actualizar el estado de la alarma");

      setAlarms((prev) =>
        prev.map((a) => (a.id === id ? { ...a, enabled: newEnabled } : a))
      );
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error al cambiar el estado de la alarma");
    }
  };

  const deleteAlarm = async (id: number) => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar la alarma");
      setAlarms((prev) => prev.filter((a) => a.id !== id));
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error al eliminar la alarma");
    }
  };

  // ===== Vista RESUMEN (Dashboard) =====
  if (!showButton) {
    return (
      <div className="bg-white rounded-xl p-5 shadow-md flex flex-col justify-between h-full">
        <div>
          <h2 className="text-lg font-semibold mb-2">Configuración de alarmas</h2>
          <p className="text-gray-600 text-sm">
            Define reglas para generar alertas cuando los niveles de contaminantes superen los límites que tú indiques en cada estación.
          </p>
        </div>

        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
          <div className="border rounded-xl p-3 text-center shadow-sm">
            <p className="text-xs uppercase tracking-wide text-gray-500">Alarmas totales</p>
            <p className="text-2xl font-bold mt-1">{loading ? "..." : totalAlarms}</p>
          </div>

          <div className="border rounded-xl p-3 text-center shadow-sm">
            <p className="text-xs uppercase tracking-wide text-gray-500">Activas</p>
            <p className="text-2xl font-bold mt-1 text-[#0982A0]">{loading ? "..." : activeAlarms}</p>
          </div>

          <div className="border rounded-xl p-3 text-center shadow-sm">
            <p className="text-xs uppercase tracking-wide text-gray-500">Inactivas</p>
            <p className="text-2xl font-bold mt-1 text-red-500">{loading ? "..." : inactiveAlarms}</p>
          </div>
        </div>
      </div>
    );
  }

  // ===== Vista COMPLETA (/alarmas) =====
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="bg-white rounded-xl p-5 shadow-md h-full">
            <h1 className="text-2xl font-semibold mb-2 text-gray-800">Configuración de alarmas</h1>
            <p className="text-gray-600">
              Define reglas para generar alertas cuando los niveles de contaminantes superen los límites que tú indiques en cada estación.
            </p>

            {error && <p className="text-sm text-red-500 mt-2">{error}</p>}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
              <div className="border rounded-xl p-3 text-center shadow-sm">
                <p className="text-xs uppercase tracking-wide text-gray-500">Alarmas totales</p>
                <p className="text-2xl font-bold mt-1">{loading ? "..." : totalAlarms}</p>
              </div>

              <div className="border rounded-xl p-3 text-center shadow-sm">
                <p className="text-xs uppercase tracking-wide text-gray-500">Activas</p>
                <p className="text-2xl font-bold mt-1 text-[#0982A0]">{loading ? "..." : activeAlarms}</p>
              </div>

              <div className="border rounded-xl p-3 text-center shadow-sm">
                <p className="text-xs uppercase tracking-wide text-gray-500">Inactivas</p>
                <p className="text-2xl font-bold mt-1 text-red-500">{loading ? "..." : inactiveAlarms}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-md h-full">
            <h2 className="text-lg font-semibold mb-4">Nueva alarma</h2>

            <form
              className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end"
              onSubmit={handleAddAlarm}
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estación</label>
                <select
                  name="station"
                  value={newAlarm.station}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1CB3D1]"
                >
                  <option value="Rural">Rural</option>
                  <option value="Urbana">Urbana</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parámetro</label>
                <select
                  name="parameter"
                  value={newAlarm.parameter}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1CB3D1]"
                >
                  <option value="CO2">CO₂ (ppm)</option>
                  <option value="CO">CO (ppm)</option>
                  <option value="NOx">NOx (ppb)</option>
                  <option value="VOC">VOC (ppb)</option>
                  <option value="Temperatura">Temperatura (°C)</option>
                  <option value="Humedad">Humedad (%)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Condición</label>
                <select
                  name="operator"
                  value={newAlarm.operator}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1CB3D1]"
                >
                  <option value=">">&gt;</option>
                  <option value=">=">&gt;=</option>
                  <option value="<">&lt;</option>
                  <option value="<=">&lt;=</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Umbral</label>
                <input
                  type="number"
                  step="0.01"
                  name="threshold"
                  value={newAlarm.threshold}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1CB3D1]"
                  placeholder="Ej. 600"
                />
              </div>

              {/* ✅ NUEVO: Severidad */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Severidad</label>
                <select
                  name="severity"
                  value={newAlarm.severity}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1CB3D1]"
                >
                  <option value={1}>Baja</option>
                  <option value={2}>Media</option>
                  <option value={3}>Alta</option>
                </select>
              </div>

              <div className="md:text-right">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#1CB3D1] hover:brightness-110 transition disabled:opacity-60 w-full md:w-auto"
                >
                  {saving ? "Guardando..." : "Guardar alarma"}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="lg:col-span-1">
          <ActiveAlarmsWidget />
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-md">
        <h2 className="text-lg font-semibold mb-4">Alarmas configuradas</h2>

        {loading ? (
          <p className="text-sm text-gray-500">Cargando alarmas...</p>
        ) : alarms.length === 0 ? (
          <p className="text-sm text-gray-500">
            Aún no tienes alarmas configuradas. Usa el formulario de arriba para crear la primera.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-[#1CB3D1] text-white">
                <tr>
                  <th className="px-3 py-2 text-left">Estación</th>
                  <th className="px-3 py-2 text-left">Parámetro</th>
                  <th className="px-3 py-2 text-left">Condición</th>
                  <th className="px-3 py-2 text-left">Umbral</th>
                  <th className="px-3 py-2 text-left">Severidad</th>
                  <th className="px-3 py-2 text-left">Estado</th>
                  <th className="px-3 py-2 text-left">Creación</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {alarms.map((alarm) => (
                  <tr
                    key={alarm.id}
                    className="border-t border-gray-200 hover:bg-gray-50"
                  >
                    <td className="px-3 py-2">{alarm.station}</td>
                    <td className="px-3 py-2">{alarm.parameter}</td>
                    <td className="px-3 py-2">
                      {alarm.operator} {alarm.threshold} {alarm.unit}
                    </td>
                    <td className="px-3 py-2">
                      {alarm.threshold} {alarm.unit}
                    </td>

                    {/* ✅ NUEVO: mostrar severidad */}
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${SEVERITY_PILL[alarm.severity]}`}
                      >
                        {SEVERITY_LABEL[alarm.severity]}
                      </span>
                    </td>

                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => toggleAlarm(alarm.id)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          alarm.enabled
                            ? "bg-[#0982A0] text-white"
                            : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {alarm.enabled ? "Activa" : "Inactiva"}
                      </button>
                    </td>
                    <td className="px-3 py-2">{formatDateTime(alarm.createdAt)}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => deleteAlarm(alarm.id)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlarmsPanel;
