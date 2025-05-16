const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors({ origin: true }));

app.get("/reverse-geocode", async (req, res) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: "Faltan coordenadas" });
  }

  try {
    const apiKey = "AIzaSyBB4aKjCaQqnFxY_4zQ8zgxBszUQjZoHQQ"; // tu API Key real
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
    const response = await axios.get(url);

    if (
      response.data &&
      response.data.results &&
      response.data.results.length > 0
    ) {
      const direccion = response.data.results[0].formatted_address;
      return res.json({ direccion });
    } else {
      return res.json({ direccion: "Dirección no disponible" });
    }
  } catch (error) {
    console.error("Error en reverse-geocode:", error);
    return res.status(500).json({ direccion: "Dirección no disponible" });
  }
});

exports.api = functions.region("us-central1").https.onRequest(app);

