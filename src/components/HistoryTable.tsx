import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { API_BASE_URL } from "../config";

type Registro = {
  fecha: string;     // viene de la API
  hora: string;
  estacion: string;  // 'RURAL' / 'URBANA'
  co2: number;
  co: number;
  nox: number;
  voc: number;
  // 👇 nuevos campos que también manda la API
  temperatura?: number;
  humedad?: number;
};

const API_URL = `${API_BASE_URL}/api/mediciones`;

const HistoryTable: React.FC = () => {
  const [data, setData] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [station, setStation] = useState<"todas" | "Rural" | "Urbana">("todas");

 const formatearFecha = (valor: string) => {
  if (!valor) return "";

  const [anio, mes, dia] = valor.split("-");

  return `${dia}/${mes}/${anio}`;
};

  const formatearEstacion = (valor: string) => {
    if (!valor) return "";
    const lower = valor.toLowerCase();
    if (lower.includes("rural")) return "Rural";
    if (lower.includes("urbana")) return "Urbana";
    return valor;
  };

  // Cargar datos desde la API al montar
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log("🔎 Llamando API:", API_URL);
        const res = await fetch(API_URL);
        console.log("🔎 Status respuesta:", res.status);

        const json = await res.json();
        console.log("🔎 Datos recibidos:", json);
        setData(json);
      } catch (err) {
        console.error("❌ Error al cargar datos de la API:", err);
        setError("No se pudieron cargar los datos de la API.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filtrado por estación + rango de fechas
  const filteredData = data.filter((row) => {
    // 1) Estación
    if (station !== "todas") {
      if (formatearEstacion(row.estacion) !== station) {
        return false;
      }
    }

    // 2) Rango de fechas
   const rowDate = new Date(
  row.fecha.split("-").join("/") + " 12:00:00"
);

    if (fromDate) {
      const from = new Date(fromDate + "T00:00:00");
      if (rowDate < from) return false;
    }

    if (toDate) {
      const to = new Date(toDate + "T23:59:59");
      if (rowDate > to) return false;
    }

    return true;
  });

  const handleApply = () => {
    console.log({ fromDate, toDate, station });
  };

  const handleClear = () => {
    setFromDate("");
    setToDate("");
    setStation("todas");
  };

  const handleExportExcel = () => {
    const rows = filteredData.map((row) => ({
      Fecha: formatearFecha(row.fecha),
      Hora: row.hora,
      Estación: formatearEstacion(row.estacion),
      CO2: row.co2,
      CO: row.co,
      NOx: row.nox,
      VOC: row.voc,
      "Temp (°C)": row.temperatura,
      "Humedad (%)": row.humedad,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Historial");

    XLSX.writeFile(workbook, "historial_mediciones.xlsx");
  };

  return (
    <div
      className="
        bg-white rounded-xl p-5 shadow-md
        h-[calc(100vh-150px)]
        flex flex-col
      "
    >
      {/* Título + filtros */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4 shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-[black]">
            Historial de datos
          </h2>
          <p className="text-xs text-gray-500">
            Filtra y consulta los registros históricos de las estaciones.
          </p>
          {loading && (
            <p className="text-[11px] text-gray-400 mt-1">
              Cargando datos desde la API...
            </p>
          )}
          {error && (
            <p className="text-[11px] text-red-500 mt-1">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col">
            <label className="text-[11px] font-semibold text-gray-600 mb-1">
              Desde
            </label>
            <input
              type="date"
              className="border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#1CB3D1]"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="flex flex-col">
            <label className="text-[11px] font-semibold text-gray-600 mb-1">
              Hasta
            </label>
            <input
              type="date"
              className="border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#1CB3D1]"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div className="flex flex-col">
            <label className="text-[11px] font-semibold text-gray-600 mb-1">
              Estación
            </label>
            <select
              className="border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#1CB3D1]"
              value={station}
              onChange={(e) => setStation(e.target.value as any)}
            >
              <option value="todas">Todas</option>
              <option value="Rural">Rural</option>
              <option value="Urbana">Urbana</option>
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              className="px-3 py-1 rounded-lg text-xs font-semibold text-white bg-[#1CB3D1] hover:bg-[#0982A0] transition"
              onClick={handleApply}
            >
              Aplicar
            </button>
            <button
              className="px-3 py-1 rounded-lg text-xs font-medium bg-gray-200 hover:bg-gray-300 transition"
              onClick={handleClear}
            >
              Limpiar
            </button>
            <button
              className="px-3 py-1 rounded-lg text-xs font-semibold text-white bg-[#1CB3D1] hover:bg-[#0982A0] transition"
              onClick={handleExportExcel}
            >
              Exportar Excel
            </button>
          </div>
        </div>
      </div>

      {/* Tabla con scroll */}
      <div className="overflow-x-auto overflow-y-auto flex-1">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr style={{ backgroundColor: "#16c1c8" }} className="text-white">
              <th className="p-2 border border-gray-200 text-left">Fecha</th>
              <th className="p-2 border border-gray-200 text-left">Hora</th>
              <th className="p-2 border border-gray-200 text-left">Estación</th>
              <th className="p-2 border border-gray-200 text-left">CO₂</th>
              <th className="p-2 border border-gray-200 text-left">CO</th>
              <th className="p-2 border border-gray-200 text-left">NOx</th>
              <th className="p-2 border border-gray-200 text-left">VOC</th>
              <th className="p-2 border border-gray-200 text-left">Temp (°C)</th>
              <th className="p-2 border border-gray-200 text-left">Humedad (%)</th>
            </tr>
          </thead>

          <tbody>
            {filteredData.map((row, index) => (
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
                <td className="p-2 border border-gray-200">
                  {row.temperatura ?? ""}
                </td>
                <td className="p-2 border border-gray-200">
                  {row.humedad ?? ""}
                </td>
              </tr>
            ))}

            {filteredData.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={9}
                  className="p-3 text-center text-gray-500 text-xs"
                >
                  No hay registros que coincidan con los filtros seleccionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HistoryTable;
