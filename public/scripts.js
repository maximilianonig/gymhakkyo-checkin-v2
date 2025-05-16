import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBWboAJXuO7feFynrKDefFUW2YWNEt3oF0",
  authDomain: "gymhakkyo-ingreso.firebaseapp.com",
  projectId: "gymhakkyo-ingreso",
  storageBucket: "gymhakkyo-ingreso.appspot.com",
  messagingSenderId: "413099978087",
  appId: "1:413099978087:web:cacfd3021a87dc3cd013c2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const video = document.querySelector("video");
const captureButton = document.getElementById("capture");
const rolSelect = document.getElementById("rol");

let stream;

async function iniciarCamara() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
  } catch (err) {
    console.error("No se pudo acceder a la cámara:", err);
  }
}

async function obtenerDireccionDesdeUbicacion(ubicacion) {
  const { latitude, longitude } = ubicacion.coords;
  try {
    const res = await fetch("https://us-central1-gymhakkyo-ingreso.cloudfunctions.net/api/reverse-geocode", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ lat: latitude, lng: longitude })
    });

    const data = await res.json();
    console.log("✅ Dirección:", data);
    return data.direccion || "Dirección no disponible";
  } catch (e) {
    console.error("❌ Error al traducir coordenadas:", e);
    return "Dirección no disponible";
  }
}


function obtenerHoraFormateada() {
  const ahora = new Date();
  return ahora.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires"
  });
}

captureButton.addEventListener("click", async () => {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);
  const imagenBase64 = canvas.toDataURL("image/jpeg");

  const rol = rolSelect.value;

  let ubicacion = null;
  let direccion = "Dirección no disponible";

  if ("geolocation" in navigator) {
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true
        })
      );
      ubicacion = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      };
      direccion = await obtenerDireccionDesdeUbicacion(pos);
    } catch (e) {
      console.warn("No se pudo obtener la ubicación:", e);
    }
  }

try {
  await addDoc(collection(db, "ingresos"), {
    rol,
    imagenBase64,
    hora: obtenerHoraFormateada(),
    direccion,
    ubicacion: {
      lat: ubicacion?.coords?.latitude || null,
      lng: ubicacion?.coords?.longitude || null
    },
    timestamp: serverTimestamp()
  });
  console.log("✅ Ingreso guardado correctamente");
} catch (e) {
  console.error("❌ Error al guardar ingreso:", e);
}
});

iniciarCamara();
