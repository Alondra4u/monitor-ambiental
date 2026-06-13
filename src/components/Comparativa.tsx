// src/pages/Comparativa.tsx
import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { API_BASE_URL } from "../config";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

/* ----------------- API ROUTES ----------------- */

const API_ROUTES = {
  hour:  `${API_BASE_URL}/api/mediciones/ultimahora`,
  day:   `${API_BASE_URL}/api/mediciones/hoy`,
  week:  `${API_BASE_URL}/api/mediciones/ultimos7dias`,
  month: `${API_BASE_URL}/api/mediciones/ultimos30dias`,
};

/* ----------------- Tipos ----------------- */

interface Registro {
  fecha?: string | Date;
  hora?: string;
  estacion?: string;

  fecha_medicion?: string | Date;
  hora_medicion?: string;
  tipo?: string;
  nombre_zona?: string;
  zona?: string;

  co2?: number | string;
  co?: number | string;
  nox?: number | string;
  voc?: number | string;

  co2_ppm?: number | string;
  co_ppm?: number | string;
  nox_ppb?: number | string;
  voc_ppb?: number | string;
}

interface ComparativePoint {
  time: string;
  ruralCO2: number;
  urbanaCO2: number;
  ruralCO: number;
  urbanaCO: number;
  ruralNOx: number;
  urbanaNOx: number;
  ruralVOC: number;
  urbanaVOC: number;
}

type Parameter = "co2" | "co" | "nox" | "voc";

interface ParamConfig {
  label: string;
  unit: string;
  ruralKey: keyof ComparativePoint;
  urbanaKey: keyof ComparativePoint;
}

const PARAM_CONFIG: Record<Parameter, ParamConfig> = {
  co2: {
    label: "CO₂",
    unit: "ppm",
    ruralKey: "ruralCO2",
    urbanaKey: "urbanaCO2",
  },
  co: {
    label: "CO",
    unit: "ppm",
    ruralKey: "ruralCO",
    urbanaKey: "urbanaCO",
  },
  nox: {
    label: "NOx",
    unit: "ppb",
    ruralKey: "ruralNOx",
    urbanaKey: "urbanaNOx",
  },
  voc: {
    label: "VOC",
    unit: "ppb",
    ruralKey: "ruralVOC",
    urbanaKey: "urbanaVOC",
  },
};

type RangeOption = "hour" | "day" | "week" | "month";

const RANGE_OPTIONS: RangeOption[] = ["hour", "day", "week", "month"];

const RANGE_LABELS: Record<RangeOption, string> = {
  hour: "Última hora",
  day: "Hoy",
  week: "Últimos 7 días",
  month: "Últimos 30 días",
};

/* ----------------- Normalización ----------------- */

// Función para dejar fecha y hora en formato seguro "YYYY-MM-DD" y "HH:MM:SS"
const normalizeRegistro = (reg: Registro) => {
  const fechaRaw = reg.fecha ?? reg.fecha_medicion ?? "";
  let fecha = "";

  if (fechaRaw instanceof Date) {
    // Si viene como Date desde mysql2
    fecha = fechaRaw.toISOString().slice(0, 10); // "YYYY-MM-DD"
  } else {
    // Si viene como string "YYYY-MM-DD" ya está bien
    fecha = fechaRaw.toString().slice(0, 10);
  }

  const horaRaw = reg.hora ?? reg.hora_medicion ?? "";
  const hora = horaRaw.toString().slice(0, 8); // "HH:MM:SS" o similar

  const estacionRaw =
    reg.estacion ?? reg.tipo ?? reg.nombre_zona ?? reg.zona ?? "";
  const estacion = estacionRaw.toString();

  const co2 = Number(reg.co2 ?? reg.co2_ppm ?? 0);
  const co = Number(reg.co ?? reg.co_ppm ?? 0);
  const nox = Number(reg.nox ?? reg.nox_ppb ?? 0);
  const voc = Number(reg.voc ?? reg.voc_ppb ?? 0);

  return { fecha, hora, estacion, co2, co, nox, voc };
};

/* ----------------- Construcción de la comparativa ----------------- */

const buildComparativeData = (
  registros: Registro[],
  range: RangeOption
): ComparativePoint[] => {
  const map: Record<string, ComparativePoint> = {};

  registros.forEach((reg) => {
    const { fecha, hora, estacion, co2, co, nox, voc } = normalizeRegistro(reg);

    if (!fecha || !hora) return;

    const date = fecha.slice(0, 10);
    const hhmm = hora.slice(0, 5); // "HH:MM"

    // 🔹 Cómo se ve el eje X según el rango
    let timeKey: string;
    if (range === "hour") {
      // Última hora → se ve "HH:MM"
      timeKey = hhmm;
    } else if (range === "day") {
      // Hoy → agrupamos por hora: "HH:00"
      const hh = hora.slice(0, 2);
      timeKey = `${hh}:00`;
    } else {
      // week / month → solo la fecha
      timeKey = date;   // 👈 EJE X SOLO FECHA
    }

    if (!map[timeKey]) {
      map[timeKey] = {
        time: timeKey,
        ruralCO2: 0,
        urbanaCO2: 0,
        ruralCO: 0,
        urbanaCO: 0,
        ruralNOx: 0,
        urbanaNOx: 0,
        ruralVOC: 0,
        urbanaVOC: 0,
      };
    }

    const estLower = estacion.toLowerCase();

    if (estLower.includes("rural")) {
      map[timeKey].ruralCO2 = co2;
      map[timeKey].ruralCO = co;
      map[timeKey].ruralNOx = nox;
      map[timeKey].ruralVOC = voc;
    } else if (estLower.includes("urb")) {
      map[timeKey].urbanaCO2 = co2;
      map[timeKey].urbanaCO = co;
      map[timeKey].urbanaNOx = nox;
      map[timeKey].urbanaVOC = voc;
    }
  });

  return Object.values(map).sort((a, b) => a.time.localeCompare(b.time));
  console.log("MAPA FINAL", map);
};


/* ----------------- Componente ----------------- */

const Comparativa: React.FC = () => {
  const [parameter, setParameter] = useState<Parameter>("co2");
  const [range, setRange] = useState<RangeOption>("month");

  const [rawData, setRawData] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentParam = PARAM_CONFIG[parameter];

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const url = API_ROUTES[range];
        const res = await fetch(url);

        if (!res.ok) throw new Error("Error al obtener datos de la API");

        const json = await res.json();
        console.log("API comparativa rawData:", json); // 👀 revisa esto en consola
        setRawData(json);
      } catch (err) {
        console.error(err);
        setError("No se pudieron cargar los datos de la comparativa.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [range]);

  const dataForRange = buildComparativeData(rawData, range);

  /* ----------------- Promedios ----------------- */

  const getAverage = (field: keyof ComparativePoint) => {
    if (dataForRange.length === 0) return 0;
    return (
      dataForRange.reduce((acc, p) => acc + (p[field] as number), 0) /
      dataForRange.length
    );
  };

  const avgRural = getAverage(currentParam.ruralKey);
  const avgUrbana = getAverage(currentParam.urbanaKey);

  /* ----------------- Exportar a Excel ----------------- */

  const handleExportComparativaExcel = () => {
    const rows = dataForRange.map((p) => ({
      Tiempo: p.time,
      [`Rural ${currentParam.label} (${currentParam.unit})`]:
        p[currentParam.ruralKey],
      [`Urbana ${currentParam.label} (${currentParam.unit})`]:
        p[currentParam.urbanaKey],
    }));

    console.log(dataForRange);

    const sheet = XLSX.utils.json_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Comparativa");

    XLSX.writeFile(book, `comparativa_${parameter}_${range}.xlsx`);
  };

  /* ----------------- Render ----------------- */

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="bg-white rounded-xl p-5 shadow-md">
        <h1 className="text-2xl font-semibold mb-2 text-gray-800">
          Comparativa entre estaciones
        </h1>
        <p className="text-gray-600">
          Compara los niveles entre estación <b>Rural</b> y <b>Urbana</b>.
        </p>

        {loading && (
          <p className="text-xs text-gray-500 mt-2">
            Cargando datos desde la base de datos...
          </p>
        )}

        {error && (
          <p className="text-xs text-red-500 mt-2">{error}</p>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl p-5 shadow-md flex flex-wrap gap-6 items-center justify-between">
        {/* Parámetro */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Parámetro
          </label>
          <select
            value={parameter}
            onChange={(e) => setParameter(e.target.value as Parameter)}
            className="border px-3 py-2 rounded-lg text-sm"
          >
            <option value="co2">CO₂ (ppm)</option>
            <option value="co">CO (ppm)</option>
            <option value="nox">NOx (ppb)</option>
            <option value="voc">VOC (ppb)</option>
          </select>
        </div>

        {/* Rango */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Periodo de análisis
          </label>

          <div className="flex flex-wrap gap-2">
            {RANGE_OPTIONS.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={
                  "px-3 py-1 rounded-full border text-xs " +
                  (range === r
                    ? "bg-[#1CB3D1] text-white border-transparent"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100")
                }
              >
                {RANGE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>

        {/* Leyenda */}
        <div className="text-sm">
          <p>
            <span className="inline-block w-3 h-3 rounded-full mr-2 bg-[#f7a440]" />
            Estación Rural
          </p>
          <p>
            <span className="inline-block w-3 h-3 rounded-full mr-2 bg-[#1CB3D1]" />
            Estación Urbana
          </p>
        </div>
      </div>

      {/* Gráfica */}
      <div className="bg-white rounded-xl p-5 shadow-md h-96">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold">
              {currentParam.label} ({currentParam.unit})
            </h2>
            <p className="text-sm text-gray-500">
              {RANGE_LABELS[range]}
            </p>
          </div>

        <button
          onClick={handleExportComparativaExcel}
          className="text-xs px-3 py-2 bg-[#1CB3D1] text-white rounded-lg"
        >
          Exportar a Excel
        </button>
        </div>

        <div className="h-[280px]">
          {dataForRange.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-500">
              {loading
                ? "Cargando datos..."
                : "No hay datos para este rango"}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={dataForRange}
                margin={{ top: 10, right: 20, left: 0, bottom: 35 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis domain={[0, "auto"]} />
                <Tooltip />

                <Area
                  type="monotone"
                  dataKey={currentParam.ruralKey}
                  name={`Rural (${currentParam.label})`}
                  stroke="#f7a440"
                  strokeWidth={2}
                  fill="#f7a440"
                  fillOpacity={0.18}
                  activeDot={{ r: 4 }}
                />

                <Area
                  type="monotone"
                  dataKey={currentParam.urbanaKey}
                  name={`Urbana (${currentParam.label})`}
                  stroke="#1CB3D1"
                  strokeWidth={2}
                  fill="#1CB3D1"
                  fillOpacity={0.18}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Resumen de promedios */}
      <div className="bg-white rounded-xl p-5 shadow-md">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-lg font-semibold">Resumen de promedios</h2>
          <span className="text-xs text-gray-500">
            Periodo: {RANGE_LABELS[range]}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="border rounded-xl p-4 shadow-sm">
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">
              Parámetro seleccionado
            </p>
            <p className="text-lg font-semibold">
              {currentParam.label} ({currentParam.unit})
            </p>
          </div>

          <div className="border rounded-xl p-4 shadow-sm">
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">
              Promedio estación Rural
            </p>
            <p className="text-2xl font-bold text-[#0982A0]">
              {avgRural.toFixed(2)}
            </p>
          </div>

          <div className="border rounded-xl p-4 shadow-sm">
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">
              Promedio estación Urbana
            </p>
            <p className="text-2xl font-bold text-[#D9571B]">
              {avgUrbana.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Comparativa;
