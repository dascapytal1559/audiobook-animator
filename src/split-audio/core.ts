import ffmpeg from "fluent-ffmpeg";
import * as fs from "fs";
import path from "path";
import { ensureDirectory } from "../common/paths";
import { ElapsedTimer } from "../common/timer";
import { parseTimestamp } from "./utils";
import { ChapterConfig } from "./types";

/**
 * Split a single chapter from the input audio file
 */
async function ffmpegSplit(
  inputPath: string,
  outputPath: string,
  start: string,
  end: string
) {
  const timer = new ElapsedTimer();
  timer.start();
  const startSeconds = parseTimestamp(start);
  await new Promise<void>((resolve, reject) => {
    const f = ffmpeg(inputPath)
      .setStartTime(startSeconds)
      .output(outputPath)
      .audioCodec("copy")
      .on("start", (commandLine) => {
        console.log(`Running: ${commandLine}`);
      })
      .on("end", () => {
        console.log(`ffmpeg success: ${outputPath}`);
        resolve();
      })
      .on("error", (err) => {
        console.error(`ffmpeg failed on ${inputPath}:`, err);
        reject(err);
      });

    if (end) {
      f.setDuration(parseTimestamp(end) - startSeconds);
    }

    f.run();
  });
  timer.stop();
}

/**
 * Split a chapter from a book
 */
export async function splitChapter(
  book: string,
  chapter: string
): Promise<void> {
  const configPath = path.join("audiobooks", book, chapter, "chapter.json");

  const chapterConfig: ChapterConfig = JSON.parse(
    fs.readFileSync(configPath, "utf-8")
  );

  const inputPath = path.join("audiobooks", book, `${book}.mp3`);

  const outputDir = path.join("audiobooks", book, chapter);
  ensureDirectory(outputDir);

  const outputPath = path.join(outputDir, `${chapter}.mp3`);

  await ffmpegSplit(
    inputPath,
    outputPath,
    chapterConfig.start,
    chapterConfig.end
  );
}

/**
 * Split a chapter into chunks
 */
export async function splitChapterChunks(
  book: string,
  chapter: string
): Promise<void> {
  const configPath = path.join(
    "audiobooks",
    book,
    chapter,
    "chapter_chunks.json"
  );

  const midpoints: string[] = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  if (midpoints.length === 0) {
    throw new Error(`No midpoints found for chapter chunks: ${chapter}`);
  }

  const inputPath = path.join("audiobooks", book, chapter, `${chapter}.mp3`);

  const outputDir = path.join("audiobooks", book, chapter);

  // Process each chunk
  let startTimestamp = "00:00:00";
  for (let i = 0; i < midpoints.length + 1; i++) {
    const endTimestamp = i === midpoints.length ? "" : midpoints[i];

    const chunkOutputPath = path.join(outputDir, `${chapter}_${i + 1}.mp3`);
    console.log(
      `Splitting chunk#${i + 1}: ${startTimestamp} to ${endTimestamp || "end"}`
    );

    await ffmpegSplit(inputPath, chunkOutputPath, startTimestamp, endTimestamp);
    startTimestamp = midpoints[i];
  }
}
