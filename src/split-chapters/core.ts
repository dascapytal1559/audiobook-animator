import ffmpeg from "fluent-ffmpeg";
import * as fs from "fs";
import path from "path";
import { ensureDirectory } from "../common/paths";
import { ElapsedTimer } from "../common/timer";
import { ChapterConfig } from "./types";
import { parseIds } from "../common/flags";

/**
 * Split a chapter from a book
 * @param book The book name
 * @param chaptersInput Optional string specifying which chapters to extract (e.g., "1,3,5-10")
 */
export async function splitChapters(book: string, chaptersInput?: string): Promise<void> {
  console.log(`Splitting chapters for book: ${book}`);

  // Define paths
  const configPath = path.resolve(`audiobooks/${book}/chapters.json`);
  const audioPath = path.resolve(`audiobooks/${book}/${book}.mp3`);
  const outputDir = path.resolve(`audiobooks/${book}`);

  // Ensure the output directory exists
  ensureDirectory(outputDir);

  // Read chapter configuration
  if (!fs.existsSync(configPath)) {
    throw new Error(`Chapter configuration not found at ${configPath}`);
  }

  if (!fs.existsSync(audioPath)) {
    throw new Error(`Audio file not found at ${audioPath}`);
  }

  const chapterConfig: ChapterConfig[] = JSON.parse(
    fs.readFileSync(configPath, "utf-8")
  );

  // Get all valid chapter indices
  const allChapterIndices = Array.from(
    { length: chapterConfig.length },
    (_, i) => i
  );

  // Parse chapter indices from input, or use all if not provided
  const chapterIndices = parseIds(allChapterIndices, chaptersInput);

  if (chapterIndices.length === 0) {
    console.log("No valid chapters specified. No processing will be done.");
    return;
  }

  if (chaptersInput) {
    console.log(`Extracting ${chapterIndices.length} specified chapters: ${chapterIndices.join(", ")}`);
  } else {
    console.log(`Extracting all ${chapterIndices.length} chapters`);
  }

  // Calculate start times for all chapters
  const startTimes: string[] = [];
  let currentTime = "00:00:00";
  startTimes.push(currentTime);
  
  for (let i = 0; i < chapterConfig.length - 1; i++) {
    currentTime = addDurations(currentTime, chapterConfig[i].duration);
    startTimes.push(currentTime);
  }

  // Process each chapter (or just the specified ones)
  for (let i = 0; i < chapterConfig.length; i++) {
    // Skip chapters that aren't in the list of indices to process
    if (!chapterIndices.includes(i)) {
      continue;
    }

    const chapter = chapterConfig[i];
    const chapterTitle = chapter.title.replace(/ /g, "_");
    const chapterDirName = `${i}_${chapterTitle}`;
    const chapterDir = path.join(outputDir, chapterDirName);

    // Ensure chapter directory exists
    ensureDirectory(chapterDir);

    // Get start time from precomputed array
    const startTime = startTimes[i];

    // Get end time by adding current chapter's duration to start time
    const endTime = addDurations(startTime, chapter.duration);

    const chapterOutputPath = path.join(chapterDir, `${chapterDirName}.mp3`);

    console.log(`Processing chapter ${i}: ${chapter.title}`);

    const timer = new ElapsedTimer();
    timer.start();

    // Extract chapter audio using ffmpeg
    await extractChapter(audioPath, chapterOutputPath, startTime, endTime);

    timer.stop();
  }
}

/**
 * Normalize timestamp to ensure it's in HH:MM:SS format
 * Converts MM:SS to 00:MM:SS
 */
function normalizeTimestamp(timestamp: string): string {
  // Split the timestamp by ":"
  const parts = timestamp.split(":");

  // If it's already in HH:MM:SS format
  if (parts.length === 3) {
    return timestamp;
  }

  // If it's in MM:SS format, add "00:" for hours
  if (parts.length === 2) {
    return `00:${timestamp}`;
  }

  // If it's just seconds (unlikely but handling it anyway)
  return `00:00:${timestamp}`;
}

/**
 * Extract a segment from an audio file using ffmpeg
 */
function extractChapter(
  inputPath: string,
  outputPath: string,
  start: string,
  end: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = ffmpeg(inputPath).setStartTime(start);

    // Calculate duration between start and end
    const duration = calculateDuration(start, end);
    command.setDuration(duration);

    command
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
}

/**
 * Calculate duration between two timestamps (HH:MM:SS format)
 */
function calculateDuration(start: string, end: string): string {
  const [startHours, startMinutes, startSeconds] = start.split(":").map(Number);
  const [endHours, endMinutes, endSeconds] = end.split(":").map(Number);

  const startTotalSeconds =
    startHours * 3600 + startMinutes * 60 + startSeconds;
  const endTotalSeconds = endHours * 3600 + endMinutes * 60 + endSeconds;

  return (endTotalSeconds - startTotalSeconds).toString();
}

/**
 * Add two durations in HH:MM:SS or MM:SS format
 */
function addDurations(duration1: string, duration2: string): string {
  // Normalize both durations to HH:MM:SS format
  const normalizedDuration1 = normalizeTimestamp(duration1);
  const normalizedDuration2 = normalizeTimestamp(duration2);
  
  // Convert to seconds
  const [hours1, minutes1, seconds1] = normalizedDuration1.split(":").map(Number);
  const [hours2, minutes2, seconds2] = normalizedDuration2.split(":").map(Number);
  
  const totalSeconds1 = hours1 * 3600 + minutes1 * 60 + seconds1;
  const totalSeconds2 = hours2 * 3600 + minutes2 * 60 + seconds2;
  
  // Add the seconds
  const resultTotalSeconds = totalSeconds1 + totalSeconds2;
  
  // Convert back to HH:MM:SS
  const resultHours = Math.floor(resultTotalSeconds / 3600);
  const resultMinutes = Math.floor((resultTotalSeconds % 3600) / 60);
  const resultSeconds = resultTotalSeconds % 60;
  
  // Format with leading zeros
  return `${String(resultHours).padStart(2, '0')}:${String(resultMinutes).padStart(2, '0')}:${String(resultSeconds).padStart(2, '0')}`;
}
