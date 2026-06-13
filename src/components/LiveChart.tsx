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
const chartData = useMemo(() => {
if (!registros?.length) return [];

type Acumulado = {
  fecha: string;
  ruralSuma: number;
  ruralCount: number;
  urbanaSuma: number;
  urbanaCount: number;
};

const mapa = new Map<string, Acumulado>();

registros.forEach((r) => {
  if (!r.fecha) return;

  const fecha = r.fecha.split("T")[0];

  if (!mapa.has(fecha)) {
    mapa.set(fecha, {
      fecha,
      ruralSuma: 0,
      ruralCount: 0,
      urbanaSuma: 0,
      urbanaCount: 0,
    });
  }

  const dia = mapa.get(fecha)!;

  const estacion = r.estacion.toLowerCase();

  if (estacion.includes("rural")) {
    dia.ruralSuma += Number(r.co2);
    dia.ruralCount++;
  }

  if (estacion.includes("urb")) {
    dia.urbanaSuma += Number(r.co2);
    dia.urbanaCount++;
  }
});

return Array.from(mapa.values())
  .sort((a, b) => a.fecha.localeCompare(b.fecha))
  .slice(-5)
  .map((d) => ({
    time: d.fecha,
    rural:
      d.ruralCount > 0
        ? Number((d.ruralSuma / d.ruralCount).toFixed(1))
        : null,
    urbana:
      d.urbanaCount > 0
        ? Number((d.urbanaSuma / d.urbanaCount).toFixed(1))
        : null,
  }));


}, [registros]);

return ( <div className="bg-white rounded-xl p-5 shadow-md h-72"> <h2 className="text-lg font-semibold mb-3">
Promedio diario de CO₂ </h2>


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

        <YAxis
          tick={{ fontSize: 11 }}
          domain={[0, "auto"]}
        />

        <Tooltip
          formatter={(value, name) => [
            `${value} ppm`,
            name === "rural" ? "Rural" : "Urbana",
          ]}
          labelFormatter={(label) => `Fecha: ${label}`}
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
