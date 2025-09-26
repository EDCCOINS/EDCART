// netlify/functions/generateImage.js
const fetch = require("node-fetch");

const MODEL_NAME = "gemini-2.5-flash-image-preview";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateImage`;

/**
 * Netlify Function voor het genereren van een afbeelding via Gemini 2.5 Flash Image.
 */
exports.handler = async (event) => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Gemini API Key ontbreekt in Netlify Environment Variables." }),
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Methode niet toegestaan" };
  }

  try {
    const { prompt } = JSON.parse(event.body);
    if (!prompt) {
      return { statusCode: 400, body: JSON.stringify({ message: "Prompt is vereist." }) };
    }

    // Payload voor Gemini 2.5 Flash Image
    const payload = {
      prompt: prompt,
      size: "1024x1024" // Optioneel: andere formaten "512x512" of "2048x2048"
    };

    // API-aanroep
    const response = await fetch(`${API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      return { statusCode: response.status, body: JSON.stringify({ message: text }) };
    }

    const data = await response.json();

    // Gemini 2.5 Flash Image geeft base64 terug in imageBase64
    const base64Data = data.imageBase64;
    if (!base64Data) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "API heeft geen afbeelding teruggegeven." }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base64Data,
        mimeType: "image/png",
      }),
    };

  } catch (err) {
    console.error("Fout in Netlify Function:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: err.message || "Interne serverfout bij beeldgeneratie." }),
    };
  }
};
