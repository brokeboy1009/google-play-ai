
const express = require("express");
const Groq = require("groq-sdk");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Please provide chat messages."
      });
    }

    const safeMessages = messages
      .filter(m =>
        m &&
        ["user", "assistant"].includes(m.role) &&
        typeof m.content === "string"
      )
      .slice(-20)
      .map(m => ({
        role: m.role,
        content: m.content.slice(0, 8000)
      }));

    if (!safeMessages.length) {
      return res.status(400).json({
        error: "No valid messages found."
      });
    }

    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      messages: safeMessages,
      temperature: 0.7,
      max_tokens: 1024
    });

    res.json({
      reply: completion.choices[0]?.message?.content || ""
    });
  } catch (error) {
    console.error("Groq API error:", error.message);

    res.status(500).json({
      error: "The AI could not respond. Check the server logs and Groq settings."
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Google-Play-AI running on port ${PORT}`);
});
        
