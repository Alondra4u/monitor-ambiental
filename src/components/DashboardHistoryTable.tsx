import React from "react";
import type { Registro } from "../App";

type DashboardHistoryTableProps = {
  registros?: Registro[]; // 👈 opcional
};

const DashboardHistoryTable: React.FC<DashboardHistoryTableProps> = ({
  registros = [], // 👈 si no mandan nada, usa []
}) => {
  const formatearFecha = (valor: string) => {
    const d = new Date(valor);
    if (isNaN(d.getTime())) return valor;
    return d.toLocaleDateString("es-MX"); // 07/03/2025
  };

  const formatearEstacion = (valor: string) => {
    if (!valor) return "";
    const lower = valor.toLowerCase();
    if (lower.includes("rural")) return "Rural";
    if (lower.includes("urbana")) return "Urbana";
    return valor;
  };

  // 👇 Tomamos solo los últimos 4 registros (asumiendo que vienen ordenados desc)
  const ultimos = registros.slice(0, 4);

  return (
    <div className="bg-white rounded-xl p-4 shadow-md h-full flex flex-col">
      <h2 className="text-sm font-semibold mb-2 text-[black]">
        Historial reciente
      </h2>

      <div className="overflow-x-auto flex-1">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="text-white" style={{ backgroundColor: "#16c1c8" }}>
              <th className="p-2 border border-gray-200 text-left">Fecha</th>
              <th className="p-2 border border-gray-200 text-left">Hora</th>
              <th className="p-2 border border-gray-200 text-left">Estación</th>
              <th className="p-2 border border-gray-200 text-left">CO₂</th>
              <th className="p-2 border border-gray-200 text-left">CO</th>
              <th className="p-2 border border-gray-200 text-left">NOx</th>
              <th className="p-2 border border-gray-200 text-left">VOC</th>
            </tr>
          </thead>

          <tbody>
            {ultimos.map((row, index) => (
              <tr
                key={index}
                className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
              >
                <td className="p-2 border border-gray-200">
                  {formatearFecha(row.fecha)}
                </td>
                <td className="p-2 border border-gray-200">{row.hora}</td>
                <td className="p-2 border border-gray-200">
                  {formatearEstacion(row.estacion)}
                </td>
                <td className="p-2 border border-gray-200">{row.co2}</td>
                <td className="p-2 border border-gray-200">{row.co}</td>
                <td className="p-2 border border-gray-200">{row.nox}</td>
                <td className="p-2 border border-gray-200">{row.voc}</td>
              </tr>
            ))}

            {ultimos.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="p-3 text-center text-gray-500 text-[11px]"
                >
                  Aún no hay mediciones registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DashboardHistoryTable;
