import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { WebSocketServer } from "ws";
import { arduinoHandler } from "./arduino";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

// LLM Provider: "openai" or "gemini" (通过环境变量 LLM_PROVIDER 设置)
const LLM_PROVIDER = process.env.LLM_PROVIDER || "openai";

// OpenAI client
const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// Gemini client
const gemini = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

// 缓存：基于上下文+位置的缓存
const variationsCache = new Map<string, string[]>();

export async function registerRoutes(app: Express): Promise<Server> {
  // 基于上下文获取词的变体（Masked Language Model 风格）
  app.post("/api/word-variations", async (req, res) => {
    try {
      const { word, context, position } = req.body;
      
      if (!word) {
        return res.status(400).json({ message: "Word is required" });
      }

      // 缓存key：上下文+位置
      const cacheKey = context ? `${context}:${position}` : word;
      if (variationsCache.has(cacheKey)) {
        return res.json({ variations: variationsCache.get(cacheKey) });
      }

      // 如果没有 API key，返回错误
      if (!openai && !gemini) {
        return res.status(500).json({ error: "No API key configured (OPENAI_API_KEY or GEMINI_API_KEY required)" });
      }

      // 构建 masked 句子用于上下文感知的替换
      let maskedSentence = context || word;
      if (context && position !== undefined) {
        const words = context.split(' ');
        words[position] = '[MASK]';
        maskedSentence = words.join(' ');
      }

      const prompt = `Given this sentence with a [MASK], suggest 5 alternative words that fit naturally. Focus on poetic alternatives.

Sentence: ${maskedSentence}
Original word: ${word}

Return ONLY a comma-separated list of 5 words.`;

      let variations: string[] = [];

      if (LLM_PROVIDER === "gemini" && gemini) {
        const model = gemini.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent(prompt);
        variations = result.response.text().split(',').map(v => v.trim()).filter(v => v.length > 0);
      } else if (openai) {
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.8,
          max_tokens: 50
        });
        variations = response.choices[0]?.message?.content
          ?.split(',')
          .map(v => v.trim())
          .filter(v => v.length > 0) || [];
      }

      variationsCache.set(cacheKey, variations);
      res.json({ variations });
    } catch (error: any) {
      console.error("Error generating variations:", error);
      res.json({ variations: [] });
    }
  });

  // Arduino status endpoint for debugging
  app.get("/api/arduino-status", async (req, res) => {
    try {
      const status = arduinoHandler.getConnectionStatus();
      res.json(status);
    } catch (error: any) {
      console.error("Error getting Arduino status:", error);
      res.status(500).json({ message: error.message || "Failed to get Arduino status" });
    }
  });

  const httpServer = createServer(app);

  // Set up WebSocket server for real-time encoder data on a specific path
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/encoder" });

  wss.on("connection", (ws) => {
    console.log("WebSocket client connected");

    // Send current encoder state immediately on connection
    ws.send(
      JSON.stringify({
        type: "encoder",
        data: arduinoHandler.getCurrentData(),
      })
    );

    ws.on("close", () => {
      console.log("WebSocket client disconnected");
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });
  });

  // Initialize Arduino communication
  await arduinoHandler.initialize(wss);

  // Clean up on server shutdown
  process.on("SIGTERM", () => {
    console.log("Shutting down...");
    arduinoHandler.close();
    wss.close();
  });

  return httpServer;
}
