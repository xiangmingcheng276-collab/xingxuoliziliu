import { Type } from "@google/genai";

export interface Point {
  x: number;
  y: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  type: 'STRUCTURE' | 'STARDUST'; // New distinction
}

export enum InteractionMode {
  WEAVE = 'WEAVE',           // Thread-like connections
  CRYSTALLIZE = 'CRYSTALLIZE', // Geometric formations
  FRAGMENT = 'FRAGMENT',     // Breaking apart
  VOID = 'VOID',             // Negative space attraction
  RESONANCE = 'RESONANCE'    // Vibration/Wave
}

export interface VisualTheme {
  primaryColor: string;    // The Tungsten/Gold aspect
  secondaryColor: string;  // The Quantum Blue aspect
  mode: InteractionMode;
  tension: number;         // How tight the geometry threads are
  entropy: number;         // Chaos factor for stardust
  geometryScale: number;
  description: string;
}

// Gemini Schema for strict JSON output
export const ThemeSchema = {
  type: Type.OBJECT,
  properties: {
    primaryColor: {
      type: Type.STRING,
      description: "Dominant color: variations of Tungsten Gold (#C2B280, #D4AF37) or Deep Bronze."
    },
    secondaryColor: {
      type: Type.STRING,
      description: "Accent color: variations of Quantum Blue (#003366, #191970) or Ultraviolet."
    },
    mode: {
      type: Type.STRING,
      enum: ['WEAVE', 'CRYSTALLIZE', 'FRAGMENT', 'VOID', 'RESONANCE'],
      description: "The structural behavior mode."
    },
    tension: {
      type: Type.NUMBER,
      description: "Elasticity of the threads (0.1 loose to 2.0 tight)."
    },
    entropy: {
      type: Type.NUMBER,
      description: "Randomness factor for the stardust layer (0.0 to 1.0)."
    },
    geometryScale: {
      type: Type.NUMBER,
      description: "Scale of the geometric structures (50 to 200)."
    },
    description: {
      type: Type.STRING,
      description: "A philosophical, 4-word abstract title."
    }
  },
  required: ["primaryColor", "secondaryColor", "mode", "tension", "entropy", "geometryScale", "description"]
};