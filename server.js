const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const fs = require("fs");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Multer setup
const upload = multer({ dest: "uploads/" });

// Groq API details
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama3-70b-8192";

// Conversation memory
let conversation = [
  { role: "system", content: "You are a helpful AI assistant like ChatGPT." }
];

// PDF context memory
let pdfContext = "";

/**
 * Chat endpoint
 */
app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    if (!userMessage) {
      return res.status(400).json({ reply: "Message cannot be empty." });
    }

    // Create messages array
    let messages = [
      { role: "system", content: "You are a helpful assistant." }
    ];

    // If PDF content is available, include it as context
    if (pdfContext) {
      messages.push({
        role: "user",
        content: `PDF Content: ${pdfContext}\n\nUser Question: ${userMessage}`
      });
    } else {
      messages.push({ role: "user", content: userMessage });
    }

    // Call Groq API
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
      }),
    });

    const data = await response.json();
    console.log("Groq Response:", data);

    const botReply = data.choices?.[0]?.message?.content || "No response from LLaMA 3.";
    res.json({ reply: botReply });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ reply: "Error connecting to Groq API." });
  }
});

/**
 * Reset conversation and PDF context
 */
app.post("/reset", (req, res) => {
  conversation = [
    { role: "system", content: "You are a helpful AI assistant like ChatGPT." }
  ];
  pdfContext = "";
  res.json({ reply: "Conversation and PDF context have been reset." });
});

/**
 * PDF upload endpoint
 */
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const filePath = req.file.path;
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);

    // Save PDF content for chatbot context
    pdfContext = pdfData.text;

    // Optionally, delete the file after processing
    fs.unlinkSync(filePath);

    res.json({ text: pdfData.text });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "File processing failed" });
  }
});

/**
 * Image upload endpoint
 */
app.post("/image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded." });
    }
    // For now, we just confirm the image upload
    res.json({ message: "Image received", filename: req.file.originalname });
  } catch (err) {
    console.error("Image upload error:", err);
    res.status(500).json({ error: "Image processing failed." });
  }
});

app.listen(5000, () => console.log("Backend running on http://localhost:5000"));
