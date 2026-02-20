import express from "express";
import fetch from "node-fetch";

const app = express();
app.get("/", (req, res) => {
  res.send("Servidor funcionando");
});
app.use(express.json());

// ===== VARIABLES =====
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ===== VERIFICACIÓN DEL WEBHOOK (Meta) =====
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verificado");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// ===== RECIBIR MENSAJES =====
app.post("/webhook", async (req, res) => {
  try {
    const message =
      req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) {
      return res.sendStatus(200);
    }

    const from = message.from;
    const text = message.text?.body;

    if (!text) {
      return res.sendStatus(200);
    }

    // ===== LLAMADA A OPENAI =====
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Eres un asistente claro, profesional y útil que responde por WhatsApp."
          },
          { role: "user", content: text }
        ]
      })
    });

    const aiData = await aiResponse.json();

    const reply =
      aiData.choices?.[0]?.message?.content || "No pude generar respuesta.";

    // ===== ENVIAR RESPUESTA A WHATSAPP =====
    await fetch(
      `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${WHATSAPP_TOKEN}`
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: from,
          text: { body: reply }
        })
      }
    );

    return res.sendStatus(200);

  } catch (error) {
    console.error("Error:", error);
    return res.sendStatus(500);
  }
});

// ===== INICIAR SERVIDOR =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
