import * as path from "path";
import * as fs from "fs";

/**
 * Structure of the chapter duration JSON file
 */
export interface ChapterDuration {
  inSeconds: number;
  inTimestamp: string;
}

/**
 * Structure of the chapter's config in chapters.config.json
 */
export interface ChapterConfig {
  title: string;
  startTime?: string; // Start timestamp: "HH:MM:SS" or "MM:SS" (optional)
  endTime?: string;   // End timestamp: "HH:MM:SS" or "MM:SS" (optional)
  duration?: string;  // Duration: "HH:MM:SS" or "MM:SS" (optional)
}

export type ChaptersConfig = ChapterConfig[];

/**
 * Structure of a processed chapter with all fields filled in
 */
export interface ProcessedChapter {
  title: string;
  startTime: string;
  endTime: string;
  duration: string;
}

/**
 * Get the path to the source audiobook file
 * @param bookDir The book directory path
 * @returns The path to the book.mp3 file
 */
export function getBookAudioPath(bookDir: string): string {
  return path.join(bookDir, "book.mp3");
}

/**
 * Get the path to the book's duration file
 * @param bookDir The book directory path
 * @returns The path to the book.duration.json file
 */
export function getBookDurationPath(bookDir: string): string {
  return path.join(bookDir, "book.duration.json");
}

/**
 * Get the path to the chapters config file
 * @param bookDir The book directory path
 * @returns The path to the chapters.config.json file
 */
export function getChaptersConfigPath(bookDir: string): string {
  return path.join(bookDir, "chapters.config.json");
}

/**
 * Generate the directory name for a chapter
 * @param index The chapter index
 * @param title The chapter title
 * @returns The formatted directory name (e.g., "0_Introduction")
 */
export function formatChapterDirName(index: number, title: string): string {
  const chapterNumber = index.toString().padStart(1, "0");
  const chapterTitle = title.replace(/\s+/g, "_");
  return `${chapterNumber}_${chapterTitle}`;
}

/**
 * Get the chapter directory path
 * @param bookDir The book directory path
 * @param index The chapter index
 * @param title The chapter title
 * @returns The full path to the chapter directory
 */
export function getChapterDir(bookDir: string, index: number, title: string): string {
  const chapterDirName = formatChapterDirName(index, title);
  return path.join(bookDir, chapterDirName);
}

/**
 * Get the path to a chapter's audio file
 * @param chapterDir The chapter directory path
 * @returns The path to the chapter.mp3 file
 */
export function getChapterAudioPath(chapterDir: string): string {
  return path.join(chapterDir, "chapter.mp3");
}

/**
 * Get the path to a chapter's duration file
 * @param chapterDir The chapter directory path
 * @returns The path to the chapter.duration.json file
 */
export function getChapterDurationPath(chapterDir: string): string {
  return path.join(chapterDir, "chapter.duration.json");
}

/**
 * Get the book duration from book.duration.json
 * @param bookDir The book directory path
 * @returns The duration data or null if not found
 */
export function getBookDuration(bookDir: string): ChapterDuration | null {
  const durationPath = getBookDurationPath(bookDir);
  if (!fs.existsSync(durationPath)) {
    console.warn(`Book duration file not found at ${durationPath}`);
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(durationPath, "utf-8"));
  } catch (error) {
    console.warn(`Error parsing book duration at ${durationPath}:`, error);
    return null;
  }
}

/**
 * Get the chapters configuration from chapters.config.json
 * @param bookDir The book directory path
 * @returns The chapters configuration or null if not found
 */
export function getChaptersConfig(bookDir: string): ChaptersConfig | null {
  const configPath = getChaptersConfigPath(bookDir);
  if (!fs.existsSync(configPath)) {
    console.warn(`Chapters config file not found at ${configPath}`);
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch (error) {
    console.warn(`Error parsing chapters config at ${configPath}:`, error);
    return null;
  }
}

/**
 * Get the chapter duration from chapter.duration.json
 * @param chapterDir The chapter directory path
 * @returns The duration data or null if not found
 */
export function getChapterDuration(chapterDir: string): ChapterDuration | null {
  const durationPath = getChapterDurationPath(chapterDir);
  if (!fs.existsSync(durationPath)) {
    console.warn(`Chapter duration file not found at ${durationPath}`);
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(durationPath, "utf-8"));
  } catch (error) {
    console.warn(`Error parsing chapter duration at ${durationPath}:`, error);
    return null;
  }
}

/**
 * Save chapter duration data to disk
 * @param chapterDir The chapter directory path
 * @param duration Duration in seconds
 * @returns The path to the saved file
 */
export function saveChapterDuration(chapterDir: string, duration: number): string {
  const durationPath = getChapterDurationPath(chapterDir);
  
  // Format timestamp as HH:MM:SS
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const seconds = Math.floor(duration % 60);
  const timestamp = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
  const data: ChapterDuration = {
    inSeconds: duration,
    inTimestamp: timestamp
  };
  
  fs.writeFileSync(durationPath, JSON.stringify(data, null, 2), "utf-8");
  return durationPath;
} 