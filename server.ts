import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Gemini API Setup
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
});

// API Route for AI analysis of OKR notes
app.post("/api/analyze-notes", async (req, res) => {
  try {
    const { notes, kr, targetMonth, actual } = req.body;
    
    const prompt = `
      Nhiệm vụ: Phân tích nguyên nhân và đưa ra giải pháp khắc phục cho chỉ tiêu OKR không đạt.
      Chỉ tiêu: ${kr}. Mục tiêu tháng: ${targetMonth}. Kết quả thực hiện: ${actual}. Ghi chú ban đầu: ${notes}.
      Yêu cầu: 1. Phân tích nguyên nhân. 2. Đưa ra 2-3 hành động khắc phục cụ thể.
    `;

    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: prompt
    });
    
    res.json({ analysis: result.text });
  } catch (error: any) {
    console.error("AI Error:", error);
    res.status(500).json({ error: "Failed to analyze notes" });
  }
});

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
