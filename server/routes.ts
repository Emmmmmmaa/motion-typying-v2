import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { WebSocketServer } from "ws";
import { arduinoHandler } from "./arduino";
import OpenAI from "openai";

// Fixed word list for left panel rotation
const FIXED_WORD_LIST = ["we", "are", "both", "he", "I", "she", "they", "someone", "it"];

// OpenAI client
const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// 缓存：避免重复请求相同的词
const variationsCache = new Map<string, string[]>();

export async function registerRoutes(app: Express): Promise<Server> {
  // 获取词的变体（使用 LLM）
  app.post("/api/word-variations", async (req, res) => {
    try {
      const { word } = req.body;
      
      if (!word) {
        return res.status(400).json({ message: "Word is required" });
      }

      // 检查缓存
      if (variationsCache.has(word)) {
        return res.json({ variations: variationsCache.get(word) });
      }

      // 如果没有 API key，返回简单变体
      if (!openai) {
        const fallback = [word, word.toUpperCase(), word.toLowerCase()];
        return res.json({ variations: fallback });
      }

      // 调用 OpenAI 生成变体
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{
          role: "system",
          content: "You are a creative writer. Generate 5 interesting variations or synonyms of the given word. Return ONLY a comma-separated list, no explanations."
        },  // 这个逻辑可以与花
        { 
          role: "user",
          content: word
        }],
        temperature: 0.8,
        max_tokens: 50
      });

      const variations = response.choices[0]?.message?.content
        ?.split(',')
        .map(v => v.trim())
        .filter(v => v.length > 0) || [word];

      // 缓存结果
      variationsCache.set(word, variations);
      
      res.json({ variations });
    } catch (error: any) {
      console.error("Error generating variations:", error);
      res.json({ variations: [req.body.word || ""] }); // 失败时返回原词
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
