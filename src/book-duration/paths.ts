import * as path from "path";
import * as fs from "fs";

// --- Book Audio Utilities ---

/**
 * Get the path to the book audio file
 * @param bookDir The book directory path
 * @returns Path to the book audio file
 */
export function getBookAudioPath(bookDir: string): string {
  return path.join(bookDir, "book.mp3");
}

/**
 * Check if the book audio file exists
 * @param bookDir The book directory path
 * @returns True if the book audio file exists
 */
export function bookAudioExists(bookDir: string): boolean {
  const audioPath = getBookAudioPath(bookDir);
  return fs.existsSync(audioPath);
}

// --- Duration Data Utilities ---

/**
 * Structure of the book duration data
 */
export interface BookDuration {
  inSeconds: number;
  inTimestamp: string;
}

/**
 * Get the path to the book duration JSON file
 * @param bookDir The book directory path
 * @returns Path to the book duration JSON file
 */
export function getBookDurationPath(bookDir: string): string {
  return path.join(bookDir, "book.duration.json");
}

/**
 * Save book duration data to disk
 * @param bookDir The book directory path
 * @param durationData Duration data to save
 * @returns Path to the saved file
 */
export function saveBookDuration(bookDir: string, durationData: BookDuration): string {
  const outputPath = getBookDurationPath(bookDir);
  fs.writeFileSync(outputPath, JSON.stringify(durationData, null, 2), "utf-8");
  return outputPath;
}

/**
 * Get the book duration data if it exists
 * @param bookDir The book directory path
 * @returns Book duration data or null if not found
 */
export function getBookDuration(bookDir: string): BookDuration | null {
  const durationPath = getBookDurationPath(bookDir);
  
  if (!fs.existsSync(durationPath)) {
    return null;
  }
  
  try {
    return JSON.parse(fs.readFileSync(durationPath, "utf-8"));
  } catch (error) {
    console.warn(`Error parsing book duration at ${durationPath}:`, error);
    return null;
  }
} 