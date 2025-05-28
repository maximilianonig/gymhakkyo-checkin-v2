// scripts.js COMPLETO con bloqueos, previsualización y recarga

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  Timestamp,
  serverTimestamp,
  orderBy
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

const video = document.getElementById("video");
const captureButton = document.getElementById("captureButton");
let stream;
let ubicacion = null;
let direccion = "Ubicación no disponible";



async function initCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
  } catch (error) {
    console.error("Error al acceder a la cámara:", error);
  }
}

function obtenerHoraFormateada() {
  const ahora = new Date();
  const horas = ahora.getHours().toString().padStart(2, "0");
  const minutos = ahora.getMinutes().toString().padStart(2, "0");
  return `${horas}:${minutos}`;
}

async function obtenerUbicacion() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject("Geolocalización no soportada");
    }
    navigator.geolocation.getCurrentPosition(
      position => {
        ubicacion = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        resolve();
      },
      error => {
        console.error("Error obteniendo ubicación:", error);
        reject(error);
      }
    );
  });
}

async function tieneIngresoPrevio(rol) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const inicioDelDia = Timestamp.fromDate(hoy);

  const q = query(
    collection(db, "ingresos"),
    where("rol", "==", rol),
    where("tipo", "==", "entrada"),
    where("timestamp", ">=", inicioDelDia),
    orderBy("timestamp", "desc")
  );

  const querySnapshot = await getDocs(q);
  return !querySnapshot.empty;
}

captureButton.addEventListener("click", async () => {
  captureButton.disabled = true;

  try {
    if (!stream) {
      alert("La cámara no está activa.");
      return;
    }

    const rol = document.getElementById("rol")?.value;
    const accion = document.getElementById("accion")?.value || "entrada";

    if (!rol || !accion) {
      alert("Por favor seleccioná tu rol y si es entrada o salida.");
      return;
    }

    await obtenerUbicacion();

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imagenBase64 = canvas.toDataURL("image/jpeg");

    const previewContainer = document.getElementById("preview-container");
    if (previewContainer) {
      previewContainer.innerHTML = "";
      const imgPreview = document.createElement("img");
      imgPreview.src = imagenBase64;
      imgPreview.style.maxWidth = "100%";
      previewContainer.appendChild(imgPreview);
    }

    if (accion === "salida") {
      const yaIngreso = await tieneIngresoPrevio(rol);
      if (!yaIngreso) {
        alert("No se detectó un ingreso previo. No podés fichar salida.");
        return;
      }
    }

    await addDoc(collection(db, "ingresos"), {
      rol,
      tipo: accion,
      imagenBase64,
      hora: obtenerHoraFormateada(),
      direccion,
      ubicacion: {
        lat: ubicacion.lat,
        lng: ubicacion.lng
      },
      timestamp: serverTimestamp()
    });

    alert("✅ Ingreso registrado con éxito.");
    setTimeout(() => window.location.reload(), 2000);

  } catch (error) {
    console.error("Error al registrar ingreso:", error);
    alert("Ocurrió un error al guardar el ingreso.");
    captureButton.disabled = false;
  }
});

window.onload = () => {
  initCamera();
  obtenerUbicacion();
};