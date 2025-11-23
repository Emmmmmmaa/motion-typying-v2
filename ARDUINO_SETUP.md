# Arduino KY040 Dual Encoder Setup Guide

This guide will help you connect your 2 KY040 rotary encoders to your Arduino UNO3 and integrate them with the web application.

## Hardware Requirements

- 1x Arduino UNO3
- 2x KY040 Rotary Encoder modules
- USB-C cable (for connecting Arduino to computer)
- Jumper wires (male-to-female recommended)

## Hardware Connections

### Encoder 1 (Controls Left Panel - Word Selection)

| KY040 Pin | Arduino Pin | Description |
|-----------|-------------|-------------|
| CLK       | Pin 2       | Clock signal (interrupt capable) |
| DT        | Pin 3       | Data signal |
| SW        | Pin 4       | Push button (optional) |
| +         | 5V          | Power |
| GND       | GND         | Ground |

### Encoder 2 (Controls Right Panel - Text Element Selection)

| KY040 Pin | Arduino Pin | Description |
|-----------|-------------|-------------|
| CLK       | Pin 5       | Clock signal (interrupt capable) |
| DT        | Pin 6       | Data signal |
| SW        | Pin 7       | Push button (optional) |
| +         | 5V          | Power |
| GND       | GND         | Ground |

## Software Setup

### Step 1: Upload Arduino Sketch

1. Install the Arduino IDE from [arduino.cc](https://www.arduino.cc/en/software) if you haven't already
2. Open the Arduino IDE
3. Connect your Arduino UNO3 to your computer via USB-C
4. Open the sketch file: `arduino/KY040_Dual_Encoder.ino`
5. Select your Arduino board:
   - Go to **Tools > Board > Arduino AVR Boards > Arduino Uno**
6. Select the correct port:
   - Go to **Tools > Port** and select the port showing your Arduino (usually `/dev/ttyUSB0` on Linux, `COM3+` on Windows, or `/dev/cu.usbmodem*` on Mac)
7. Click the **Upload** button (right arrow icon)
8. Wait for the upload to complete (you should see "Done uploading")

### Step 2: Verify Arduino Connection

1. Open the Serial Monitor in Arduino IDE (**Tools > Serial Monitor**)
2. Set the baud rate to **9600**
3. You should see messages like:
   ```
   Dual Encoder Ready
   E1:0,E2:0
   E1:1,E2:0
   E1:2,E2:1
   ```
4. Try rotating the encoders - you should see the numbers change
5. Close the Serial Monitor before running the web app (only one program can use the serial port at a time)

### Step 3: Run the Web Application

1. Make sure your Arduino is connected via USB-C
2. The web application will automatically detect and connect to your Arduino
3. Look for the connection status indicator in the top-right corner of the webpage:
   - **Green dot + "Arduino Connected"** = Arduino is connected and working
   - **Gray dot + "Mouse Control"** = Arduino not detected, using mouse control

## How It Works

### Encoder 1 (Left Panel)
- **Rotate clockwise**: Moves to the next word variation
- **Rotate counter-clockwise**: Moves to the previous word variation
- The panel rotates smoothly and updates the displayed word
- **Press button** (optional): Resets encoder position to 0

### Encoder 2 (Right Panel)
- **Rotate clockwise**: Selects the next text element
- **Rotate counter-clockwise**: Selects the previous text element
- Selected text element is highlighted in gray
- **Press button** (optional): Resets encoder position to 0

### Sensitivity Settings

The current settings provide:
- **1 encoder click = 3.6 degrees** of panel rotation
- **100 encoder clicks = 360 degrees** (full rotation)

You can adjust the sensitivity by modifying the multiplier in `client/src/pages/Frame.tsx` (line 146 and 167):
```javascript
const newRotation = prev + (delta * 3.6);  // Change 3.6 to adjust sensitivity
```

## Troubleshooting

### Arduino Not Detected

1. **Check USB connection**: Make sure the USB-C cable is properly connected
2. **Close Serial Monitor**: The web app can't connect if Arduino IDE's Serial Monitor is open
3. **Check permissions** (Linux): You may need to add your user to the `dialout` group:
   ```bash
   sudo usermod -a -G dialout $USER
   ```
   Then log out and log back in
4. **Check driver** (Windows): Install the CH340 or FTDI driver if needed
5. **Verify upload**: Re-upload the Arduino sketch to ensure it's running correctly

### Encoders Not Responding

1. **Check wiring**: Verify all connections match the wiring diagram above
2. **Test with Serial Monitor**: Open Arduino IDE's Serial Monitor to see if encoder values are changing
3. **Check encoder orientation**: Some KY040 modules have pins in different orders
4. **Verify power**: Make sure the encoder modules are getting 5V power (LED on module should be lit)

### Erratic Behavior

1. **Add debouncing**: If the encoder is jumping values, try adding a small capacitor (0.1µF) between CLK/DT and GND
2. **Check connections**: Loose wires can cause erratic readings
3. **Reduce cable length**: Long jumper wires can pick up noise

### Mouse Control Still Active

- Mouse control works simultaneously with Arduino control
- You can use both methods at the same time
- To use only Arduino control, you can disable mouse handlers in the code

## Technical Details

### Serial Communication Format

The Arduino sends data in this format:
```
E1:<position>,E2:<position>\n
```

Example:
```
E1:42,E2:17
```

- `E1`: Encoder 1 position (can be positive or negative)
- `E2`: Encoder 2 position (can be positive or negative)
- Data is sent 20 times per second (every 50ms)

### WebSocket Connection

- The web app connects to `ws://localhost:5000/ws/encoder` (or `wss://` for HTTPS)
- Real-time bidirectional communication
- Automatic reconnection if connection is lost
- Connection status is displayed in the UI

## Customization

### Change Rotation Speed

Edit `client/src/pages/Frame.tsx`:
```javascript
// Line 146 and 167
const newRotation = prev + (delta * 3.6);  // Increase for faster rotation
```

### Change Text Element Selection Threshold

Edit `client/src/pages/Frame.tsx`:
```javascript
// Line 171
const threshold = 60;  // Decrease for more sensitive selection
```

### Add More Encoders

1. Connect additional encoders to other interrupt-capable pins (pins 2, 3 on Uno)
2. Update the Arduino sketch to read the new encoder
3. Modify the WebSocket message format to include the new encoder data
4. Update the frontend to handle the new encoder

## Support

If you encounter any issues:
1. Check the browser console for error messages (F12 → Console tab)
2. Check the server logs in the terminal
3. Verify Arduino is sending data via Serial Monitor
4. Ensure all wiring matches the diagram exactly
