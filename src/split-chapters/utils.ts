import * as fs from "fs";
import path from "path";
import { execAsync } from "../common/utils";
import { ChapterConfig } from "./types";

/**
 * Check if ffmpeg is installed and available
 */
export async function checkFfmpeg(): Promise<boolean> {
  try {
    await execAsync("ffmpeg -version");
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Load and parse chapter configuration from JSON file
 */
export async function loadChapterConfig(
  book: string,
  chapter: string
): Promise<ChapterConfig> {
  const configPath = path.join("audiobooks", book, chapter, "chapter.config.json");

  try {
    if (!fs.existsSync(configPath)) {
      throw new Error(`Chapter configurations not found: ${configPath}`);
    }

    const configContent = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(configContent);
  } catch (error: any) {
    throw new Error(`Error loading chapter configurations: ${error.message}`);
  }
}

/**
 * Parse a timestamp string in format HH:MM:SS or MM:SS into total seconds
 */
export function parseTimestamp(timestamp: string): number {
  const parts = timestamp.split(":").map(Number);
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return minutes * 60 + seconds;
  } else {
    throw new Error(`Invalid timestamp format: ${timestamp}`);
  }
}
