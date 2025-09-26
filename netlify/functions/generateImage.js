// netlify/functions/generateImage.js
const fetch = require("node-fetch");

const MODEL_NAME = "gemini-1.5-flash"; // <-- use supported model
const API_URL_BASE = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent`;

exports.handler = async (event) => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Gemini API Key is not set in Netlify." }),
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const { prompt } = JSON.parse(event.body);
    if (!prompt) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Prompt is required." }),
      };
    }

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "image/png", // 👈 request an image
      },
    };

    const response = await fetch(`${API_URL_BASE}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      return { statusCode: response.status, body: JSON.stringify({ message: text }) };
    }

    const result = await response.json();

    const base64Part = result?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!base64Part?.data) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "No valid image returned by API." }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base64Data: base64Part.data,
        mimeType: base64Part.mimeType || "image/png",
      }),
    };
  } catch (error) {
    console.error("Function error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message || "Internal server error." }),
    };
  }
};
