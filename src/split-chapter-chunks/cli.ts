import { Command } from "commander";
import ffmpeg from "fluent-ffmpeg";
import * as fs from "fs";
import path from "path";
import { FLAGS, parseBookDir, parseChapterDirs } from "../common/flags";
import { CliTimer, ElapsedTimer } from "../common/timer";
import { addDuration } from "../common/timestamps";

// --- Types ---
type ChunksConfig = string[];

// --- Core Logic ---
async function splitChapterChunks(chapterDir: string): Promise<void> {
  // ensure files exist
  const configPath = path.join(chapterDir, "chunks.config.json");
  if (!fs.existsSync(configPath)) {
    throw new Error(`Chapter chunks configuration not found at ${configPath}`);
  }

  const inputPath = path.join(chapterDir, `chapter.mp3`);
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Chapter audio file not found at ${inputPath}`);
  }

  // read config
  const chunksConfig: ChunksConfig = JSON.parse(
    fs.readFileSync(configPath, "utf-8")
  );

  // Process each chunk
  let startTimestamp = "00:00:00";
  for (const i in chunksConfig) {
    const duration = chunksConfig[i];
    const toEnd = duration === "remainder";

    const fileName = `chunk_${i}.mp3`;

    const chunkOutputPath = path.join(chapterDir, fileName);

    const durStr = toEnd ? "to the end" : `for ${duration}`;

    console.log(
      `\nSplitting ${fileName}: starting at ${startTimestamp} ${durStr}`
    );

    const timer = new ElapsedTimer();
    await new Promise<void>((resolve, reject) => {
      const f = ffmpeg(inputPath)
        .setStartTime(startTimestamp)
        .output(chunkOutputPath)
        .audioCodec("copy")
        .on("start", (commandLine) => {
          console.log(`Running: ${commandLine}`);
        })
        .on("end", () => {
          timer.stop();
          console.log(`ffmpeg success: ${chunkOutputPath}`);
          resolve();
        })
        .on("error", (err) => {
          timer.stop();
          console.error(`ffmpeg failed on ${inputPath}:`, err);
          reject(err);
        });

      if (!toEnd) {
        f.setDuration(duration);
      }

      f.run();
    });

    if (!toEnd) {
      startTimestamp = addDuration(startTimestamp, duration);
    }
  }
}

// --- CLI Logic ---
async function main() {
  const timer = new CliTimer();

  try {
    const program = new Command();
    await program
      .option(FLAGS.book.flag, FLAGS.book.description)
      .requiredOption(FLAGS.chapters.flag, FLAGS.chapters.description)
      .action(async (options) => {
        const chapterPaths = parseChapterDirs(
          parseBookDir(options.book),
          options.chapters
        );

        for (const chapterPath of chapterPaths) {
          await splitChapterChunks(chapterPath);
        }
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

// --- Entrypoint ---
if (require.main === module) {
  main();
}
