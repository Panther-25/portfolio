import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Environment Configuration ──
// Natively checks environment strings on platforms like Render first
dotenv.config();

// ── Supabase ──
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ── Google Gemini SDK ──
// Automatically maps to process.env.GEMINI_API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ── Middleware ──
app.use(cors());
app.use(express.json());

// Serve frontend from /public
app.use(express.static(path.join(__dirname, "../public")));

// ──────────────────────────────────────────────
// POST /api/contact
// Saves contact form submissions to Supabase
// ──────────────────────────────────────────────
app.post("/api/contact", async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: "All fields are required." });
  }

  const { error } = await supabase
    .from("contacts")
    .insert([{ name, email, message }]);

  if (error) {
    console.error("Supabase error:", error.message);
    return res.status(500).json({ error: "Failed to save message." });
  }

  return res.json({ success: true, message: "Transmission received." });
});

// ──────────────────────────────────────────────
// POST /api/chat
// AIDA — powered by Google Gemini SDK
// ──────────────────────────────────────────────
const AIDA_CONTEXT = `You are AIDA, the personal AI assistant of Aravind Babu, known as Phoenix.
You know everything about him:

IDENTITY:
- Full name: Aravind Babu. Preferred name: Phoenix.
- 2nd-year Bachelor of Computer Applications (Honours) at Amrita Vishwa Vidyapeetham.

SKILLS:
- AI/ML, Full-Stack Development, Android Development,
  UI/UX Design, Python, DSA, Firebase, Supabase, Node.js, Express.

MEMBER:
- Secretary of Computer Society of India (CSI) Student Chapter, Amrita Vishwa Vidyapeetham, Kochi.
- Member of Google Developers Group.
- Member of NVIDIA Developer Program.

PROJECTS:
- AttenDroid: Faculty-focused QR attendance app. Firebase synced.
- CO_Olabs: Peer-to-peer collaborative learning platform. Vanilla JS + Firebase + Tailwind. Badges, leaderboard, real-time chat.
- AIDA: Personal AI chatbot recommending free learning resources. Local-first, no paid cloud.
- SAF Alumni App: Alumni platform for St. Anthony's School. Digital alumni cards, meet booking.

EXPERIENCE:
- UI/UX Design Intern at Cognifiz Technologies.
- Participated in OLabs Hackathon.
- Participated in IEDC Cluster Hackathon.

GOALS:
- Long-term: AI/ML Engineer + Penetration Testing specialist.
- Plans to pursue a Master's degree abroad in 2026.
- Preparing for IB ACIO exam.

DAILY LIFE:
- College 9AM–4:40PM. Part-time job 6PM–8:30PM. Late-night self-learning sessions.
- Loves coffee, hackathons, futuristic tech ideas.
- Calls ChatGPT "Friday". Named his AI assistant "AIDA".

RESPONSE STYLE:
- Speak in a concise, mission-briefing tone. Max 2-3 sentences.
- Refer to Phoenix in third person or answer on his behalf naturally.
- Sound intelligent, slightly futuristic, never robotic or cold.
- If asked something you don't know about Phoenix, say so honestly.`;

app.post("/api/chat", async (req, res) => {
  // Robust fallback: reads 'message', 'text', or 'query' depending on frontend schema
  const message = req.body.message || req.body.text || req.body.query;
  const history = req.body.history || [];

  if (!message) {
    console.error("Payload Warning: Missing input parameter. Request body:", req.body);
    return res.status(400).json({ error: "No message parameter provided." });
  }

  // Convert history array to standard format required by the Google SDK wrapper
  const contents = [];

  if (Array.isArray(history)) {
    for (const turn of history) {
      let role = "";
      if (turn.role === "user") {
        role = "user";
      } else if (turn.role === "assistant" || turn.role === "model") {
        role = "model";
      }

      if (role) {
        if (contents.length > 0 && contents[contents.length - 1].role === role) {
          continue;
        }
        contents.push({ role, parts: [{ text: turn.content || turn.parts?.[0]?.text }] });
      }
    }
  }

  // Ensure last history block isn't a duplicate user entry
  if (contents.length > 0 && contents[contents.length - 1].role === "user") {
    contents.pop();
  }

  // Add the new incoming live user prompt
  contents.push({ role: "user", parts: [{ text: message }] });

  try {
    // Calling SDK text generation using gemini-2.5-flash
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
      config: {
        systemInstruction: AIDA_CONTEXT,
        maxOutputTokens: 300,
        temperature: 0.7,
      },
    });

    const reply = response.text || "No response from AIDA.";
    return res.json({ reply });

  } catch (err) {
    console.error("Gemini SDK Chat Error Trace:", err.message || err);
    return res.status(500).json({ error: "AIDA execution system encountered an internal fault." });
  }
});

// ── Catch-all → Valid Express 5 Regular Expression Wildcard Fallback ──
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// ── Start Engine ──
app.listen(PORT, () => {
  console.log(`\n PHOENIX PORTFOLIO SERVER`);
  console.log(` ─────────────────────────────`);
  console.log(` Running on  → Active Production Port: ${PORT}`);
  console.log(` AIDA        → /api/chat  [ Gemini 2.5 Flash SDK ]`);
  console.log(` Contact     → /api/contact  [ Supabase ]`);
  console.log(` ─────────────────────────────\n`);
});