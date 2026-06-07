import React, { useMemo } from "react";
import type { Registro } from "../App";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type LiveChartProps = {
  registros: Registro[];
};

const LiveChart: React.FC<LiveChartProps> = ({ registros }) => {
  // Ahora: usamos simplemente los ÚLTIMOS N datos reales (sin promedios por hora)
  const chartData = useMemo(() => {
    if (!registros || registros.length === 0) return [];

    // 1) Ordenamos por fecha+hora ASC
    const ordenados = [...registros].sort((a, b) => {
      const da = new Date(`${a.fecha}T${a.hora}`);
      const db = new Date(`${b.fecha}T${b.hora}`);
      return da.getTime() - db.getTime();
    });

    // 2) Nos quedamos solo con los ÚLTIMOS N registros (ej. 24)
    const N = 24;
    const ultimos = ordenados.slice(-N);

    // 3) Construimos puntos por etiqueta de tiempo HH:MM
    type Punto = {
      time: string;
      rural: number | null;
      urbana: number | null;
    };

    const mapa = new Map<string, Punto>();

    for (const r of ultimos) {
      const horaStr = (r.hora || "").toString().slice(0, 5); // "HH:MM"
      if (!horaStr) continue;

      const existente =
        mapa.get(horaStr) || {
          time: horaStr,
          rural: null,
          urbana: null,
        };

      const est = (r.estacion || "").toLowerCase();

      if (est.includes("rural")) {
        existente.rural = r.co2;
      } else if (est.includes("urb")) {
        existente.urbana = r.co2;
      }

      mapa.set(horaStr, existente);
    }

    // 4) Ordenamos por hora y devolvemos
    return Array.from(mapa.values()).sort((a, b) =>
      a.time.localeCompare(b.time)
    );
  }, [registros]);

  return (
    <div className="bg-white rounded-xl p-5 shadow-md h-72">
      <h2 className="text-lg font-semibold mb-3">Gráfica en tiempo real</h2>

      {chartData.length === 0 ? (
        <p className="text-xs text-gray-500">
          Aún no hay suficientes mediciones para mostrar la gráfica.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 20, left: 0, bottom: 30 }}
          >
            <CartesianGrid strokeDasharray="3 3" />

            {/* Gradientes para el relleno debajo de cada línea */}
            <defs>
              <linearGradient id="colorRural" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f7a440" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#f7a440" stopOpacity={0} />
              </linearGradient>

              <linearGradient id="colorUrbana" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1CB3D1" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#1CB3D1" stopOpacity={0} />
              </linearGradient>
            </defs>

            <XAxis dataKey="time" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} domain={[0, "auto"]} />

            <Tooltip
              formatter={(value, name) => [
                `${value} ppm`,
                name === "rural" ? "Rural" : "Urbana",
              ]}
              labelFormatter={(label) => `Hora: ${label}`}
            />

            <Legend
              verticalAlign="bottom"
              align="center"
              iconType="circle"
              wrapperStyle={{ paddingTop: 8 }}
              formatter={(value: string) => (
                <span style={{ color: "#000000" }}>{value}</span>
              )}
            />

            {/* Estación Rural (naranja) */}
            <Area
              type="monotone"
              dataKey="rural"
              name="Rural"
              stroke="#f7a440"
              strokeWidth={2}
              fill="url(#colorRural)"
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />

            {/* Estación Urbana (azul) */}
            <Area
              type="monotone"
              dataKey="urbana"
              name="Urbana"
              stroke="#1CB3D1"
              strokeWidth={2}
              fill="url(#colorUrbana)"
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default LiveChart;
