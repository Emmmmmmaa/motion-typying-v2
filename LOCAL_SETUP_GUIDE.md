# Running the Poetry App Locally with Arduino Encoders

This guide will help you run the interactive poetry application on your local computer so it can connect to your Arduino UNO3 with dual KY040 rotary encoders.

## Prerequisites

Before starting, make sure you have:

1. **Node.js** (version 18 or higher)
   - Download from: https://nodejs.org/
   - Verify installation: Open terminal/command prompt and run `node --version`

2. **Arduino IDE**
   - Download from: https://www.arduino.cc/en/software
   - Used to upload the encoder sketch to your Arduino

3. **Arduino UNO3** with dual KY040 rotary encoders
   - Wired according to `ARDUINO_SETUP.md` (if not already done)

4. **USB Cable** to connect Arduino to your computer

## Step 1: Download the Project

### Option A: Download from Replit
1. In your Replit project, click the three dots menu (⋮) in the top right
2. Select "Download as zip"
3. Extract the zip file to a folder on your computer (e.g., `C:\Projects\poetry-app` or `~/Projects/poetry-app`)

### Option B: Clone with Git (if available)
```bash
# If your Replit has Git enabled, you can clone it
git clone <your-replit-git-url> poetry-app
cd poetry-app
```

## Step 2: Install Dependencies

1. Open your terminal/command prompt
2. Navigate to the project folder:
   ```bash
   cd path/to/poetry-app
   ```

3. Install all required packages:
   ```bash
   npm install
   ```

   This will install all the necessary Node.js packages listed in `package.json`.

## Step 3: Set Up Arduino

### Upload the Encoder Sketch

1. **Open Arduino IDE**

2. **Open the sketch file:**
   - File → Open
   - Navigate to your project folder
   - Open `arduino/KY040_Dual_Encoder.ino`

3. **Select your Arduino board:**
   - Tools → Board → Arduino AVR Boards → Arduino Uno

4. **Select the correct port:**
   - Tools → Port → Select the port showing your Arduino (usually COM3, COM4 on Windows or /dev/ttyUSB0 on Linux)

5. **Upload the sketch:**
   - Click the Upload button (→) or press Ctrl+U
   - Wait for "Done uploading" message

6. **Verify it's working:**
   - Tools → Serial Monitor
   - Set baud rate to **115200**
   - Rotate your encoders - you should see JSON output like:
     ```json
     {"encoder1": 5, "encoder2": -3}
     {"encoder1": 6, "encoder2": -3}
     ```

### Wiring Reference

If you haven't wired your encoders yet, see `ARDUINO_SETUP.md` for complete wiring instructions. Quick reference:

**Encoder 1 (Left Panel):**
- CLK → Pin 2
- DT → Pin 3
- SW → Pin 4
- + → 5V
- GND → GND

**Encoder 2 (Right Panel):**
- CLK → Pin 5
- DT → Pin 6
- SW → Pin 7
- + → 5V
- GND → GND

## Step 4: Configure Environment Variables

1. Create a `.env` file in the project root (same folder as `package.json`)

2. Add your OpenAI API key:
   ```
   AI_INTEGRATIONS_OPENAI_API_KEY=your-api-key-here
   AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
   ```

   **Note:** If you don't have an OpenAI API key, the app will still work using fallback word variations.

## Step 5: Run the Application

1. **Make sure your Arduino is connected** via USB to your computer

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Wait for the server to start.** You should see:
   ```
   [express] serving on port 5000
   ```

4. **Open your browser** and navigate to:
   ```
   http://localhost:5000
   ```

## Step 6: Verify Arduino Connection

Once the app loads in your browser:

1. **Check the connection indicator:**
   - Look for "Arduino Connected" or a green indicator in the UI
   - If it shows "Disconnected", check the terminal/console for error messages

2. **Test the encoders:**
   - **Left Encoder:** Rotate to change the selected word on the left panel
   - **Right Encoder:** Rotate to switch between different text tokens on the right panel

3. **Test mouse control:**
   - You should still be able to click and drag both panels with your mouse
   - Mouse and encoder inputs work simultaneously!

## Troubleshooting

### Arduino Not Detected

**Problem:** Server can't find the Arduino

**Solutions:**
1. Make sure Arduino is plugged in via USB
2. Check that no other program (like Arduino IDE Serial Monitor) is using the port
3. On Windows, check Device Manager for COM port conflicts
4. Try unplugging and replugging the Arduino
5. Restart the server (Ctrl+C, then `npm run dev` again)

### Permission Errors (Linux/Mac)

**Problem:** "Error: Permission denied" when accessing serial port

**Solution:**
```bash
# Linux - Add your user to the dialout group
sudo usermod -a -G dialout $USER
# Then log out and log back in

# Mac - Usually no permissions needed, but check USB cable
```

### Encoders Sending Wrong Data

**Problem:** Rotation goes the wrong direction or is erratic

**Solutions:**
1. Verify baud rate is set to **115200** in both Arduino sketch and server
2. Check encoder wiring (CLK and DT might be swapped)
3. Add 0.1µF capacitors between encoder pins and GND if you have encoder bounce

### Port Already in Use

**Problem:** "Port 5000 is already in use"

**Solution:**
```bash
# Windows - Find and kill the process using port 5000
netstat -ano | findstr :5000
taskkill /PID <process-id> /F

# Mac/Linux
lsof -ti:5000 | xargs kill
```

## How It Works

When running locally:

1. **Backend** (`server/arduino.ts`):
   - Automatically scans for Arduino on available serial ports
   - Connects at 115200 baud
   - Reads JSON encoder data
   - Broadcasts data via WebSocket to connected browsers

2. **Frontend** (`client/src/pages/Frame.tsx`):
   - Connects to WebSocket at `ws://localhost:5000/ws/encoder`
   - Receives encoder position updates in real-time
   - Combines encoder input with mouse input
   - Updates panel rotations and word/token selections

3. **Input System**:
   - Mouse and encoder contributions are tracked independently
   - Both inputs work simultaneously without conflicts
   - Left encoder: 1 detent = 3.6° rotation (100 detents = full circle)
   - Right encoder: 60° threshold switches text tokens

## Next Steps

Once everything is working:

1. **Experiment with the encoders** - try rotating during mouse drags to see simultaneous control
2. **Adjust encoder sensitivity** - edit `client/src/pages/Frame.tsx` if 3.6° per detent feels too fast/slow
3. **Customize the poetry** - modify the sentence structure in the Frame component
4. **Generate more words** - the app uses AI to generate word variations automatically

## Switching Back to Cloud

To go back to using the app on Replit without Arduino:

1. The app works perfectly with mouse-only control
2. Simply use the Replit URL - mouse controls are always functional
3. Arduino is an optional enhancement, not required for core functionality

---

**Need help?** Check the terminal/console output for error messages. Most issues are related to:
- Arduino not connected via USB
- Wrong COM port selected
- Serial port already in use by another program
- Missing Node.js dependencies
