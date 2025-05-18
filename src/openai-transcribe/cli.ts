import { exec } from "child_process";
import { Command } from "commander";
import * as fs from "fs";
import { OpenAI } from "openai";
import * as path from "path";
import { promisify } from "util";
import { FLAGS, parseBookDir, parseChapterDirs } from "../common/flags";
import { ensureDirectory } from "../common/paths";
import { CliTimer, ElapsedTimer } from "../common/timer";
import {
  findChapterAudioFile,
  getGeminiSummary,
} from "../gemini-summary/paths";
import {
  getChapterAudioPath,
  getChapterDuration,
  saveChapterDuration,
} from "../split-chapters/paths";

const execAsync = promisify(exec);

// --- Constants ---
const MAX_CHUNK_DURATION = 45 * 60; // 45 minutes in seconds

// --- File Utilities ---

function validateAudioFile(audioPath: string): void {
  if (!fs.existsSync(audioPath)) {
    throw new Error(`Audio file not found: ${audioPath}`);
  }

  const extension = path.extname(audioPath).toLowerCase();
  if (extension !== ".mp3") {
    throw new Error(
      `Unsupported audio format: ${extension}. Only .mp3 files are supported.`
    );
  }
}

function saveJson(filePath: string, data: any): void {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// --- Summary Utilities ---

/**
 * Get the Gemini summary for a chapter if available
 */
function getChapterSummary(chapterDir: string): string | undefined {
  const geminiSummary = getGeminiSummary(chapterDir);
  return geminiSummary?.shortSummary;
}

// --- Transcript Handling ---

/**
 * Represents a single segment in the transcript
 */
interface Segment {
  id: number;
  start: number;
  end: number;
  text: string;
}

/**
 * Represents a complete transcript with segments and metadata
 */
interface Transcript {
  duration: number;
  segmentCount: number;
  segments: Segment[];
  text: string;
}

function validateTranscriptDuration(
  transcript: Transcript,
  expectedDuration: number
): void {
  const actualDuration = transcript.duration;
  const durationDiff = Math.abs(actualDuration - expectedDuration);

  // Allow for small timing differences (up to 1 second)
  if (durationDiff > 1) {
    console.warn(
      `Warning: Transcript duration (${actualDuration.toFixed(
        2
      )}s) differs from expected duration (${expectedDuration.toFixed(
        2
      )}s) by ${durationDiff.toFixed(2)}s`
    );
  }
}

function cleanTranscript(
  response: OpenAI.Audio.TranscriptionVerbose
): Transcript {
  const transcript = {
    duration: Number(response.duration),
    segmentCount: response.segments?.length ?? 0,
    segments:
      response.segments?.map((segment) => ({
        id: segment.id,
        start: segment.start,
        end: segment.end,
        text: segment.text
          .replace(/^["']|["']$/g, "") // Remove quotes at start/end
          .replace(/\s+/g, " ") // Normalize whitespace
          .trim(), // Trim leading/trailing whitespace
      })) ?? [],
    text: response.text
      .replace(/^["']|["']$/g, "") // Remove quotes at start/end
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim(), // Trim leading/trailing whitespace
  };

  // Sort segments by start time to ensure proper order
  transcript.segments.sort((a, b) => a.start - b.start);

  return transcript;
}

// --- Audio Chunking ---

/**
 * Split audio file into chunks of maximum duration
 */
async function splitAudioIntoChunks(
  audioPath: string,
  totalDuration: number
): Promise<string[]> {
  console.log(
    `Splitting audio file into ${Math.ceil(
      totalDuration / MAX_CHUNK_DURATION
    )} chunks of max ${MAX_CHUNK_DURATION} seconds...`
  );

  const chunkPaths: string[] = [];
  const dir = path.dirname(audioPath);
  const chunkCount = Math.ceil(totalDuration / MAX_CHUNK_DURATION);

  for (let i = 0; i < chunkCount; i++) {
    const start = i * MAX_CHUNK_DURATION;
    const duration = Math.min(MAX_CHUNK_DURATION, totalDuration - start);
    const chunkPath = path.join(dir, `chunk_${i}.mp3`);

    console.log(`Creating chunk ${i}: start=${start}s, duration=${duration}s`);

    // Use ffmpeg to extract chunk
    await execAsync(
      `ffmpeg -y -i "${audioPath}" -ss ${start} -t ${duration} -acodec copy "${chunkPath}"`
    );

    // Create duration file for this chunk
    const chunkDurationPath = path.join(dir, `chunk_${i}.duration.json`);

    // Save duration data
    saveChapterDuration(dir, duration);

    chunkPaths.push(chunkPath);
  }

  return chunkPaths;
}

/**
 * Stitch together transcriptions from multiple chunks
 */
function stitchTranscriptions(
  transcripts: Transcript[],
  chunkDurations: number[]
): Transcript {
  let combinedText = "";
  const combinedSegments: Segment[] = [];
  let totalDuration = 0;
  let segmentIdOffset = 0;

  // Process each transcript
  transcripts.forEach((transcript, index) => {
    // Add text with a newline
    combinedText += (index > 0 ? "\n" : "") + transcript.text;

    // Calculate time offsets for this chunk
    const timeOffset = chunkDurations
      .slice(0, index)
      .reduce((sum, d) => sum + d, 0);

    // Adjust segment times and IDs
    const adjustedSegments = transcript.segments.map((segment) => ({
      id: segment.id + segmentIdOffset,
      start: segment.start + timeOffset,
      end: segment.end + timeOffset,
      text: segment.text,
    }));

    combinedSegments.push(...adjustedSegments);
    totalDuration += transcript.duration;

    // Update ID offset for next chunk's segments
    segmentIdOffset += transcript.segmentCount;
  });

  // Sort segments by start time to ensure proper order
  combinedSegments.sort((a, b) => a.start - b.start);

  return {
    duration: totalDuration,
    segmentCount: combinedSegments.length,
    segments: combinedSegments,
    text: combinedText,
  };
}

// --- Core Logic ---

/**
 * Transcribe an audio file using OpenAI's API
 */
async function transcribeAudio(
  audioPath: string,
  expectedDuration: number,
  chapterSummary?: string
): Promise<OpenAI.Audio.TranscriptionVerbose> {
  validateAudioFile(audioPath);
  const stats = fs.statSync(audioPath);
  console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log("Starting transcription...");

  console.log(
    `Expected audio duration: ${expectedDuration} seconds (${Math.floor(
      expectedDuration / 60
    )}:${(expectedDuration % 60).toString().padStart(2, "0")})`
  );

  const openai = new OpenAI();

  // Create prompt with or without summary context
  let promptText = `This is an audiobook narration. The audio file is exactly ${expectedDuration} seconds long.`;

  // Add chapter summary if available
  if (chapterSummary) {
    console.log("Including chapter summary in prompt for better context");
    promptText += `\n\nContent summary: ${chapterSummary}`;
  }

  promptText += `\n\nPlease transcribe it accurately, paying special attention to:
1. Proper sentence breaks and punctuation
2. Accurate word-for-word transcription
3. Correct handling of dialogue and quotes
4. Proper capitalization of names and titles
5. Maintaining the exact timing of the audio (${expectedDuration} seconds total)

The transcription should be precise and maintain the literary quality of the text.`;

  // Start timer for API request
  const timer = new ElapsedTimer();
  const response = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model: "whisper-1",
    response_format: "verbose_json",
    temperature: 0, // Use zero temperature for maximum accuracy
    language: "en", // Explicitly specify English
    prompt: promptText,
  });
  timer.stop();

  // Log some debug info
  console.log(`Transcribed duration: ${response.duration} seconds`);
  console.log(`Number of segments: ${response.segments?.length}`);

  // Validate the duration
  const transcript = cleanTranscript(response);
  validateTranscriptDuration(transcript, expectedDuration);

  return response;
}

/**
 * Process a chapter, handling chunking if needed
 */
async function transcribeChapter(
  chapterDir: string,
  forceChunks: boolean = false
): Promise<void> {
  const chapterName = path.basename(chapterDir);

  // Get audio file - first try the standard name, then fallback to finding any mp3
  let audioPath = getChapterAudioPath(chapterDir);
  if (!fs.existsSync(audioPath)) {
    console.log("Standard chapter.mp3 not found, looking for any MP3 file...");
    audioPath = findChapterAudioFile(chapterDir);
  }

  // Get chapter duration
  const durationData = getChapterDuration(chapterDir);
  if (!durationData) {
    throw new Error(`Could not get chapter duration for ${chapterDir}`);
  }
  const totalDuration = durationData.inSeconds;

  console.log(`\nProcessing chapter: ${chapterName}`);
  console.log(`Audio file: ${audioPath}`);
  console.log(
    `Total duration: ${totalDuration} seconds (${Math.floor(
      totalDuration / 3600
    )}:${Math.floor((totalDuration % 3600) / 60)
      .toString()
      .padStart(2, "0")}:${Math.floor(totalDuration % 60)
      .toString()
      .padStart(2, "0")})`
  );

  // Get Gemini summary if available
  const shortSummary = getChapterSummary(chapterDir);

  if (shortSummary) {
    console.log("Found Gemini summary for chapter. Will use for context.");
  } else {
    console.log("No Gemini summary found. Proceeding without context.");
  }

  // Check if we need to split into chunks (more than max duration or forced chunking)
  const needsChunking = forceChunks || totalDuration > MAX_CHUNK_DURATION;

  if (!needsChunking) {
    // Simple case: Transcribe the whole chapter at once
    console.log("Chapter is less than 45 minutes, transcribing as a whole");

    const rawResponsePath = path.join(
      chapterDir,
      "chapter.transcript.res.json"
    );
    const transcriptPath = path.join(chapterDir, "chapter.transcript.json");

    // Get transcription from OpenAI
    const response = await transcribeAudio(
      audioPath,
      totalDuration,
      shortSummary
    );

    // Save raw response
    saveJson(rawResponsePath, response);
    console.log(`Raw response saved to: ${rawResponsePath}`);

    // Clean and save transcript
    const transcript = cleanTranscript(response);
    saveJson(transcriptPath, transcript);
    console.log(`Cleaned transcript saved to: ${transcriptPath}`);
  } else {
    // Complex case: Split into chunks, transcribe each, then stitch together
    console.log("Chapter is longer than 45 minutes, splitting into chunks");

    // Split the audio file into chunks
    const chunkPaths = await splitAudioIntoChunks(audioPath, totalDuration);
    const chunkDurations: number[] = [];
    const chunkTranscripts: Transcript[] = [];

    // Process each chunk
    for (let i = 0; i < chunkPaths.length; i++) {
      const chunkPath = chunkPaths[i];
      const chunkDurationPath = path.join(
        chapterDir,
        `chunk_${i}.duration.json`
      );
      const durationData = JSON.parse(
        fs.readFileSync(chunkDurationPath, "utf8")
      );
      const chunkDuration = durationData.inSeconds;
      chunkDurations.push(chunkDuration);

      console.log(`\nProcessing chunk ${i}: ${path.basename(chunkPath)}`);
      console.log(`Chunk duration: ${chunkDuration} seconds`);

      const rawResponsePath = path.join(
        chapterDir,
        `chunk_${i}.transcript.res.json`
      );
      const transcriptPath = path.join(
        chapterDir,
        `chunk_${i}.transcript.json`
      );

      // Get transcription from OpenAI - use summary for every chunk for consistent context
      const response = await transcribeAudio(
        chunkPath,
        chunkDuration,
        shortSummary
      );

      // Save raw response
      saveJson(rawResponsePath, response);
      console.log(`Raw response saved to: ${rawResponsePath}`);

      // Clean and save transcript
      const transcript = cleanTranscript(response);
      saveJson(transcriptPath, transcript);
      console.log(`Cleaned transcript saved to: ${transcriptPath}`);

      // Add to collection for stitching later
      chunkTranscripts.push(transcript);
    }

    // Stitch transcriptions together
    console.log("\nStitching transcriptions together...");
    const stitchedTranscript = stitchTranscriptions(
      chunkTranscripts,
      chunkDurations
    );

    // Validate stitched transcript
    validateTranscriptDuration(stitchedTranscript, totalDuration);

    // Save the stitched transcript
    const stitchedPath = path.join(chapterDir, "chapter.transcript.json");
    saveJson(stitchedPath, stitchedTranscript);
    console.log(`Stitched transcript saved to: ${stitchedPath}`);

    // Create a convenience file listing all used chunks
    const chunksMetadata = {
      totalDuration,
      chunkCount: chunkPaths.length,
      chunks: chunkPaths.map((path, i) => ({
        index: i,
        path,
        duration: chunkDurations[i],
        segments: chunkTranscripts[i].segmentCount,
      })),
    };
    saveJson(path.join(chapterDir, "chunks.json"), chunksMetadata);
  }
}

// --- CLI Logic ---
async function main() {
  const timer = new CliTimer();

  try {
    const program = new Command();

    program
      .description(
        "Transcribe chapter audio files with automatic chunking for files >45 minutes"
      )
      .option(FLAGS.book.flag, FLAGS.book.description)
      .requiredOption(FLAGS.chapters.flag, FLAGS.chapters.description)
      .option(FLAGS.chunks.flag, "Force chunking even for files <45 minutes")
      .action(async (options) => {
        const chapterPaths = parseChapterDirs(
          parseBookDir(options.book),
          options.chapters
        );

        const forceChunks = options.chunks === true;
        if (forceChunks) {
          console.log("Forcing chunking for all files regardless of duration");
        }

        // Process each chapter
        for (const chapterPath of chapterPaths) {
          await transcribeChapter(chapterPath, forceChunks);
        }
      });

    await program.parseAsync(process.argv);
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
