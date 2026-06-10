import "dotenv/config";
import express from "express";
import cors from "cors";

import { pool } from "./db.js";
import alarmasRouter from "./routes/alarmas.js";

const app = express();

app.use(cors());
app.use(express.json());



// =====================================================
// RUTAS: EVENTOS DE ALARMA (para ActiveAlarmsWidget)
// =====================================================

// 1) Obtener eventos de alarma ACTIVOS
app.get("/api/eventos-alarma/activos", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        e.id_evento_alarma,
        e.id_dispositivo,
        e.nombre_variable,
        e.valor,
        e.fecha_disparo,
        e.estatus,
        c.nivel_severidad,
        d.nombre AS nombre_dispositivo
      FROM eventos_alarma e
      JOIN configuraciones_alarmas c
        ON e.id_config_alarma = c.id_config_alarma
      LEFT JOIN dispositivos d
        ON e.id_dispositivo = d.id_dispositivo
      WHERE e.estatus = 'ACTIVA'
      ORDER BY e.fecha_disparo DESC;
    `);

    res.json(rows);
  } catch (error) {
    console.error("Error obteniendo eventos de alarma activos:", error);
    res
      .status(500)
      .json({ message: "Error al obtener eventos de alarma activos" });
  }
});

// 2) Marcar un evento de alarma como RESUELTA
app.patch("/api/eventos-alarma/:id/resolver", async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query(
      `
      UPDATE eventos_alarma
      SET estatus = 'RESUELTA'
      WHERE id_evento_alarma = ?
      `,
      [id]
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "Evento de alarma no encontrado" });
    }

    res.json({ ok: true, message: "Alarma marcada como resuelta" });
  } catch (error) {
    console.error("Error al resolver evento de alarma:", error);
    res
      .status(500)
      .json({ message: "Error al resolver evento de alarma" });
  }
});


// ==============================
// SELECT BASE CON JOINS
// ==============================
const baseSelect = `
  SELECT
    m.fecha_medicion AS fecha,
    m.hora_medicion  AS hora,
    z.tipo           AS estacion,     -- 'RURAL' / 'URBANA'
    z.nombre         AS nombre_zona,
    m.co2_ppm        AS co2,
    m.co_ppm         AS co,
    m.nox_ppb        AS nox,
    m.voc_ppb        AS voc,
    m.temperatura,
    m.humedad
  FROM mediciones m
  JOIN dispositivos d ON m.id_dispositivo = d.id_dispositivo
  JOIN zonas z        ON d.id_zona        = z.id_zona
`;

// ==============================
// RUTA: TODAS LAS MEDICIONES
// ==============================
app.get("/api/mediciones", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      ${baseSelect}
      ORDER BY m.fecha_medicion DESC, m.hora_medicion DESC;
    `);

    res.json(rows);
  } catch (error) {
    console.error("Error obteniendo mediciones:", error);
    res.status(500).json({ message: error.message });
  }
});

// Crear nueva medición (endpoint para que los dispositivos envíen datos)

app.post("/api/mediciones", async (req, res) => {
  try {
    const {
      id_dispositivo,
      temperatura,
      humedad,
      co2,
      co,
      voc,
      nox
    } = req.body;

    const fecha = new Date();

    const fecha_medicion =
      fecha.getFullYear() +
      "-" +
      String(fecha.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(fecha.getDate()).padStart(2, "0");

    const hora_medicion =
      String(fecha.getHours()).padStart(2, "0") +
      ":" +
      String(fecha.getMinutes()).padStart(2, "0") +
      ":" +
      String(fecha.getSeconds()).padStart(2, "0");

    const [result] = await pool.query(
      `
      INSERT INTO mediciones (
        id_dispositivo,
        fecha_medicion,
        hora_medicion,
        temperatura,
        humedad,
        co2_ppm,
        co_ppm,
        voc_ppb,
        nox_ppb
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id_dispositivo,
        fecha_medicion,
        hora_medicion,
        temperatura,
        humedad,
        co2,
        co,
        voc,
        nox
      ]
    );

    res.status(201).json({
      ok: true,
      id_medicion: result.insertId
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});


// RUTA: ÚLTIMA HORA
app.get("/api/mediciones/ultimahora", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      ${baseSelect}
      WHERE CONCAT(m.fecha_medicion, ' ', m.hora_medicion) >= NOW() - INTERVAL 1 HOUR
      ORDER BY m.fecha_medicion DESC, m.hora_medicion DESC;
    `);

    res.json(rows);
  } catch (error) {
    console.error("Error obteniendo última hora:", error);
    res.status(500).json({ error: "Error al obtener datos de la última hora." });
  }
});

// RUTA: HOY
app.get("/api/mediciones/hoy", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      ${baseSelect}
      WHERE m.fecha_medicion = CURDATE()
      ORDER BY m.hora_medicion DESC;
    `);

    res.json(rows);
  } catch (error) {
    console.error("Error obteniendo datos del día:", error);
    res.status(500).json({ error: "Error al obtener datos del día." });
  }
});

// RUTA: ÚLTIMOS 7 DÍAS
app.get("/api/mediciones/ultimos7dias", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      ${baseSelect}
      WHERE m.fecha_medicion >= CURDATE() - INTERVAL 7 DAY
      ORDER BY m.fecha_medicion DESC, m.hora_medicion DESC;
    `);

    res.json(rows);
  } catch (error) {
    console.error("Error obteniendo últimos 7 días:", error);
    res.status(500).json({ error: "Error al obtener datos de los últimos 7 días." });
  }
});

// RUTA: ÚLTIMOS 30 DÍAS
app.get("/api/mediciones/ultimos30dias", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      ${baseSelect}
      WHERE m.fecha_medicion >= CURDATE() - INTERVAL 30 DAY
      ORDER BY m.fecha_medicion DESC, m.hora_medicion DESC;
    `);

    res.json(rows);
  } catch (error) {
    console.error("Error obteniendo últimos 30 días:", error);
    res.status(500).json({ error: "Error al obtener datos de los últimos 30 días." });
  }
});

// 👉👉👉 AQUÍ MONTAS LAS RUTAS DE ALARMAS
app.use("/api/alarmas", alarmasRouter);

// ==============================
// SERVIDOR
// ==============================
// process.env.PORT toma el puerto automático de Render; si estás en local, usa el 3000
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API corriendo exitosamente en el puerto ${PORT}`);
});

