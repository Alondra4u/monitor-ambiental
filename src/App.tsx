import { useEffect, useState } from "react";
import Navbar from "./components/Navbar";
import Comparativa from "./components/Comparativa";
import RealTimeValues from "./components/RealTimeValues";
import LiveChart from "./components/LiveChart";
import HistoryTable from "./components/HistoryTable";
import AlarmsPanel from "./components/AlarmsPanel";
import DashboardHistoryTable from "./components/DashboardHistoryTable";
import ActiveAlarmsWidget from "./components/ActiveAlarmsWidget";
import { Routes, Route } from "react-router-dom";
import { API_BASE_URL } from "./config";

/* 👇 Tipo de dato que vamos a manejar desde la API */
export type Registro = {
  fecha: string;
  hora: string;
  estacion: string;
  co2: number;
  co: number;
  nox: number;
  voc: number;
  temperatura?: number;
  humedad?: number;
};

type DashboardPageProps = {
  registros: Registro[];
};

function DashboardPage({ registros }: DashboardPageProps) {
  return (
    <div className="max-w-7xl mx-auto px-6 pt-10 pb-6 flex flex-col gap-4">
      {/* Fila 1: valores + gráfica */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <RealTimeValues registros={registros} />
        </div>
        <div className="lg:col-span-2">
          <LiveChart registros={registros} />
        </div>
      </div>

      {/* Fila 2: historial + alarmas (compact) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <DashboardHistoryTable registros={registros} />
        </div>
        <div className="lg:col-span-1">
          {/* 👇 AQUÍ usamos el modo compacto */}
          <ActiveAlarmsWidget compact />
        </div>
      </div>
    </div>
  );
}

function ComparativaPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 pt-5 pb-6">
      <Comparativa />
    </div>
  );
}

type HistorialPageProps = {
  registros: Registro[];
};

function HistorialPage({ registros }: HistorialPageProps) {
  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <HistoryTable registros={registros} />
    </div>
  );
}

function AlarmasPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      {/* 👇 Aquí sí dejamos la configuración completa */}
      <AlarmsPanel showButton={true} />
    </div>
  );
}

function App() {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMediciones = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/mediciones`);

        if (!res.ok) {
          throw new Error("Error HTTP " + res.status);
        }

        const data = await res.json();

        const normalizados: Registro[] = data.map((item: any) => ({
          fecha: item.fecha,
          hora: item.hora,
          estacion:
            item.estacion === "RURAL"
              ? "Rural"
              : item.estacion === "URBANA"
              ? "Urbana"
              : item.estacion ?? "N/A",
          co2: Number(item.co2),
          co: Number(item.co),
          nox: Number(item.nox),
          voc: Number(item.voc),
          temperatura:
            item.temperatura != null ? Number(item.temperatura) : undefined,
          humedad:
            item.humedad != null ? Number(item.humedad) : undefined,
        }));

        setRegistros(normalizados);
      } catch (err: any) {
        console.error(err);
        setError(err.message ?? "Error cargando datos");
      } finally {
        setLoading(false);
      }
    };

    fetchMediciones();
  }, []);

  if (loading) {
    return (
      <div className="bg-gray-100 min-h-screen flex items-center justify-center">
        Cargando mediciones...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-100 min-h-screen flex items-center justify-center text-red-500">
        Error al cargar datos: {error}
      </div>
    );
  }

  return (
    <div className="bg-gray-100 min-h-screen">
      <Navbar />

      <Routes>
        <Route path="/" element={<DashboardPage registros={registros} />} />
        <Route
          path="/historial"
          element={<HistorialPage registros={registros} />}
        />
        <Route path="/comparativa" element={<ComparativaPage />} />
        <Route path="/alarmas" element={<AlarmasPage />} />
      </Routes>

      <div className="text-xs text-gray-500 text-center pb-2">
        Registros cargados desde la API: {registros.length}
      </div>
    </div>
  );
}

export default App;
