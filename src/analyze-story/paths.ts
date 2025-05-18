import * as path from "path";
import * as fs from "fs";
import { getTranscriptPath, Transcript } from "../transcribe/paths";

// --- Scene Types ---

/**
 * Represents a single scene in the transcript
 */
export interface Scene {
  id: number;
  title: string;
  startText: string; // Exact starting words to identify the scene
  characterAppearances: string[];
  location: string;
  props: string[];
  mood: string;
}

/**
 * Represents a processed scene with segment IDs
 */
export interface ProcessedScene extends Scene {
  startSegId: number;
  endSegId?: number;
  segCount: number;
  startTime: number;
  endTime: number;
  duration: number;
}

/**
 * Represents a complete scene analysis
 */
export interface SceneAnalysis {
  bookName: string;
  chapterName: string;
  sceneCount: number;
  scenes: Scene[];
}

/**
 * Represents a processed scene analysis with segment IDs
 */
export interface ProcessedSceneAnalysis {
  bookName: string;
  chapterName: string;
  sceneCount: number;
  scenes: ProcessedScene[];
}

// --- File Path Utilities ---

/**
 * Get the path to the raw scenes response JSON file
 * @param chapterDir The chapter directory path
 * @returns Path to the scenes response JSON file
 */
export function getScenesResponsePath(chapterDir: string): string {
  return path.join(chapterDir, "scenes.response.json");
}

/**
 * Get the path to the processed scenes JSON file
 * @param chapterDir The chapter directory path
 * @returns Path to the processed scenes JSON file
 */
export function getScenesPath(chapterDir: string): string {
  return path.join(chapterDir, "scenes.json");
}

/**
 * Save raw scene analysis data to disk
 * @param chapterDir Path to the chapter directory
 * @param sceneAnalysis The scene analysis data to save
 * @returns Path to the saved file
 */
export function saveSceneAnalysis(
  chapterDir: string,
  sceneAnalysis: SceneAnalysis
): string {
  const outputPath = getScenesResponsePath(chapterDir);
  fs.writeFileSync(outputPath, JSON.stringify(sceneAnalysis, null, 2), "utf-8");
  return outputPath;
}

/**
 * Save processed scene analysis data to disk
 * @param chapterDir Path to the chapter directory
 * @param processedSceneAnalysis The processed scene analysis data to save
 * @returns Path to the saved file
 */
export function saveProcessedSceneAnalysis(
  chapterDir: string,
  processedSceneAnalysis: ProcessedSceneAnalysis
): string {
  const outputPath = getScenesPath(chapterDir);
  fs.writeFileSync(outputPath, JSON.stringify(processedSceneAnalysis, null, 2), "utf-8");
  return outputPath;
}

/**
 * Get the raw scene analysis for a chapter if available
 * @param chapterDir Path to the chapter directory
 * @returns The scene analysis or null if not found
 */
export function getSceneAnalysis(chapterDir: string): SceneAnalysis | null {
  const scenesPath = getScenesResponsePath(chapterDir);
  
  if (!fs.existsSync(scenesPath)) {
    return null;
  }
  
  try {
    return JSON.parse(fs.readFileSync(scenesPath, "utf-8"));
  } catch (error) {
    console.warn(`Error parsing scene analysis at ${scenesPath}:`, error);
    return null;
  }
}

/**
 * Get the processed scene analysis for a chapter if available
 * @param chapterDir Path to the chapter directory
 * @returns The processed scene analysis or null if not found
 */
export function getProcessedSceneAnalysis(chapterDir: string): ProcessedSceneAnalysis | null {
  const scenesPath = getScenesPath(chapterDir);
  
  if (!fs.existsSync(scenesPath)) {
    return null;
  }
  
  try {
    return JSON.parse(fs.readFileSync(scenesPath, "utf-8"));
  } catch (error) {
    console.warn(`Error parsing processed scene analysis at ${scenesPath}:`, error);
    return null;
  }
}

/**
 * Get the transcript for a chapter
 * @param chapterDir Path to the chapter directory
 * @returns The transcript or null if not found
 */
export function getChapterTranscript(chapterDir: string): Transcript | null {
  // Try to find the chapter audio file
  const files = fs.readdirSync(chapterDir);
  const audioFile = files.find(file => 
    file.endsWith(".mp3") && !file.includes("chunk_")
  );
  
  if (!audioFile) {
    console.warn(`No chapter audio file found in ${chapterDir}`);
    return null;
  }
  
  const audioPath = path.join(chapterDir, audioFile);
  const transcriptPath = getTranscriptPath(audioPath);
  
  if (!fs.existsSync(transcriptPath)) {
    console.warn(`No transcript found at ${transcriptPath}`);
    return null;
  }
  
  try {
    return JSON.parse(fs.readFileSync(transcriptPath, "utf-8"));
  } catch (error) {
    console.warn(`Error parsing transcript at ${transcriptPath}:`, error);
    return null;
  }
} 