import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { Particle, Point, VisualTheme, InteractionMode } from '../types';
import { generateThemeFromGesture } from '../services/geminiService';

const DEFAULT_THEME: VisualTheme = {
  primaryColor: '#D4AF37', // Tungsten Gold
  secondaryColor: '#1A237E', // Deep Indigo
  mode: InteractionMode.WEAVE,
  tension: 1.0,
  entropy: 0.2,
  geometryScale: 100,
  description: "Awaiting Input"
};

const STRUCTURE_PARTICLE_COUNT = 150;
const STARDUST_PARTICLE_COUNT = 300;

export const Visualizer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(document.createElement("video"));
  
  const [theme, setTheme] = useState<VisualTheme>(DEFAULT_THEME);
  const [isLoaded, setIsLoaded] = useState(false);
  const [geminiStatus, setGeminiStatus] = useState("NEURAL LINK IDLE");
  
  const particles = useRef<Particle[]>([]);
  const handPoints = useRef<Point[]>([]); // Just fingertips
  const handSkeleton = useRef<Point[]>([]); // All joints
  const lastThemeUpdate = useRef<number>(0);
  const frameId = useRef<number>(0);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);

  // Initialize Particles with distinct types and screen adaptation
  const initParticles = useCallback((width: number, height: number, dpr: number) => {
    particles.current = [];
    
    // Type 1: Structural Weavers (Fast, geometric)
    for (let i = 0; i < STRUCTURE_PARTICLE_COUNT; i++) {
      particles.current.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5 * dpr, // Scale velocity by DPR
        vy: (Math.random() - 0.5) * 0.5 * dpr,
        size: (Math.random() * 2 + 1) * dpr, // Scale size by DPR
        color: DEFAULT_THEME.primaryColor,
        life: Math.random() * 100,
        maxLife: 100 + Math.random() * 50,
        type: 'STRUCTURE'
      });
    }

    // Type 2: Stardust (Slow, atmospheric)
    for (let i = 0; i < STARDUST_PARTICLE_COUNT; i++) {
      particles.current.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.1 * dpr,
        vy: (Math.random() - 0.5) * 0.1 * dpr,
        size: (Math.random() * 1.5) * dpr,
        color: DEFAULT_THEME.secondaryColor,
        life: Math.random() * 200,
        maxLife: 200 + Math.random() * 200,
        type: 'STARDUST'
      });
    }
  }, []);

  useEffect(() => {
    const setupMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2
        });
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener("loadeddata", () => {
            videoRef.current.play();
            setIsLoaded(true);
            // Initial setup will be handled by the resize listener
        });
      } catch (e) {
        console.error(e);
        setGeminiStatus("SENSOR MALFUNCTION");
      }
    };
    setupMediaPipe();
    return () => {
         if(videoRef.current.srcObject) (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    };
  }, []);

  // Robust Resize Handler including DPR adaptation
  useEffect(() => {
    const handleResize = () => {
        if (containerRef.current && canvasRef.current) {
            const dpr = window.devicePixelRatio || 1;
            const rect = containerRef.current.getBoundingClientRect();
            
            // Set internal resolution to match physical pixels for sharpness
            canvasRef.current.width = rect.width * dpr;
            canvasRef.current.height = rect.height * dpr;
            
            // CSS size should match the element size
            canvasRef.current.style.width = `${rect.width}px`;
            canvasRef.current.style.height = `${rect.height}px`;

            // Re-init particles with new boundary and scaling
            initParticles(rect.width * dpr, rect.height * dpr, dpr);
        }
    };
    
    // Attach listener
    window.addEventListener('resize', handleResize);
    
    // Call once to init
    handleResize();
    
    return () => window.removeEventListener('resize', handleResize);
  }, [initParticles]); // Depend on initParticles

  useEffect(() => {
    if (!isLoaded || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    let lastTime = performance.now();
    
    const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const render = async (time: number) => {
        const deltaTime = (time - lastTime);
        lastTime = time;
        const width = canvasRef.current!.width;
        const height = canvasRef.current!.height;
        const dpr = window.devicePixelRatio || 1;

        // 1. Hand Detection
        if (handLandmarkerRef.current && videoRef.current.readyState >= 2) {
            const results = handLandmarkerRef.current.detectForVideo(videoRef.current, time);
            
            const tips: Point[] = [];
            const joints: Point[] = [];
            let totalSpread = 0;
            let handCount = 0;

            if (results.landmarks) {
                handCount = results.landmarks.length;
                for (const landmarks of results.landmarks) {
                    // Normalize MediaPipe coordinates [0,1] to Canvas Physical Pixels
                    [4, 8, 12, 16, 20].forEach(i => {
                        tips.push({ x: (1 - landmarks[i].x) * width, y: landmarks[i].y * height });
                    });
                    
                    landmarks.forEach(lm => {
                         joints.push({ x: (1 - lm.x) * width, y: lm.y * height });
                    });
                    
                    const spreadRaw = Math.hypot(landmarks[8].x - landmarks[0].x, landmarks[8].y - landmarks[0].y); 
                    totalSpread += spreadRaw; 
                }
            }
            handPoints.current = tips;
            handSkeleton.current = joints;

            // 2. Gemini Trigger
            if (handCount > 0 && time - lastThemeUpdate.current > 4000) {
                lastThemeUpdate.current = time;
                setGeminiStatus("CALCULATING GEOMETRY...");
                
                const avgSpread = totalSpread / handCount;
                const normalizedSpread = Math.min(Math.max((avgSpread - 0.15) * 3, 0), 1); 
                generateThemeFromGesture(handCount, 0.5, normalizedSpread).then(newTheme => {
                    if (newTheme) {
                        setTheme(newTheme);
                        setGeminiStatus(newTheme.description.toUpperCase());
                    }
                });
            }
        }

        // 3. Render Background
        ctx.fillStyle = 'rgba(5, 5, 5, 0.15)'; 
        ctx.fillRect(0, 0, width, height);

        const currentTheme = theme;
        const tips = handPoints.current;
        const skeleton = handSkeleton.current;

        // 4. Render Skeleton
        if (skeleton.length > 0) {
            ctx.beginPath();
            ctx.strokeStyle = hexToRgba(currentTheme.secondaryColor, 0.1);
            ctx.lineWidth = 1 * dpr; // Scale line width
            for (let i = 0; i < skeleton.length - 1; i+=1) {
                if (i % 21 !== 20) { 
                    const p1 = skeleton[i];
                    const p2 = skeleton[i+1];
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                }
            }
            ctx.stroke();
        }

        // 5. Update Particles
        const scaleFactor = dpr; 
        const geometryDistance = currentTheme.geometryScale * scaleFactor;
        const interactionDistance = 300 * scaleFactor;
        
        for (let i = 0; i < particles.current.length; i++) {
            const p = particles.current[i];
            
            p.life -= deltaTime * 0.05;
            if (p.life <= 0) {
                p.life = p.maxLife;
                if (tips.length > 0) {
                    const source = tips[Math.floor(Math.random() * tips.length)];
                    p.x = source.x + (Math.random() - 0.5) * 50 * scaleFactor;
                    p.y = source.y + (Math.random() - 0.5) * 50 * scaleFactor;
                    p.vx = (Math.random() - 0.5) * (p.type === 'STRUCTURE' ? 2 : 0.5) * scaleFactor;
                    p.vy = (Math.random() - 0.5) * (p.type === 'STRUCTURE' ? 2 : 0.5) * scaleFactor;
                } else {
                    p.x = Math.random() * width;
                    p.y = Math.random() * height;
                }
            }

            let fx = 0, fy = 0;
            
            if (tips.length > 0) {
                let closestDist = 99999;
                let target = tips[0];
                for(const t of tips) {
                    const d = Math.hypot(t.x - p.x, t.y - p.y);
                    if (d < closestDist) { closestDist = d; target = t; }
                }

                const dx = target.x - p.x;
                const dy = target.y - p.y;
                
                if (closestDist < interactionDistance) {
                    const force = 1 - (closestDist / interactionDistance);

                    if (p.type === 'STRUCTURE') {
                        if (currentTheme.mode === InteractionMode.WEAVE) {
                            fx += dx * 0.02 * currentTheme.tension * force;
                            fy += dy * 0.02 * currentTheme.tension * force;
                            fx -= dy * 0.05 * force;
                            fy += dx * 0.05 * force;
                        } else if (currentTheme.mode === InteractionMode.CRYSTALLIZE) {
                             const snapSize = geometryDistance;
                             const snapX = Math.round(p.x / snapSize) * snapSize;
                             const snapY = Math.round(p.y / snapSize) * snapSize;
                             fx += (snapX - p.x) * 0.05;
                             fy += (snapY - p.y) * 0.05;
                             fx += dx * 0.005; 
                             fy += dy * 0.005;
                        } else if (currentTheme.mode === InteractionMode.FRAGMENT) {
                             if (closestDist < 200 * scaleFactor) {
                                 fx -= dx * 0.1 * force;
                                 fy -= dy * 0.1 * force;
                             }
                        } else if (currentTheme.mode === InteractionMode.VOID) {
                             fx += dx * 0.08 * force;
                             fy += dy * 0.08 * force;
                        } else {
                            fx += Math.sin(time * 0.01 + p.y * 0.1) * 0.5 * scaleFactor;
                            fy += Math.cos(time * 0.01 + p.x * 0.1) * 0.5 * scaleFactor;
                        }
                    } else {
                        fx += (Math.random() - 0.5) * currentTheme.entropy * scaleFactor;
                        fy += (Math.random() - 0.5) * currentTheme.entropy * scaleFactor;
                        if (closestDist < 300 * scaleFactor) {
                            fx += dx * 0.002 * force;
                            fy += dy * 0.002 * force;
                        }
                    }
                }
            } else {
                fx += Math.sin(p.y * 0.01 + time * 0.0005) * 0.01 * scaleFactor;
            }

            p.vx += fx;
            p.vy += fy;
            p.vx *= (p.type === 'STRUCTURE' ? 0.92 : 0.98);
            p.vy *= (p.type === 'STRUCTURE' ? 0.92 : 0.98);

            p.x += p.vx;
            p.y += p.vy;
            
            // Wrap around
            if(p.x < 0) p.x = width;
            if(p.x > width) p.x = 0;
            if(p.y < 0) p.y = height;
            if(p.y > height) p.y = 0;

            const alpha = Math.min(p.life / 50, 1) * (p.type === 'STARDUST' ? 0.6 : 1.0);
            const baseColor = p.type === 'STRUCTURE' ? currentTheme.primaryColor : currentTheme.secondaryColor;
            
            if (p.type === 'STRUCTURE') {
                ctx.fillStyle = hexToRgba(baseColor, alpha);
                ctx.fillRect(p.x, p.y, p.size, p.size);
                
                // Limit connections for performance
                if (i % 2 === 0) { 
                    for (let j = i + 1; j < Math.min(i + 15, particles.current.length); j++) {
                        const p2 = particles.current[j];
                        if (p2.type === 'STRUCTURE') {
                             const d = Math.hypot(p2.x - p.x, p2.y - p.y);
                             if (d < geometryDistance) {
                                 ctx.beginPath();
                                 ctx.moveTo(p.x, p.y);
                                 ctx.lineTo(p2.x, p2.y);
                                 ctx.strokeStyle = hexToRgba(baseColor, alpha * (1 - d/geometryDistance) * 0.5);
                                 ctx.lineWidth = 0.5 * dpr; // Faint hairline
                                 ctx.stroke();
                             }
                        }
                    }
                }

            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
                ctx.fillStyle = hexToRgba(baseColor, alpha * 0.5);
                ctx.fill();
            }
        }

        frameId.current = requestAnimationFrame(render);
    };

    frameId.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameId.current);
  }, [isLoaded, theme]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#050505] overflow-hidden">
        {/* CSS Noise Overlay */}
        <div className="absolute inset-0 z-30 pointer-events-none opacity-[0.08]" 
             style={{
                 backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
             }}>
        </div>

        <canvas ref={canvasRef} className="absolute inset-0 z-10" style={{width: '100%', height: '100%'}} />
        
        {/* UI Elements */}
        <div className="absolute top-8 left-8 z-40 pointer-events-none mix-blend-difference">
             <h1 className="text-white text-xs font-['Inter'] tracking-[0.3em] uppercase opacity-70">
                Project Gemini // Visual Core
             </h1>
             <div className="mt-4 flex flex-col space-y-1">
                 <div className="w-8 h-[1px] bg-white opacity-50 mb-2"></div>
                 <span className="text-[#D4AF37] text-[10px] font-['Inter'] tracking-widest uppercase">
                    Status: {isLoaded ? 'Resonance Stable' : 'Initializing Sequence'}
                 </span>
             </div>
        </div>

        <div className="absolute bottom-12 left-12 z-40 pointer-events-none">
            <div className="text-white font-['Orbitron'] text-xl uppercase tracking-widest leading-none opacity-90 drop-shadow-lg">
                {geminiStatus}
            </div>
            <div className="mt-2 text-xs text-gray-400 font-['Inter'] tracking-wider max-w-xs">
                 Mode: <span className="text-[#D4AF37]">{theme.mode}</span> // Tension: {theme.tension.toFixed(2)}
            </div>
        </div>

        {!isLoaded && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#050505]">
                <div className="flex flex-col items-center">
                    <div className="w-px h-16 bg-gradient-to-b from-transparent via-[#D4AF37] to-transparent animate-pulse mb-4"></div>
                    <p className="text-gray-500 font-['Inter'] text-[10px] tracking-[0.2em] uppercase">Calibrating Sensors</p>
                </div>
            </div>
        )}
    </div>
  );
};