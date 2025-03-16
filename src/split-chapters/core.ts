import path from "path";
import { ensureDirectory } from "../common/paths";
import { ElapsedTimer } from "../common/timer";
import { execAsync } from "../common/utils";
import { checkFfmpeg, loadChapterConfig, parseTimestamp } from "./utils";

/**
 * Split a single chapter from the input audio file
 */
async function ffmpegSplit(
  startSeconds: number,
  endSeconds: number,
  inputPath: string,
  outputPath: string
) {
  const command = `ffmpeg -i "${inputPath}" -ss ${startSeconds} -to ${endSeconds} -c copy -y "${outputPath}"`;
  console.log(`Running: ${command}`);

  const timer = new ElapsedTimer();
  timer.start();
  try {
    await execAsync(command);
    console.log(`ffmpeg success: ${outputPath}`);
  } catch (error) {
    console.error(`ffmpeg failed on ${inputPath}:`, error);
    throw error;
  }
  timer.stop();
}

/**
 * Process a specific chapter for a book
 */
export async function splitSingleChapter(
  book: string,
  chapter: string
): Promise<void> {
  console.log(`Splitting single chapter: ${chapter} from book: ${book}`);

  const hasFFmpeg = await checkFfmpeg();
  if (!hasFFmpeg) {
    throw new Error("FFmpeg is required but not installed");
  }

  console.log(`Loading chapter configurations for book: ${book}`);
  const chapterConfig = await loadChapterConfig(book, chapter);

  console.log(`Found chapter "${chapter}" in configurations`);

  const inputPath = path.join("audiobooks", book, `${book}.mp3`);
  console.log(`Input file: ${inputPath}`);

  const outputDir = path.join("audiobooks", book, chapter);
  ensureDirectory(outputDir);

  const outputPath = path.join(outputDir, `${chapter}.mp3`);

  await ffmpegSplit(
    parseTimestamp(chapterConfig.start),
    parseTimestamp(chapterConfig.end),
    inputPath,
    outputPath
  );
}
