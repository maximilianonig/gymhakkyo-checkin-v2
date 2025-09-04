// --- IMPORTS ---
const functions = require("firebase-functions");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const axios = require("axios");

// --- ADMIN SDK ---
try { admin.initializeApp(); } catch (_) {}
const db = admin.firestore();
const messaging = admin.messaging();

// --- TU API EXISTENTE (SE MANTIENE) ---
const app = express();
app.use(cors({ origin: true }));

app.get("/reverse-geocode", async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: "Faltan coordenadas" });

  try {
    const apiKey = "TU_API_KEY_DE_MAPS_AQUI";
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
    const response = await axios.get(url);
    const direccion = response?.data?.results?.[0]?.formatted_address || "Dirección no disponible";
    return res.json({ direccion });
  } catch (error) {
    console.error("Error en reverse-geocode:", error);
    return res.status(500).json({ direccion: "Dirección no disponible" });
  }
});

// Export HTTPS (igual que antes)
exports.api = functions.region("us-central1").https.onRequest(app);

// ===== Helpers horario BA =====
function nowInBA() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
}
function today00BA() { const d = nowInBA(); d.setHours(0,0,0,0); return d; }
function parseHMToToday(hm) {
  const [h,m] = (hm || "08:00").split(":").map(Number);
  const d = today00BA(); d.setHours(h, m, 0, 0); return d;
}
function keyize(s="") {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_").toLowerCase();
}
function todayKeyBA() {
  const n = nowInBA();
  return `${n.getFullYear()}${String(n.getMonth()+1).padStart(2,"0")}${String(n.getDate()).padStart(2,"0")}`;
}
async function getAdminTokens() {
  const snap = await db.collection("adminTokens").get();
  const t = []; snap.forEach(d => t.push(d.id)); return t;
}

// ===== PUSH 1: al crear un fichaje =====
exports.onIngresoCreate = onDocumentCreated("ingresos/{id}", async (event) => {
  const doc = event.data; if (!doc) return;
  const d = doc.data();

  const tokens = await getAdminTokens();
  if (!tokens.length) return;

  const nombre = d?.nombre?.trim() || d?.alias?.trim() || d?.rol || "Empleado";
  const sede = d?.sede || "Sede";
  const esSalida = String(d?.tipo || "").toLowerCase() === "salida";
  const verbo = esSalida ? "SALIO ✅" : "FICHO ✅";
  const title = `${nombre} de ${sede} ${verbo}`;

  const res = await messaging.sendEachForMulticast({
    notification: { title, body: "" },
    data: { url: "/admin.html" },
    tokens
  });

  // limpiar tokens inválidos
  const failures = res.responses.filter(r => !r.success);
  await Promise.all(failures.map((r,i) => {
    const code = r.error?.code || "";
    if (["messaging/invalid-registration-token","messaging/registration-token-not-registered"].includes(code)) {
      return db.collection("adminTokens").doc(tokens[i]).delete().catch(()=>{});
    }
    return Promise.resolve();
  }));
});

// ===== PUSH 2: atraso (scheduler cada 1 min) =====
exports.notifyLateArrivals = onSchedule({
  schedule: "every 1 minutes",
  timeZone: "America/Argentina/Buenos_Aires"
}, async () => {
  const now = nowInBA();
  const weekday = ((now.getDay() + 6) % 7) + 1; // 1 lun ... 7 dom
  const tokens = await getAdminTokens();
  if (!tokens.length) return;

  const turnosSnap = await db.collection("configTurnos").get();
  const tasks = [];

  turnosSnap.forEach((docT) => {
    const t = docT.data();
    if (!t?.dias?.includes(weekday)) return;

    const start = parseHMToToday(t.start);
    const tolMs = (t.toleranceMin ?? 5) * 60 * 1000;
    const deadline = new Date(start.getTime() + tolMs);
    const turno = t.turno || "";

    if (now <= deadline) return;
    if (now.getHours() >= 23) return;

    tasks.push((async () => {
      const baseKey = `${todayKeyBA()}-${keyize(t.sede)}-${keyize(t.rol)}-${keyize(turno)}`;
      const nombres = Array.isArray(t.nombresEsperados) && t.nombresEsperados.length ? t.nombresEsperados : null;

      // ¿ya fichó en este turno?
      async function yaFicho(nombre) {
        let q = db.collection("ingresos")
          .where("sede", "==", t.sede)
          .where("rol", "==", t.rol)
          .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(start))
          .where("timestamp", "<=", admin.firestore.Timestamp.fromDate(now))
          .limit(1);
        if (nombre) q = q.where("nombre", "==", nombre);
        const s = await q.get();
        return !s.empty;
      }

      if (nombres) {
        for (const nombre of nombres) {
          if (await yaFicho(nombre)) continue;
          const alertId = `${baseKey}-${keyize(nombre)}`;
          const ref = db.collection("lateAlerts").doc(alertId);
          if ((await ref.get()).exists) continue;

          const title = `${nombre} de ${t.sede} ESTA LLEGANDO TARDE ❌`;
          await messaging.sendEachForMulticast({ notification: { title, body: "" }, data: { url: "/admin.html" }, tokens });
          await ref.set({
            fechaKey: todayKeyBA(), sede: t.sede, rol: t.rol, turno, nombre,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
        return;
      }

      // Sin nombres: avisar por rol, una vez por turno
      if (await yaFicho(null)) return;
      const alertId = `${baseKey}-rol`;
      const ref = db.collection("lateAlerts").doc(alertId);
      if ((await ref.get()).exists) return;

      const title = `${t.rol} de ${t.sede} ESTA LLEGANDO TARDE ❌`;
      await messaging.sendEachForMulticast({ notification: { title, body: "" }, data: { url: "/admin.html" }, tokens });
      await ref.set({
        fechaKey: todayKeyBA(), sede: t.sede, rol: t.rol, turno,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    })());
  });

  await Promise.all(tasks);
});
