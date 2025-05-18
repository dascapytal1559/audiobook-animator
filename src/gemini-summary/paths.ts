import * as path from "path";
import * as fs from "fs";

// --- Summary File Utilities ---

/**
 * Structure of the gemini-summary.json file
 */
export interface GeminiSummary {
  shortSummary: string;
  longSummary: string;
  book: string;
  chapter: string;
  generated: string;
}

/**
 * Get the path to the gemini-summary.json file for a chapter
 * @param chapterDir The chapter directory path
 * @returns The path to the gemini-summary.json file
 */
export function getSummaryPath(chapterDir: string): string {
  return path.join(chapterDir, "gemini-summary.json");
}

/**
 * Get the Gemini summary for a chapter if available
 * @param chapterDir The chapter directory path
 * @returns The Gemini summary or null if not found
 */
export function getGeminiSummary(chapterDir: string): GeminiSummary | null {
  const summaryPath = getSummaryPath(chapterDir);
  if (!fs.existsSync(summaryPath)) {
    console.warn(`No Gemini summary found at ${summaryPath}`);
    return null;
  }
  
  try {
    return JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  } catch (error) {
    console.warn(`Error parsing Gemini summary at ${summaryPath}:`, error);
    return null;
  }
}

/**
 * Save a GeminiSummary to disk
 * @param chapterDir The chapter directory path
 * @param summaryData The summary data to save
 * @returns The path to the saved file
 */
export function saveSummary(chapterDir: string, summaryData: GeminiSummary): string {
  const summaryPath = getSummaryPath(chapterDir);
  fs.writeFileSync(summaryPath, JSON.stringify(summaryData, null, 2), "utf-8");
  return summaryPath;
}

/**
 * Get the path to the raw response file for a chapter
 * @param chapterDir The chapter directory path
 * @returns The path to the gemini-summary.response.txt file
 */
export function getSummaryResponsePath(chapterDir: string): string {
  return path.join(chapterDir, "gemini-summary.response.txt");
}

// --- Audio File Utilities ---

/**
 * Find the main MP3 file in a chapter directory (excluding chunk files)
 * @param chapterDir The chapter directory path
 * @returns The path to the found MP3 file
 */
export function findChapterAudioFile(chapterDir: string): string {
  const files = fs.readdirSync(chapterDir);
  const mp3Files = files.filter(file => file.endsWith(".mp3") && !file.includes("chunk"));
  
  if (mp3Files.length === 0) {
    throw new Error(`No MP3 file found in ${chapterDir}`);
  }
  
  if (mp3Files.length > 1) {
    console.warn(`Multiple MP3 files found in ${chapterDir}, using the first one: ${mp3Files[0]}`);
  }
  
  return path.join(chapterDir, mp3Files[0]);
}

// --- Upload Info Utilities ---

/**
 * Get the path to store upload info for an audio file
 * @param audioPath The audio file path
 * @returns The path to the upload info file
 */
export function getUploadInfoPath(audioPath: string): string {
  return audioPath + ".gemini-upload.json";
} 