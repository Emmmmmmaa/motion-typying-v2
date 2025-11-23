/*
 * Dual KY040 Rotary Encoder Reader for Arduino UNO R3
 * 
 * Hardware Connections:
 * Encoder 1 (Left Panel):
 *   CLK -> Pin 2 (interrupt 0)
 *   DT  -> Pin 3
 *   SW  -> Pin 4 (optional button)
 *   +   -> 5V
 *   GND -> GND
 * 
 * Encoder 2 (Right Panel):
 *   CLK -> Pin 5
 *   DT  -> Pin 6
 *   SW  -> Pin 7 (optional button)
 *   +   -> 5V
 *   GND -> GND
 */

// Encoder 1 pins (Left Panel)
#define ENCODER1_CLK 2
#define ENCODER1_DT 3
#define ENCODER1_SW 4

// Encoder 2 pins (Right Panel)
#define ENCODER2_CLK 5
#define ENCODER2_DT 6
#define ENCODER2_SW 7

// Encoder positions (can be negative for counter-clockwise)
volatile long encoder1Position = 0;
volatile long encoder2Position = 0;

// Previous states for quadrature decoding (both CLK and DT)
volatile int encoder1LastState = 0;
volatile int encoder2LastState = 0;

// Interrupt service routine for Encoder 1 (uses interrupt-capable pin 2)
void encoder1ISR() {
  // Read current state of both pins
  int clkState = digitalRead(ENCODER1_CLK);
  int dtState = digitalRead(ENCODER1_DT);
  
  // Combine CLK and DT into a 2-bit state (0-3)
  int currentState = (clkState << 1) | dtState;
  
  // Quadrature decoding: state transitions indicate direction
  // Valid transitions for clockwise: 00->01->11->10->00
  // Valid transitions for counter-clockwise: 00->10->11->01->00
  if (encoder1LastState != currentState) {
    // Check for valid state transition
    if ((encoder1LastState == 0 && currentState == 1) ||
        (encoder1LastState == 1 && currentState == 3) ||
        (encoder1LastState == 3 && currentState == 2) ||
        (encoder1LastState == 2 && currentState == 0)) {
      // Clockwise rotation
      encoder1Position++;
    } else if ((encoder1LastState == 0 && currentState == 2) ||
               (encoder1LastState == 2 && currentState == 3) ||
               (encoder1LastState == 3 && currentState == 1) ||
               (encoder1LastState == 1 && currentState == 0)) {
      // Counter-clockwise rotation
      encoder1Position--;
    }
    encoder1LastState = currentState;
  }
}

// Polling function for Encoder 2 (pin 5 is not interrupt-capable)
void readEncoder2() {
  // Read current state of both pins
  int clkState = digitalRead(ENCODER2_CLK);
  int dtState = digitalRead(ENCODER2_DT);
  
  // Combine CLK and DT into a 2-bit state (0-3)
  int currentState = (clkState << 1) | dtState;
  
  // Quadrature decoding: state transitions indicate direction
  if (encoder2LastState != currentState) {
    // Check for valid state transition
    if ((encoder2LastState == 0 && currentState == 1) ||
        (encoder2LastState == 1 && currentState == 3) ||
        (encoder2LastState == 3 && currentState == 2) ||
        (encoder2LastState == 2 && currentState == 0)) {
      // Clockwise rotation
      encoder2Position++;
    } else if ((encoder2LastState == 0 && currentState == 2) ||
               (encoder2LastState == 2 && currentState == 3) ||
               (encoder2LastState == 3 && currentState == 1) ||
               (encoder2LastState == 1 && currentState == 0)) {
      // Counter-clockwise rotation
      encoder2Position--;
    }
    encoder2LastState = currentState;
  }
}

// Button press handlers (optional - resets encoder position)
void checkEncoder1Button() {
  static unsigned long lastPress1 = 0;
  if (digitalRead(ENCODER1_SW) == LOW) {
    unsigned long currentTime = millis();
    if (currentTime - lastPress1 > 200) { // 200ms debounce
      encoder1Position = 0;
      lastPress1 = currentTime;
    }
  }
}

void checkEncoder2Button() {
  static unsigned long lastPress2 = 0;
  if (digitalRead(ENCODER2_SW) == LOW) {
    unsigned long currentTime = millis();
    if (currentTime - lastPress2 > 200) { // 200ms debounce
      encoder2Position = 0;
      lastPress2 = currentTime;
    }
  }
}

void setup() {
  // Initialize serial communication
  Serial.begin(9600);
  
  // Configure encoder pins
  pinMode(ENCODER1_CLK, INPUT_PULLUP);
  pinMode(ENCODER1_DT, INPUT_PULLUP);
  pinMode(ENCODER1_SW, INPUT_PULLUP);
  
  pinMode(ENCODER2_CLK, INPUT_PULLUP);
  pinMode(ENCODER2_DT, INPUT_PULLUP);
  pinMode(ENCODER2_SW, INPUT_PULLUP);
  
  // Read initial states (combine CLK and DT into 2-bit state)
  int clk1 = digitalRead(ENCODER1_CLK);
  int dt1 = digitalRead(ENCODER1_DT);
  encoder1LastState = (clk1 << 1) | dt1;
  
  int clk2 = digitalRead(ENCODER2_CLK);
  int dt2 = digitalRead(ENCODER2_DT);
  encoder2LastState = (clk2 << 1) | dt2;
  
  // Attach interrupt for encoder 1 CLK pin (pin 2 is interrupt-capable)
  // Use CHANGE mode to detect both rising and falling edges
  attachInterrupt(digitalPinToInterrupt(ENCODER1_CLK), encoder1ISR, CHANGE);
  
  // Note: Encoder 2 uses pin 5 which is not interrupt-capable
  // It will be polled in the loop() function
  
  // Note: Removed "while (!Serial)" - it blocks on some boards
  // Serial communication will work once the port is opened by the computer
  delay(1000); // Give serial port time to initialize
  
  Serial.println("Dual Encoder Ready");
  Serial.println("Starting encoder data stream...");
}

void loop() {
  // Read encoder 2 using polling (pin 5 is not interrupt-capable)
  readEncoder2();
  
  // Check for button presses (optional reset functionality)
  checkEncoder1Button();
  checkEncoder2Button();
  
  // Send encoder positions via serial
  // Format: "E1:<position>,E2:<position>\r\n"
  Serial.print("E1:");
  Serial.print(encoder1Position);
  Serial.print(",E2:");
  Serial.print(encoder2Position);
  Serial.print("\r\n");
  
  // Send data at approximately 20Hz (every 50ms)
  delay(50);
}
