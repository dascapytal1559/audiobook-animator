import { Command } from "commander";
import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import { FLAGS, parseBookDir } from "../common/flags";
import { parseDuration, parseTimestamp } from "../common/timestamps";
import {
  BookDuration,
  bookAudioExists,
  getBookAudioPath,
  saveBookDuration,
} from "./paths";

// --- Constants ---
const execAsync = promisify(exec);

// --- Audio Analysis Utilities ---

/**
 * Get audio duration in seconds using ffmpeg
 * @param filePath Path to the audio file
 * @returns Duration in seconds
 */
async function getAudioDurationInSeconds(filePath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `ffmpeg -i "${filePath}" -hide_banner 2>&1 | grep "Duration" | awk '{print $2}' | tr -d ,`
    );
    
    const durationStr = stdout.trim();
    if (!durationStr) {
      throw new Error("Could not extract duration information");
    }

    return parseTimestamp(durationStr);
  } catch (error) {
    console.error("Error getting audio duration:", error);
    throw error;
  }
}

// --- Core Logic ---

/**
 * Analyze book audio and save duration data
 * @param bookDir The book directory path
 * @returns The duration data
 */
async function analyzeBookDuration(bookDir: string): Promise<BookDuration> {
  if (!fs.existsSync(bookDir)) {
    throw new Error(`Book directory not found: ${bookDir}`);
  }
  
  // Check for book audio file
  if (!bookAudioExists(bookDir)) {
    throw new Error(`Audio file not found for book: ${bookDir}`);
  }
  
  const audioPath = getBookAudioPath(bookDir);
  console.log(`Analyzing duration of ${audioPath}...`);
  
  const durationInSeconds = await getAudioDurationInSeconds(audioPath);
  const durationInTimestamp = parseDuration(durationInSeconds);
  console.log(`Duration: ${durationInSeconds} seconds (${durationInTimestamp})`);
  
  // Create duration data object
  const durationData: BookDuration = {
    inSeconds: durationInSeconds,
    inTimestamp: durationInTimestamp,
  };
  
  // Save duration.json to the book directory
  const outputPath = saveBookDuration(bookDir, durationData);
  console.log(`Duration saved to ${outputPath}`);
  
  return durationData;
}

// --- CLI Logic ---
async function main(): Promise<void> {
  const program = new Command();
  
  program
    .description("Analyze audiobook duration and output to book.duration.json")
    .requiredOption(FLAGS.book.flag, FLAGS.book.description)
    .action(async (options: { book: string }) => {
      try {
        const bookDir = parseBookDir(options.book);
        await analyzeBookDuration(bookDir);
      } catch (error) {
        console.error("Error:", error);
        process.exit(1);
      }
    });
  
  program.parse(process.argv);
}

// --- Entrypoint ---
if (require.main === module) {
  main();
}

