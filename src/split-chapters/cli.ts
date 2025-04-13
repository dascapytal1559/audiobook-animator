import { Command } from "commander";
import ffmpeg from "fluent-ffmpeg";
import * as fs from "fs";
import path from "path";
import { FLAGS, parseBookDir, parseIds } from "../common/flags";
import { ensureDirectory } from "../common/paths";
import { CliTimer, ElapsedTimer } from "../common/timer";
import { addDuration } from "../common/timestamps";

// --- Types ---
interface ChapterConfig {
  title: string;
  duration: string; // Format: "HH:MM:SS" or "MM:SS"
}

type ChaptersConfig = ChapterConfig[];

// --- Core Logic ---
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

  const chaptersConfig: ChaptersConfig = JSON.parse(
    fs.readFileSync(chaptersConfigPath, "utf-8")
  );

  // Determine which chapters to process
  const chapterIndices = Array.from(
    { length: chaptersConfig.length },
    (_, i) => i
  );
  const selectedIndices = parseIds(chapterIndices, isolatedChapterInput);

  console.log(
    `Processing ${selectedIndices.length} / ${chaptersConfig.length} chapters`
  );

  // Calculate start times for each chapter
  const startTimes: string[] = ["00:00:00"];
  let currentTimestamp = "00:00:00";

  for (let i = 0; i < chaptersConfig.length - 1; i++) {
    const duration = chaptersConfig[i].duration;
    currentTimestamp = addDuration(currentTimestamp, duration);
    startTimes.push(currentTimestamp);
  }

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

    const startTime = startTimes[index];
    const duration = chapter.duration;

    console.log(
      `\nExtracting chapter ${index}: ${chapter.title} (start at ${startTime} for ${duration})`
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
