import { Command } from "commander";
import ffmpeg from "fluent-ffmpeg";
import * as fs from "fs";
import path from "path";
import { FLAGS, parseBookDir, parseIds } from "../common/flags";
import { ensureDirectory } from "../common/paths";
import { CliTimer, ElapsedTimer } from "../common/timer";
import { addDuration, parseDuration, parseTimestamp } from "../common/timestamps";

// --- Types ---
interface ChapterConfig {
  title: string;
  startTime?: string; // Start timestamp: "HH:MM:SS" or "MM:SS" (optional)
  endTime?: string;   // End timestamp: "HH:MM:SS" or "MM:SS" (optional)
  duration?: string;  // Duration: "HH:MM:SS" or "MM:SS" (optional)
}

type ChaptersConfig = ChapterConfig[];

interface DurationData {
  inSeconds: number;
  inTimestamp: string;
}

interface ProcessedChapter {
  title: string;
  startTime: string;
  endTime: string;
  duration: string;
}

// --- Core Logic ---
/**
 * Convert duration string (HH:MM:SS or MM:SS) to seconds
 */
function durationToSeconds(duration: string): number {
  const parts = duration.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

/**
 * Get book duration from book.duration.json
 */
async function getBookDuration(bookDir: string): Promise<DurationData> {
  const durationPath = path.join(bookDir, "book.duration.json");
  if (!fs.existsSync(durationPath)) {
    throw new Error(`Book duration file not found at ${durationPath}`);
  }

  return JSON.parse(fs.readFileSync(durationPath, "utf-8"));
}

/**
 * Process chapter config to ensure all needed fields are available
 */
function processChaptersConfig(chaptersConfig: ChaptersConfig): ProcessedChapter[] {
  const processedChapters: ProcessedChapter[] = [];
  let currentStartTime = "00:00:00";
  
  for (let i = 0; i < chaptersConfig.length; i++) {
    const chapter = chaptersConfig[i];
    
    // Determine start time
    const startTime = chapter.startTime || currentStartTime;
    
    // Check if either endTime or duration is provided
    if (!chapter.endTime && !chapter.duration) {
      throw new Error(`Chapter "${chapter.title}" must specify either endTime or duration`);
    }
    
    // Calculate duration and end time
    let duration: string;
    let endTime: string;
    
    if (chapter.endTime) {
      endTime = chapter.endTime;
      // Calculate duration from start and end times
      const startSeconds = parseTimestamp(startTime);
      const endSeconds = parseTimestamp(endTime);
      const durationSeconds = endSeconds - startSeconds;
      duration = parseDuration(durationSeconds);
    } else {
      // Use provided duration
      duration = chapter.duration!;
      // Calculate end time from start time and duration
      endTime = addDuration(startTime, duration);
    }
    
    processedChapters.push({
      title: chapter.title,
      startTime,
      endTime,
      duration
    });
    
    // Next chapter starts where this one ends
    currentStartTime = endTime;
  }
  
  return processedChapters;
}

/**
 * Split book into chapters
 * @param bookDir: string - The directory of the book
 * @param isolatedChapterInput: string - The input for the isolated chapters. process all chapters if not provided
 */
async function splitChapters(bookDir: string, isolatedChapterInput?: string) {
  console.log(`Splitting chapters for book in ${bookDir}`);

  // Check for book.mp3 file
  const bookAudioPath = path.join(bookDir, "book.mp3");
  if (!fs.existsSync(bookAudioPath)) {
    throw new Error(`Book audio file not found at ${bookAudioPath}`);
  }

  // Load chapters config
  const chaptersConfigPath = path.join(bookDir, "chapters.config.json");
  if (!fs.existsSync(chaptersConfigPath)) {
    throw new Error(`Chapters config not found at ${chaptersConfigPath}`);
  }

  const rawChaptersConfig: ChaptersConfig = JSON.parse(
    fs.readFileSync(chaptersConfigPath, "utf-8")
  );
  
  // Process chapters config to fill in missing fields
  const chaptersConfig = processChaptersConfig(rawChaptersConfig);

  // Load book duration
  const bookDuration = await getBookDuration(bookDir);
  
  // Validate that chapter timestamps are within book duration
  for (const chapter of chaptersConfig) {
    const endTimeSeconds = parseTimestamp(chapter.endTime);
    if (endTimeSeconds > bookDuration.inSeconds) {
      console.warn(`Warning: Chapter "${chapter.title}" end time (${chapter.endTime}) exceeds book duration (${bookDuration.inTimestamp})`);
    }
  }

  // Determine which chapters to process
  const chapterIndices = Array.from(
    { length: chaptersConfig.length },
    (_, i) => i
  );
  const selectedIndices = parseIds(chapterIndices, isolatedChapterInput);

  console.log(
    `Processing ${selectedIndices.length} / ${chaptersConfig.length} chapters`
  );

  // Process selected chapters
  for (const index of selectedIndices) {
    const chapter = chaptersConfig[index];
    const chapterNumber = index.toString().padStart(1, "0");
    const chapterTitle = chapter.title.replace(/\s+/g, "_");
    const chapterDirName = `${chapterNumber}_${chapterTitle}`;
    const chapterDir = path.join(bookDir, chapterDirName);

    // Create chapter directory if it doesn't exist
    ensureDirectory(chapterDir);

    const outputPath = path.join(chapterDir, "chapter.mp3");
    const durationPath = path.join(chapterDir, "chapter.duration.json");

    const startTime = chapter.startTime;
    const endTime = chapter.endTime;
    const duration = chapter.duration;
    
    // Calculate duration in seconds
    const durationSeconds = durationToSeconds(duration);
    
    // Write duration in both seconds and timestamp format to JSON file
    const durationData = {
      inSeconds: durationSeconds,
      inTimestamp: duration
    };
    fs.writeFileSync(durationPath, JSON.stringify(durationData, null, 2), "utf-8");

    console.log(
      `\nExtracting chapter ${index}: ${chapter.title} (from ${startTime} to ${endTime}, duration: ${duration})`
    );

    const timer = new ElapsedTimer();
    // Use ffmpeg to extract the chapter
    await new Promise<void>((resolve, reject) => {
      const f = ffmpeg(bookAudioPath)
        .setStartTime(startTime)
        .setDuration(duration)
        .output(outputPath)
        .on("end", () => {
          timer.stop();
          console.log(`Successfully extracted: ${outputPath}`);
          console.log(`Duration logged to: ${durationPath}`);
          resolve();
        })
        .on("error", (err) => {
          timer.stop();
          console.error(`Error extracting chapter: ${err.message}`);
          reject(err);
        })
        .run();
    });
  }
}

// --- CLI Logic ---
async function main() {
  const timer = new CliTimer();

  try {
    const program = new Command();

    await program
      .description("Split chapters from a book")
      .option(FLAGS.book.flag, FLAGS.book.description)
      .option(FLAGS.chapters.flag, FLAGS.chapters.description)
      .action(async (options) => {
        const bookDir = parseBookDir(options.book);
        await splitChapters(bookDir, options.chapters);
      })
      .parseAsync(process.argv);
  } catch (error) {
    console.error(
      "Error:",
      error instanceof Error ? error.message : "Unknown error"
    );
    process.exit(1);
  } finally {
    timer.stop();
  }
}

if (require.main === module) {
  main();
}
