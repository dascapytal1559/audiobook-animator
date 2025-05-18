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
 * Represents a complete scene analysis
 */
export interface SceneAnalysis {
  bookName: string;
  chapterName: string;
  sceneCount: number;
  scenes: Scene[];
}

// --- File Path Utilities ---

/**
 * Get the path to a scenes JSON file
 * @param chapterDir The chapter directory path
 * @returns Path to the scenes JSON file
 */
export function getScenesPath(chapterDir: string): string {
  return path.join(chapterDir, "scenes.json");
}

/**
 * Save scene analysis data to disk
 * @param chapterDir Path to the chapter directory
 * @param sceneAnalysis The scene analysis data to save
 * @returns Path to the saved file
 */
export function saveSceneAnalysis(
  chapterDir: string,
  sceneAnalysis: SceneAnalysis
): string {
  const outputPath = getScenesPath(chapterDir);
  fs.writeFileSync(outputPath, JSON.stringify(sceneAnalysis, null, 2), "utf-8");
  return outputPath;
}

/**
 * Get the scene analysis for a chapter if available
 * @param chapterDir Path to the chapter directory
 * @returns The scene analysis or null if not found
 */
export function getSceneAnalysis(chapterDir: string): SceneAnalysis | null {
  const scenesPath = getScenesPath(chapterDir);
  
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