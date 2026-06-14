//alarmas.js
import express from "express";
import { pool } from "../db.js";
const router = express.Router();


// UI -> BD
const PARAM_TO_DB = {
  CO2: "co2",
  CO: "co",
  NOx: "nox",
  VOC: "voc",
  Temperatura: "temperatura",
  Humedad: "humedad",
};

// BD -> UI
const DB_TO_PARAM = {
  co2: "CO2",
  co: "CO",
  nox: "NOx",
  voc: "VOC",
  temperatura: "Temperatura",
  humedad: "Humedad",
};

const PARAM_UNITS = {
  CO2: "ppm",
  CO: "ppm",
  NOx: "ppb",
  VOC: "ppb",
  Temperatura: "°C",
  Humedad: "%",
};

function stationToZonaTipo(station) {
  const s = String(station || "").toLowerCase();
  return s.includes("urb") ? "URBANA" : "RURAL";
}

async function resolveDeviceId({ id_dispositivo, station }) {
  // Si ya viene id_dispositivo, úsalo
  if (id_dispositivo !== undefined && id_dispositivo !== null) {
    const id = Number(id_dispositivo);
    if (!Number.isFinite(id)) return null;

    const [rows] = await pool.query(
      `SELECT id_dispositivo FROM dispositivos WHERE id_dispositivo = ? LIMIT 1`,
      [id]
    );
    return rows.length ? id : null;
  }

  // Si viene station, agarramos 1 dispositivo ACTIVO de esa zona
  if (station) {
    const tipo = stationToZonaTipo(station);
    const [rows] = await pool.query(
      `
      SELECT d.id_dispositivo
      FROM dispositivos d
      JOIN zonas z ON d.id_zona = z.id_zona
      WHERE z.tipo = ? AND d.estatus = 'ACTIVO'
      ORDER BY d.id_dispositivo ASC
      LIMIT 1
      `,
      [tipo]
    );
    return rows.length ? rows[0].id_dispositivo : null;
  }

  return null;
}

function buildMinMax(operator, threshold) {
  const op = String(operator || "").trim();
  const th = Number(threshold);

  if (!Number.isFinite(th)) return { valor_minimo: null, valor_maximo: null };

  // Tu tabla es por rango; guardamos en min o max
  if (op === ">" || op === ">=") return { valor_minimo: th, valor_maximo: null };
  if (op === "<" || op === "<=") return { valor_minimo: null, valor_maximo: th };

  // fallback
  return { valor_minimo: th, valor_maximo: null };
}

function deriveOperatorThreshold(valor_minimo, valor_maximo) {
  if (valor_minimo !== null && valor_minimo !== undefined && valor_maximo == null) {
    return { operator: ">", threshold: Number(valor_minimo) };
  }
  if (valor_maximo !== null && valor_maximo !== undefined && valor_minimo == null) {
    return { operator: "<", threshold: Number(valor_maximo) };
  }
  // si vienen ambos (rango), tu UI no lo soporta aún -> devolvemos min como referencia
  if (valor_minimo != null) return { operator: ">", threshold: Number(valor_minimo) };
  if (valor_maximo != null) return { operator: "<", threshold: Number(valor_maximo) };
  return { operator: ">", threshold: 0 };
}

function zonaTipoToStation(tipo) {
  const t = String(tipo || "").toUpperCase();
  return t === "URBANA" ? "Urbana" : "Rural";
}

function normalizeSeverity(n) {
  const v = Number(n);
  if (v === 1 || v === 2 || v === 3) return v;
  return 1;
}

// =====================================================
// GET /api/alarmas  -> lista configuraciones_alarmas
// =====================================================
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        c.id_config_alarma,
        c.id_dispositivo,
        c.nombre_variable,
        c.valor_minimo,
        c.valor_maximo,
        c.nivel_severidad,
        c.esta_activa,
        c.fecha_creacion,
        z.tipo AS tipo_zona
      FROM configuraciones_alarmas c
      LEFT JOIN dispositivos d ON c.id_dispositivo = d.id_dispositivo
      LEFT JOIN zonas z ON d.id_zona = z.id_zona
      ORDER BY c.fecha_creacion DESC, c.id_config_alarma DESC
    `);

    const mapped = rows.map((r) => {
      const parameter = DB_TO_PARAM[r.nombre_variable] ?? "CO2";
      const station = zonaTipoToStation(r.tipo_zona);
      const { operator, threshold } = deriveOperatorThreshold(r.valor_minimo, r.valor_maximo);

      return {
        id: r.id_config_alarma,
        station,
        parameter,
        operator,
        threshold,
        unit: PARAM_UNITS[parameter] ?? "",
        enabled: Boolean(r.esta_activa),
        createdAt: r.fecha_creacion,
        nivel_severidad: normalizeSeverity(r.nivel_severidad),
        // extra por si luego lo ocupas:
        id_dispositivo: r.id_dispositivo,
        nombre_variable: r.nombre_variable,
        valor_minimo: r.valor_minimo,
        valor_maximo: r.valor_maximo,
      };
    });

    res.json(mapped);
  } catch (error) {
    console.error("Error GET /api/alarmas:", error);
    res.status(500).json({ message: "Error al obtener alarmas" });
  }
});

// =====================================================
// POST /api/alarmas -> crea/actualiza configuración
// (por UNIQUE (id_dispositivo, nombre_variable))
// =====================================================
router.post("/", async (req, res) => {
  try {
    const {
      id_dispositivo,
      station,
      parameter,
      operator,
      threshold,
      nivel_severidad,
      enabled,
    } = req.body;

    const deviceId = await resolveDeviceId({ id_dispositivo, station });
    if (!deviceId) {
      return res.status(400).json({
        message:
          "No se pudo resolver id_dispositivo. Asegúrate de tener un dispositivo ACTIVO para esa estación (Rural/Urbana) o envía id_dispositivo.",
      });
    }

    const nombre_variable = PARAM_TO_DB[parameter];
    if (!nombre_variable) {
      return res.status(400).json({ message: "Parámetro inválido" });
    }

    const th = Number(threshold);
    if (!Number.isFinite(th)) {
      return res.status(400).json({ message: "Umbral inválido" });
    }

    const { valor_minimo, valor_maximo } = buildMinMax(operator, th);

    const sev = normalizeSeverity(nivel_severidad);
    const esta_activa = enabled === undefined ? 1 : (enabled ? 1 : 0);

    // Upsert por UNIQUE (id_dispositivo, nombre_variable)
    const [result] = await pool.query(
  `
  INSERT INTO configuraciones_alarmas
  (
    id_dispositivo,
    nombre_variable,
    valor_minimo,
    valor_maximo,
    nivel_severidad,
    esta_activa
  )
  VALUES (?, ?, ?, ?, ?, ?)
  `,
  [
    deviceId,
    nombre_variable,
    valor_minimo,
    valor_maximo,
    sev,
    esta_activa
  ]
);

// Traemos EXACTAMENTE la alarma recién creada
const [rows] = await pool.query(
  `
  SELECT
    c.id_config_alarma,
    c.nombre_variable,
    c.valor_minimo,
    c.valor_maximo,
    c.nivel_severidad,
    c.esta_activa,
    c.fecha_creacion,
    z.tipo AS tipo_zona
  FROM configuraciones_alarmas c
  JOIN dispositivos d ON c.id_dispositivo = d.id_dispositivo
  JOIN zonas z ON d.id_zona = z.id_zona
  WHERE c.id_config_alarma = ?
  `,
  [result.insertId]
);
    const r = rows[0];
    const parameterOut = DB_TO_PARAM[r.nombre_variable] ?? "CO2";
    const stationOut = zonaTipoToStation(r.tipo_zona);
    const { operator: opOut, threshold: thOut } = deriveOperatorThreshold(
      r.valor_minimo,
      r.valor_maximo
    );

    res.json({
      id: r.id_config_alarma,
      station: stationOut,
      parameter: parameterOut,
      operator: opOut,
      threshold: thOut,
      unit: PARAM_UNITS[parameterOut] ?? "",
      enabled: Boolean(r.esta_activa),
      createdAt: r.fecha_creacion,
      nivel_severidad: normalizeSeverity(r.nivel_severidad),
    });
  } catch (error) {
    console.error("Error POST /api/alarmas:", error);
    res.status(500).json({ message: "Error al guardar alarma" });
  }
});

// =====================================================
// PATCH /api/alarmas/:id  -> activar/desactivar o cambiar severidad
// =====================================================
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const enabled = req.body.enabled ?? req.body.esta_activa;
    const nivel_severidad = req.body.nivel_severidad;

    const fields = [];
    const values = [];

    if (enabled !== undefined) {
      fields.push("esta_activa = ?");
      values.push(enabled ? 1 : 0);
    }

    if (nivel_severidad !== undefined) {
      fields.push("nivel_severidad = ?");
      values.push(normalizeSeverity(nivel_severidad));
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: "Nada para actualizar" });
    }

    values.push(Number(id));

    const [result] = await pool.query(
      `UPDATE configuraciones_alarmas SET ${fields.join(", ")} WHERE id_config_alarma = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Alarma no encontrada" });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("Error PATCH /api/alarmas/:id:", error);
    res.status(500).json({ message: "Error al actualizar alarma" });
  }
});

// =====================================================
// DELETE /api/alarmas/:id
// =====================================================
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query(
      `DELETE FROM configuraciones_alarmas WHERE id_config_alarma = ?`,
      [Number(id)]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Alarma no encontrada" });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("Error DELETE /api/alarmas/:id:", error);
    res.status(500).json({ message: "Error al eliminar alarma" });
  }
});

export default router;
