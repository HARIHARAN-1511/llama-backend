const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const fetch = require("node-fetch");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: "*", // or restrict to your Vercel URL
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());

// -------- Groq config ----------
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama3-70b-8192";

// -------- Memory ---------------
let conversation = [
  { role: "system", content: "You are a helpful AI assistant like ChatGPT." }
];
let pdfContext = "";

// -------- Uploads --------------
const upload = multer({ dest: "uploads/" });

// -------- Health check ----------
app.get("/ping", (_req, res) => res.json({ ok: true, ts: Date.now() }));

// -------- Chat ------------------
app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message?.trim();
    if (!userMessage) return res.status(400).json({ reply: "Message cannot be empty." });

    // Build the prompt/messages to Groq
    const messages = [
      { role: "system", content: "You are a helpful assistant." },
    ];

    if (pdfContext) {
      messages.push({
        role: "user",
        content: `Here is text extracted from a PDF the user uploaded:\n\n${pdfContext}\n\nNow answer the user's question based ONLY on that PDF when relevant.\n\nUser Question: ${userMessage}`
      });
    } else {
      messages.push({ role: "user", content: userMessage });
    }

    const groqRes = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages
      }),
    });

    if (!groqRes.ok) {
      const text = await groqRes.text();
      console.error("Groq error:", text);
      return res.status(500).json({ reply: "Groq API error." });
    }

    const data = await groqRes.json();
    const botReply = data.choices?.[0]?.message?.content || "No response from LLaMA 3.";
    res.json({ reply: botReply });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ reply: "Error connecting to Groq API." });
  }
});

// -------- Reset -----------------
app.post("/reset", (_req, res) => {
  conversation = [
    { role: "system", content: "You are a helpful AI assistant like ChatGPT." }
  ];
  pdfContext = "";
  res.json({ reply: "Conversation & PDF context reset." });
});

// -------- PDF upload ------------
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });

    const filePath = req.file.path;
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);

    pdfContext = pdfData.text || "";
    fs.unlink(filePath, () => {}); // cleanup temp file

    res.json({ text: pdfContext });
  } catch (err) {
    console.error("PDF upload error:", err);
    res.status(500).json({ error: "File processing failed." });
  }
});

// -------- Image upload ----------
app.post("/image", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image uploaded." });
    // (You could forward this to a vision model here.)
    res.json({ message: "Image received", filename: req.file.originalname });
  } catch (err) {
    console.error("Image upload error:", err);
    res.status(500).json({ error: "Image processing failed." });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
