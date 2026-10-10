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

// Basic health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Existing AI chat — keep this working
app.post("/api/chat", async (req, res) => {
  try {
    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({
        error: "GROQ_API_KEY is missing in Render."
      });
    }

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
      model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
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
      error: "Chat failed. Check your Groq settings in Render."
    });
  }
});

// New picture generator
app.post("/api/image", async (req, res) => {
  try {
    if (!process.env.HF_TOKEN) {
      return res.status(500).json({
        error: "HF_TOKEN is missing in Render Environment settings."
      });
    }

    const prompt =
      typeof req.body.prompt === "string"
        ? req.body.prompt.trim()
        : "";

    if (!prompt) {
      return res.status(400).json({
        error: "Please describe the picture you want."
      });
    }

    if (prompt.length > 800) {
      return res.status(400).json({
        error: "Please keep your picture description under 800 characters."
      });
    }

    // Load the Hugging Face SDK on the server
    const { InferenceClient } =
      await import("@huggingface/inference");

    const hf = new InferenceClient(process.env.HF_TOKEN);

    const imageBlob = await hf.textToImage({
      model: "black-forest-labs/FLUX.1-dev",
      inputs: prompt
    });

    const imageBuffer = Buffer.from(
      await imageBlob.arrayBuffer()
    );

    const imageType = imageBlob.type || "image/png";

    res.json({
      image: `data:${imageType};base64,${imageBuffer.toString("base64")}`
    });
  } catch (error) {
    console.error("Image generation error:", error.message);

    res.status(500).json({
      error:
        "Picture generation failed. Check your HF_TOKEN, model access, and available Hugging Face credits."
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Google-Play-AI running on port ${PORT}`);
});
