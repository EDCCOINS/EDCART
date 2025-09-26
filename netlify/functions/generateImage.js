// Netlify Function: generateImage.js
// Dit bestand MOET op de server draaien.
// Bewaar dit in de map: netlify/functions/generateImage.js

const fetch = require('node-fetch'); // Voor server-side HTTP requests

// Configuratie
const MODEL_NAME = "gemini-2.5-flash-image-preview";
const API_URL_BASE = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent`;
const MAX_RETRIES = 5;

/**
 * Voert de API-aanroep uit met exponentiële backoff.
 * Dit is nu de server-side logica.
 * @param {Object} payload - Het JSON-object voor de API-aanvraag.
 * @param {string} apiKey - De geheime API-sleutel.
 * @param {number} attempt - De huidige poging.
 * @returns {Promise<Object>} De API-respons.
 */
async function fetchWithBackoff(payload, apiKey, attempt = 1) {
    const url = `${API_URL_BASE}?key=${apiKey}`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.status === 429 && attempt < MAX_RETRIES) {
            // Rate Limit: probeer het opnieuw met backoff
            const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
            console.warn(`[Server] API Rate Limit. Retrying in ${Math.round(delay)}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithBackoff(payload, apiKey, attempt + 1);
        }

        if (!response.ok) {
            const errorDetails = await response.json().catch(() => ({}));
            throw new Error(`[Server] HTTP-fout: ${response.status} - ${errorDetails.error?.message || response.statusText}`);
        }

        return response.json();

    } catch (error) {
        if (attempt < MAX_RETRIES) {
            const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
            console.error(`[Server] Fout bij aanroep (poging ${attempt}):`, error.message);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithBackoff(payload, apiKey, attempt + 1);
        }
        throw new Error("[Server] Generatie mislukt na meerdere pogingen.");
    }
}


exports.handler = async (event) => {
    // 1. Haal de API-sleutel op uit de Netlify Environment Variables
    // Zorg ervoor dat je een variabele genaamd GEMINI_API_KEY instelt in je Netlify instellingen!
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Gemini API Key is niet ingesteld in Netlify Environment Variables." }),
        };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: "Methode niet toegestaan" };
    }

    try {
        const { prompt } = JSON.parse(event.body);

        if (!prompt) {
            return { statusCode: 400, body: JSON.stringify({ message: "Prompt is vereist." }) };
        }

        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                responseModalities: ['TEXT', 'IMAGE']
            },
        };

        const result = await fetchWithBackoff(payload, apiKey);

        // Zoek naar het base64-deel in de respons
        const base64Part = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

        if (!base64Part || !base64Part.inlineData?.data) {
            return {
                statusCode: 500,
                body: JSON.stringify({ message: 'API heeft geen geldige afbeelding geretourneerd.' }),
            };
        }

        const base64Data = base64Part.inlineData.data;
        const mimeType = base64Part.inlineData.mimeType || 'image/png';

        // Stuur de base64 data terug naar de client
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ base64Data, mimeType }),
        };

    } catch (error) {
        console.error("Fout in Netlify Function:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: error.message || "Interne serverfout bij beeldgeneratie." }),
        };
    }
};
