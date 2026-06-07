import type { Registro } from "../App"; // mejor como type para evitar ciclos

type RealTimeValuesProps = {
  registros: Registro[];
};

export default function RealTimeValues({ registros }: RealTimeValuesProps) {
  // 👉 Como `registros` viene ordenado del más nuevo al más viejo,
  // buscamos el PRIMER registro de cada tipo de estación.
  const ultimoRural = registros.find((r) =>
    r.estacion.toLowerCase().includes("rural")
  );

  const ultimoUrbana = registros.find((r) =>
    r.estacion.toLowerCase().includes("urbana")
  );

  const formatearFecha = (valor: string) => {
    const d = new Date(valor);
    if (isNaN(d.getTime())) return valor; // por si ya viene como '2025-03-07'
    return d.toLocaleDateString("es-MX"); // 07/03/2025
  };

  return (
    <div className="bg-white rounded-xl p-5 shadow-md">
      <h2 className="text-lg font-semibold mb-3">Valores en tiempo real</h2>

      <div className="grid grid-cols-2 gap-4">
        {/* Estación Rural */}
        <div className="border p-3 rounded-md">
          <h3 className="font-medium mb-1">Estación Rural</h3>

          {ultimoRural ? (
            <>
              <p>CO₂: {ultimoRural.co2} ppm</p>
              <p>CO: {ultimoRural.co} ppm</p>
              <p>NOx: {ultimoRural.nox} ppb</p>
              <p>VOC: {ultimoRural.voc} ppb</p>
              {ultimoRural.temperatura !== undefined && (
                <p>Temperatura: {ultimoRural.temperatura} °C</p>
              )}
              {ultimoRural.humedad !== undefined && (
                <p>Humedad: {ultimoRural.humedad}%</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Última medición: {formatearFecha(ultimoRural.fecha)}{" "}
                {ultimoRural.hora}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-500">Sin datos de estación rural</p>
          )}
        </div>

        {/* Estación Urbana */}
        <div className="border p-3 rounded-md">
          <h3 className="font-medium mb-1">Estación Urbana</h3>

          {ultimoUrbana ? (
            <>
              <p>CO₂: {ultimoUrbana.co2} ppm</p>
              <p>CO: {ultimoUrbana.co} ppm</p>
              <p>NOx: {ultimoUrbana.nox} ppb</p>
              <p>VOC: {ultimoUrbana.voc} ppb</p>
              {ultimoUrbana.temperatura !== undefined && (
                <p>Temperatura: {ultimoUrbana.temperatura} °C</p>
              )}
              {ultimoUrbana.humedad !== undefined && (
                <p>Humedad: {ultimoUrbana.humedad}%</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Última medición: {formatearFecha(ultimoUrbana.fecha)}{" "}
                {ultimoUrbana.hora}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-500">Sin datos de estación urbana</p>
          )}
        </div>
      </div>
    </div>
  );
}
