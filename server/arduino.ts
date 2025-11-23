import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import { WebSocketServer, WebSocket } from "ws";

interface EncoderData {
  encoder1: number;
  encoder2: number;
}

// Helper function to list available serial ports
async function listSerialPorts(): Promise<string[]> {
  try {
    const ports = await SerialPort.list();
    return ports.map((port) => port.path);
  } catch (error) {
    console.error("Error listing serial ports:", error);
    return [];
  }
}

// Helper function to find Arduino port
async function findArduinoPort(): Promise<string | null> {
  // First, check if port is explicitly set via environment variable
  const envPort = process.env.ARDUINO_PORT;
  if (envPort) {
    console.log(`Using Arduino port from environment: ${envPort}`);
    return envPort;
  }

  // List all available ports
  const ports = await listSerialPorts();
  
  if (ports.length === 0) {
    console.warn("⚠️ No serial ports found. Make sure Arduino is connected.");
    return null;
  }

  console.log("🔍 Available serial ports:", ports.join(", "));

  // Common Arduino port patterns
  const arduinoPatterns = [
    /usbmodem/i,      // Mac: /dev/cu.usbmodem*
    /usbserial/i,     // Mac: /dev/cu.usbserial*
    /ttyUSB/i,        // Linux: /dev/ttyUSB*
    /ttyACM/i,        // Linux: /dev/ttyACM*
    /^COM\d+$/i,      // Windows: COM3, COM4, etc.
  ];

  // Try to find a port matching Arduino patterns
  for (const port of ports) {
    for (const pattern of arduinoPatterns) {
      if (pattern.test(port)) {
        console.log(`✓ Found potential Arduino port: ${port}`);
        return port;
      }
    }
  }

  // If no pattern match, use the first available port (user can override with env var)
  if (ports.length > 0) {
    console.log(`⚠️ No Arduino pattern match found. Using first available port: ${ports[0]}`);
    console.log(`   To specify a port, set ARDUINO_PORT environment variable`);
    return ports[0];
  }

  return null;
}

export class ArduinoHandler {
  private port: SerialPort | null = null;
  private parser: ReadlineParser | null = null;
  private wss: WebSocketServer | null = null;
  private currentData: EncoderData = { encoder1: 0, encoder2: 0 };
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnected: boolean = false;

  async initialize(wss: WebSocketServer): Promise<void> {
    this.wss = wss;
    await this.connectToArduino();
    
    // Attempt reconnection every 10 seconds if not connected
    this.reconnectTimer = setInterval(async () => {
      if (!this.isConnected) {
        await this.connectToArduino();
      }
    }, 10000);
  }

  private async connectToArduino(): Promise<void> {
    // Don't try to reconnect if already connected
    if (this.isConnected && this.port?.isOpen) {
      return;
    }

    // Clean up existing connection if any
    if (this.port) {
      try {
        if (this.parser) {
          this.parser.removeAllListeners();
          this.parser = null;
        }
        if (this.port.isOpen) {
          this.port.removeAllListeners();
          // Wait for port to fully close before proceeding
          await new Promise<void>((resolve) => {
            this.port!.close((err) => {
              if (err) console.error("Error closing port:", err);
              resolve();
            });
          });
        }
        this.port = null;
      } catch (error) {
        console.error("Error cleaning up previous connection:", error);
      }
    }

    // Find Arduino port (auto-detect or use environment variable)
    const arduinoPort = await findArduinoPort();
    
    if (!arduinoPort) {
      console.error("❌ Could not find Arduino port. Please:");
      console.error("   1. Make sure Arduino is connected via USB");
      console.error("   2. Close Arduino IDE Serial Monitor if it's open");
      console.error("   3. Set ARDUINO_PORT environment variable to specify the port");
      console.error("      Example: export ARDUINO_PORT=/dev/cu.usbmodem141401");
      this.isConnected = false;
      return;
    }

    try {
      console.log(`🔌 Connecting to Arduino at ${arduinoPort}...`);

      // Open serial port
      this.port = new SerialPort({
        path: arduinoPort,
        baudRate: 9600,
      });

      // Create parser for line-based communication
      this.parser = this.port.pipe(new ReadlineParser({ delimiter: "\r\n" }));

      this.port.on("open", () => {
        console.log("✓ Arduino connection established");
        this.isConnected = true;
      });

      this.port.on("error", (err) => {
        console.error("Serial port error:", err.message);
        this.isConnected = false;
      });

      this.port.on("close", () => {
        console.log("Arduino disconnected");
        this.isConnected = false;
      });

      // Listen for ALL serial data (including raw bytes) for debugging
      this.port.on("data", (data: Buffer) => {
        // Log first few raw bytes to verify connection
        if (!this.isConnected) {
          console.log("📥 Raw serial data received (first connection):", data.toString().substring(0, 50));
        }
      });

      // Listen for encoder data
      this.parser.on("data", (line: string) => {
        const msg = line.trim();
        
        // Log ALL incoming serial messages for debugging
        console.log("📥 Serial received:", JSON.stringify(msg));
        
        try {
          // Expected format: "E1:123,E2:456"
          const match = msg.match(/E1:(-?\d+),E2:(-?\d+)/);
          if (match) {
            const encoder1 = parseInt(match[1], 10);
            const encoder2 = parseInt(match[2], 10);
            
            // Only update and broadcast if values actually changed
            if (this.currentData.encoder1 !== encoder1 || this.currentData.encoder2 !== encoder2) {
              const oldData = { ...this.currentData };
              this.currentData = {
                encoder1,
                encoder2,
              };

              // Debug: Log encoder changes
              console.log(`📊 Encoder update: E1: ${oldData.encoder1} → ${encoder1} (Δ${encoder1 - oldData.encoder1}), E2: ${oldData.encoder2} → ${encoder2} (Δ${encoder2 - oldData.encoder2})`);

              // Broadcast to all connected WebSocket clients
              const clientCount = this.wss?.clients.size || 0;
              console.log(`📡 Broadcasting to ${clientCount} WebSocket client(s)`);
              this.broadcast(this.currentData);
            } else {
              // Still log that we received data, even if values didn't change
              console.log(`✓ Encoder data received (no change): E1=${encoder1}, E2=${encoder2}`);
            }
          } else if (msg.length > 0) {
            // Log non-empty messages that don't match expected format (for debugging)
            console.warn("⚠️ Unexpected serial format:", JSON.stringify(msg));
            console.warn("   Expected format: E1:<number>,E2:<number>");
            console.warn("   Make sure Arduino code is uploaded and running!");
          }
        } catch (error) {
          console.error("Error parsing encoder data:", error, "Raw line:", JSON.stringify(msg));
        }
      });
      
      // Add error handler for parser
      this.parser.on("error", (err) => {
        console.error("Parser error:", err);
      });
    } catch (error) {
      console.error("Failed to connect to Arduino:", error);
      this.isConnected = false;
    }
  }

  private broadcast(data: EncoderData): void {
    if (!this.wss) {
      console.warn("⚠️ Cannot broadcast: WebSocket server not initialized");
      return;
    }

    const message = JSON.stringify({
      type: "encoder",
      data,
    });

    let sentCount = 0;
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
          sentCount++;
        } catch (error) {
          console.error("Error sending WebSocket message:", error);
        }
      }
    });
    
    if (sentCount === 0) {
      console.warn("⚠️ No WebSocket clients connected to receive encoder data");
    }
  }

  getCurrentData(): EncoderData {
    return this.currentData;
  }

  getConnectionStatus(): { connected: boolean; port: string | null; lastData: EncoderData } {
    return {
      connected: this.isConnected && this.port?.isOpen === true,
      port: this.port?.path || null,
      lastData: this.currentData,
    };
  }

  close(): void {
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
    }
    if (this.port?.isOpen) {
      this.port.close();
    }
  }
}

export const arduinoHandler = new ArduinoHandler();
