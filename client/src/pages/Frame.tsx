import React, { useState, useEffect, useRef } from "react";

const textElements = [
  { id: "subject", text: "We", top: "top-[76px]", left: "left-[380px]", rotate: "" },
  { id: "verb", text: "are staying", top: "top-[76px]", left: "left-[501px]", rotate: "" },
  { id: "time", text: "tonight", top: "top-[122px]", left: "left-[671px]", rotate: "" },
  {
    id: "location",
    text: "by the window",
    top: "top-[181px]",
    left: "left-[681px]",
    rotate: "",
  },
  { id: "object", text: "silence", top: "top-[248px]", left: "left-[733px]", rotate: "" },
  {
    id: "conjunction",
    text: "because",
    top: "top-[175px]",
    left: "left-[577px]",
    rotate: "rotate-45",
  },
  {
    id: "adverb",
    text: "much",
    top: "top-[303px]",
    left: "left-[789px]",
    rotate: "rotate-45",
  },
  {
    id: "adverb2",
    text: "too",
    top: "top-[338px]",
    left: "left-[787px]",
    rotate: "rotate-45",
  },
  { id: "verb2", text: "has", top: "top-[248px]", left: "left-[618px]", rotate: "" },
  { id: "subject2", text: "the moon", top: "top-[248px]", left: "left-[463px]", rotate: "" },
];

const languages = [
  { text: "EN", color: "text-black" },
  // { text: "Italiano", color: "text-[#c0c0c0]" },
  // { text: "中文", color: "text-[#d8d8d8]" },
];

// Fixed word list for left panel rotation
const FIXED_WORD_LIST = ["we", "are", "both", "he", "I", "she", "they", "someone", "it"];

export const Frame = (): JSX.Element => {
  // Left panel: track mouse and encoder contributions separately
  const [mouseRotation, setMouseRotation] = useState(0);
  const [encoderRotation, setEncoderRotation] = useState(0);
  const rotation = mouseRotation + encoderRotation;
  
  const [isDragging, setIsDragging] = useState(false);
  // 存储每个位置当前显示的单词: { index: "word" }
  const [wordStates, setWordStates] = useState<Record<number, string>>({});
  const panelRef = useRef<HTMLDivElement>(null);
  const lastAngleRef = useRef(0);

  // Right panel: track mouse and encoder contributions separately
  const [rightMouseRotation, setRightMouseRotation] = useState(0);
  const [rightEncoderRotation, setRightEncoderRotation] = useState(0);
  const rightRotation = rightMouseRotation + rightEncoderRotation;
  
  // 词的变体和当前变体索引
  const [wordVariations, setWordVariations] = useState<string[]>([]);
  const [variationIndex, setVariationIndex] = useState(0);
  
  // Debug: Log rotation changes to verify UI updates
  useEffect(() => {
    console.log(`🎨 Left panel rotation: ${rotation.toFixed(1)}° (mouse: ${mouseRotation.toFixed(1)}° + encoder: ${encoderRotation.toFixed(1)}°)`);
  }, [rotation, mouseRotation, encoderRotation]);
  
  useEffect(() => {
    console.log(`🎨 Right panel rotation: ${rightRotation.toFixed(1)}° (mouse: ${rightMouseRotation.toFixed(1)}° + encoder: ${rightEncoderRotation.toFixed(1)}°)`);
  }, [rightRotation, rightMouseRotation, rightEncoderRotation]);
  
  // Debug: Log rotation changes
  useEffect(() => {
    console.log(`🎨 Right panel rotation updated: ${rightRotation.toFixed(1)}° (mouse: ${rightMouseRotation.toFixed(1)}° + encoder: ${rightEncoderRotation.toFixed(1)}°)`);
  }, [rightRotation, rightMouseRotation, rightEncoderRotation]);
  
  const [isRightDragging, setIsRightDragging] = useState(false);
  const [selectedTextElementIndex, setSelectedTextElementIndex] = useState(0);
  const rightPanelRef = useRef<HTMLImageElement>(null);
  const lastRightAngleRef = useRef(0);
  const lastRightRotationRef = useRef(0);

  // Arduino encoder state
  const [arduinoConnected, setArduinoConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const lastEncoder1Ref = useRef(0);
  const lastEncoder2Ref = useRef(0);
  // Debug display state (updates UI when encoder values change)
  const [debugEncoder1, setDebugEncoder1] = useState(0);
  const [debugEncoder2, setDebugEncoder2] = useState(0);
  
  // Refs for dragging state to avoid WebSocket reconnection
  const isDraggingRef = useRef(false);
  const isRightDraggingRef = useRef(false);

  // 存储当前选中单词的变体列表
  const [currentVariations, setCurrentVariations] = useState<string[]>([]);
  
  // 1. 当选中的单词改变时，获取新单词的变体
  useEffect(() => {
    const currentElement = textElements[selectedTextElementIndex];
    const originalWord = currentElement.text;
    
    // 先重置为原始词
    setCurrentVariations([originalWord]);
    // 清除该位置的当前修改（可选，看是否想保留之前的修改）
    // setWordStates(prev => ({ ...prev, [selectedTextElementIndex]: originalWord }));

    // 请求 LLM 变体
    fetch('/api/word-variations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: originalWord })
    })
      .then(res => res.json())
      .then(data => {
        if (data.variations && data.variations.length > 0) {
          // 把原始词放在第一个，后面跟着变体
          setCurrentVariations([originalWord, ...data.variations]);
        }
      })
      .catch(console.error);
  }, [selectedTextElementIndex]);

  // 2. 左边转盘：在变体列表中切换
  useEffect(() => {
    if (currentVariations.length === 0) return;

    const normalizedAngle = ((rotation % 360) + 360) % 360;
    // 根据变体数量划分圆周
    // 比如有5个变体，每72度切换一个
    const segmentSize = 360 / Math.max(1, currentVariations.length);
    const variationIndex = Math.floor(normalizedAngle / segmentSize) % currentVariations.length;
    
    if (variationIndex >= 0 && variationIndex < currentVariations.length) {
      const selectedVariation = currentVariations[variationIndex];
      
      // 更新显示
      setWordStates(prev => ({
        ...prev,
        [selectedTextElementIndex]: selectedVariation
      }));
    }
  }, [rotation, currentVariations, selectedTextElementIndex]);

  // 右边转盘：切换选中的单词位置 (Index)
  // 顺时针 -> 下一个单词，逆时针 -> 上一个单词
  useEffect(() => {
    const rotationChange = rightRotation - lastRightRotationRef.current;
    const threshold = 60; // 每60度切换一个单词
    const steps = Math.floor(Math.abs(rotationChange) / threshold);
    
    if (steps > 0) {
      const direction = rotationChange > 0 ? 1 : -1;
      
      setSelectedTextElementIndex((prev) => {
        const newIndex = prev + (steps * direction);
        return ((newIndex % textElements.length) + textElements.length) % textElements.length;
      });
      
      lastRightRotationRef.current += steps * threshold * direction;
    }
  }, [rightRotation]);

  // WebSocket connection for Arduino encoders
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/encoder`;
    
    const connectWebSocket = () => {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        let needsSync = true; // Flag to sync on first message after connection

        ws.onopen = () => {
          console.log("✅ Arduino WebSocket connected");
          setArduinoConnected(true);
          needsSync = true; // Reset sync flag on every connection
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log("📨 WebSocket message received:", message.type, message.data);
            
            if (message.type === "encoder" && message.data) {
              const { encoder1, encoder2 } = message.data;
              console.log(`🎛️ Processing encoder values: E1=${encoder1}, E2=${encoder2}`);

              // On first message after connection/reconnection, sync both refs AND rotation states
              if (needsSync) {
                console.log("🔄 Syncing encoder positions:", { encoder1, encoder2 });
                // Calculate absolute position from encoder counts
                const encoder1Rotation = encoder1 * 3.6;
                const encoder2Rotation = encoder2 * 3.6;
                
                console.log(`   Setting rotations: E1=${encoder1Rotation}°, E2=${encoder2Rotation}°`);
                
                // Reset encoder rotation states to match hardware position
                setEncoderRotation(encoder1Rotation);
                setRightEncoderRotation(encoder2Rotation);
                
                // Sync refs for future delta calculations
                lastEncoder1Ref.current = encoder1;
                lastEncoder2Ref.current = encoder2;
                setDebugEncoder1(encoder1);
                setDebugEncoder2(encoder2);
                needsSync = false;
                console.log("✅ Encoder sync complete");
                return;
              }

              // Encoder 1 controls left panel (word selection)
              // Update encoder contribution independently of mouse
              if (encoder1 !== lastEncoder1Ref.current) {
                let delta = encoder1 - lastEncoder1Ref.current;
                console.log(`🔄 E1 changed: ${lastEncoder1Ref.current} → ${encoder1} (Δ${delta})`);
                
                // Handle large jumps (e.g., if encoder was reset or wrapped)
                // If delta is too large (>100 steps), assume it's a reset/sync issue
                if (Math.abs(delta) > 100) {
                  console.warn("⚠️ Large encoder1 delta detected:", delta, "- treating as sync");
                  // Calculate absolute position instead
                  const absoluteRotation = encoder1 * 3.6;
                  console.log(`   Setting absolute rotation: ${absoluteRotation}°`);
                  setEncoderRotation(absoluteRotation);
                } else {
                  // Normal incremental update
                  setEncoderRotation((prevEnc) => {
                    const newEncoderRotation = prevEnc + (delta * 3.6);
                    console.log(`   Updating E1 rotation: ${prevEnc.toFixed(1)}° + ${(delta * 3.6).toFixed(1)}° = ${newEncoderRotation.toFixed(1)}°`);
                    return newEncoderRotation;
                  });
                }
                
                lastEncoder1Ref.current = encoder1;
                setDebugEncoder1(encoder1);
              } else {
                console.log(`   E1 unchanged: ${encoder1}`);
              }

              // Encoder 2 controls right panel (text element selection)
              // Update encoder contribution independently of mouse
              if (encoder2 !== lastEncoder2Ref.current) {
                let delta = encoder2 - lastEncoder2Ref.current;
                console.log(`🔄 E2 changed: ${lastEncoder2Ref.current} → ${encoder2} (Δ${delta})`);
                
                // Handle large jumps (e.g., if encoder was reset or wrapped)
                // If delta is too large (>100 steps), assume it's a reset/sync issue
                if (Math.abs(delta) > 100) {
                  console.warn("⚠️ Large encoder2 delta detected:", delta, "- treating as sync");
                  // Calculate absolute position instead
                  const absoluteRotation = encoder2 * 3.6;
                  console.log(`   Setting absolute rotation: ${absoluteRotation}°`);
                  setRightEncoderRotation(absoluteRotation);
                } else {
                  // Normal incremental update
                  setRightEncoderRotation((prevEnc) => {
                    const newEncoderRotation = prevEnc + (delta * 3.6);
                    console.log(`   Updating E2 rotation: ${prevEnc.toFixed(1)}° + ${(delta * 3.6).toFixed(1)}° = ${newEncoderRotation.toFixed(1)}°`);
                    return newEncoderRotation;
                  });
                }
                
                lastEncoder2Ref.current = encoder2;
                setDebugEncoder2(encoder2);
              } else {
                console.log(`   E2 unchanged: ${encoder2}`);
              }
            } else {
              console.warn("⚠️ Unexpected message type:", message);
            }
          } catch (error) {
            console.error("❌ Error parsing WebSocket message:", error, "Raw data:", event.data);
          }
        };

        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          setArduinoConnected(false);
        };

        ws.onclose = () => {
          console.log("Arduino WebSocket disconnected");
          setArduinoConnected(false);
          // Attempt to reconnect after 3 seconds
          setTimeout(connectWebSocket, 3000);
        };
      } catch (error) {
        console.error("Failed to create WebSocket:", error);
        setTimeout(connectWebSocket, 3000);
      }
    };

    connectWebSocket();

    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []); // Empty dependency array - establish connection once and maintain it

  // Calculate angle between two points
  const getAngle = (centerX: number, centerY: number, pointX: number, pointY: number) => {
    return Math.atan2(pointY - centerY, pointX - centerX) * (180 / Math.PI);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!panelRef.current) return;
    
    // Prevent default drag behavior
    e.preventDefault();
    
    setIsDragging(true);
    isDraggingRef.current = true;
    const rect = panelRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    lastAngleRef.current = getAngle(centerX, centerY, e.clientX, e.clientY);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging && panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const currentAngle = getAngle(centerX, centerY, e.clientX, e.clientY);
      
      // Calculate delta from last tracked angle
      let deltaAngle = currentAngle - lastAngleRef.current;
      
      // Normalize delta to handle angle wrapping (-180 to 180)
      if (deltaAngle > 180) deltaAngle -= 360;
      if (deltaAngle < -180) deltaAngle += 360;
      
      // Update only mouse contribution (word selection handled by effect)
      setMouseRotation((prev) => prev + deltaAngle);
      
      lastAngleRef.current = currentAngle;
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    isDraggingRef.current = false;
    // Note: lastAngleRef will be reset on next mousedown based on current rotation
  };

  // Right panel mouse handlers
  const handleRightMouseDown = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!rightPanelRef.current) return;
    
    // Prevent default drag behavior
    e.preventDefault();
    
    setIsRightDragging(true);
    isRightDraggingRef.current = true;
    const rect = rightPanelRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    lastRightAngleRef.current = getAngle(centerX, centerY, e.clientX, e.clientY);
  };

  const handleRightMouseMove = (e: MouseEvent) => {
    if (isRightDragging && rightPanelRef.current) {
      const rect = rightPanelRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const currentAngle = getAngle(centerX, centerY, e.clientX, e.clientY);
      
      // Calculate delta from last tracked angle
      let deltaAngle = currentAngle - lastRightAngleRef.current;
      
      // Normalize delta to handle angle wrapping (-180 to 180)
      if (deltaAngle > 180) deltaAngle -= 360;
      if (deltaAngle < -180) deltaAngle += 360;
      
      // Update only mouse contribution (token selection handled by effect)
      setRightMouseRotation((prev) => prev + deltaAngle);
      
      lastRightAngleRef.current = currentAngle;
    }
  };

  const handleRightMouseUp = () => {
    setIsRightDragging(false);
    isRightDraggingRef.current = false;
    // Note: lastRightAngleRef will be reset on next mousedown based on current rotation
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging]);

  useEffect(() => {
    if (isRightDragging) {
      window.addEventListener("mousemove", handleRightMouseMove);
      window.addEventListener("mouseup", handleRightMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleRightMouseMove);
        window.removeEventListener("mouseup", handleRightMouseUp);
      };
    }
  }, [isRightDragging]);

  return (
    <main className="bg-white w-full min-h-screen flex items-center justify-center relative">
      <header className="absolute top-8 left-12 w-[61px] [font-family:'Karantina',Helvetica] font-normal text-black text-[90px] tracking-[0] leading-[normal] whitespace-nowrap z-10">
        O2
      </header>
      
      {/* Arduino connection status indicator */}
      <div className="absolute top-8 right-12 flex flex-col items-end gap-2 text-sm z-10" data-testid="arduino-status">
        <div className="flex items-center gap-2">
          <div 
            className={`w-3 h-3 rounded-full ${arduinoConnected ? 'bg-green-500' : 'bg-gray-400'}`}
            data-testid="status-indicator"
          />
          <span className="text-gray-700">
            {arduinoConnected ? 'Arduino Connected' : 'Mouse Control'}
          </span>
        </div>
        
        {/* Debug panel - shows encoder values and rotations */}
        {arduinoConnected && (
          <div className="bg-black/80 text-white text-xs p-2 rounded font-mono space-y-1 min-w-[220px]">
            <div className="text-green-400 font-bold">Encoder Debug</div>
            <div>E1: {debugEncoder1} → {debugEncoder1 * 3.6}°</div>
            <div>E2: {debugEncoder2} → {debugEncoder2 * 3.6}°</div>
            <div className="border-t border-gray-600 pt-1 mt-1">
              <div>Left: {rotation.toFixed(1)}°</div>
              <div className="text-gray-400 text-[10px]">  M:{mouseRotation.toFixed(1)}° + E:{encoderRotation.toFixed(1)}°</div>
              <div>Right: {rightRotation.toFixed(1)}°</div>
              <div className="text-gray-400 text-[10px]">  M:{rightMouseRotation.toFixed(1)}° + E:{rightEncoderRotation.toFixed(1)}°</div>
            </div>
          </div>
        )}
      </div>
      
      <div className="w-[1362px] h-[906px] relative">
      <nav className="absolute top-[729px] left-[615px] w-[141px] [font-family:'Inter',Helvetica] font-normal text-2xl text-center tracking-[0] leading-[normal]">
        {languages.map((lang, index) => (
          <div key={index}>
            <span 
              className={lang.color}
              data-testid={`token-${lang.text}`}
            >
              {lang.text}
              {index < languages.length - 1 && "\u00A0\u00A0"}
            </span>
            {index < languages.length - 1 && (
              <span className="text-black">
                <br />
              </span>
            )}
          </div>
        ))}
      </nav>

      <img
        className="top-[76px] left-[416px] w-[427px] h-[316px] absolute object-cover"
        alt="Image"
        src="/figmaAssets/image-4.png"
      />

      <div
        ref={panelRef}
        className="top-[287px] left-[110px] w-[620px] h-[619px] absolute cursor-grab active:cursor-grabbing relative select-none"
        style={{
          transform: `rotate(${rotation}deg)`,
          transformOrigin: "center center",
        }}
        onMouseDown={handleMouseDown}
        data-testid="panel-rotate"
      >
        <img
          className="w-full h-full rounded-[309.5px] object-cover pointer-events-none"
          alt="Rotatable panel"
          src="/figmaAssets/image-6.png"
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
        />
      </div>

      <img
        ref={rightPanelRef}
        className="top-[287px] left-[633px] w-[620px] h-[619px] rounded-[309.5px] absolute object-cover cursor-grab active:cursor-grabbing select-none"
        alt="Image"
        src="/figmaAssets/image-6.png"
        style={{ transform: `rotate(${rightRotation}deg)` }}
        onMouseDown={handleRightMouseDown}
        onDragStart={(e) => e.preventDefault()}
        draggable={false}
        data-testid="panel-right"
      />

      {textElements.map((element, index) => (
        <div
          key={index}
          className={`absolute ${element.top} ${element.left} ${element.rotate} [font-family:'Inter',Helvetica] font-normal ${selectedTextElementIndex === index ? 'text-[#808080]' : 'text-black'} text-2xl tracking-[0] leading-[normal]`}
          data-testid={`text-${element.id}`}
        >
          {wordStates[index] || element.text}
        </div>
      ))}
      </div>
    </main>
  );
};
