import * as path from "path";
import * as fs from "fs";

// --- Transcript Types ---

/**
 * Represents a single segment in the transcript
 */
export interface Segment {
  id: number;
  start: number;
  end: number;
  text: string;
}

/**
 * Represents a complete transcript with segments and metadata
 */
export interface Transcript {
  duration: number;
  segmentCount: number;
  segments: Segment[];
  text: string;
}

// --- Duration Type ---

/**
 * Structure of the duration data matching split-chapters format
 */
export interface ChapterDuration {
  inSeconds: number;
  inTimestamp: string;
}

// --- Audio Chunk Utilities ---

/**
 * Get the path to a chunk audio file
 * @param chapterDir The chapter directory path
 * @param chunkIndex The index of the chunk
 * @returns Path to the chunk audio file
 */
export function getChunkAudioPath(chapterDir: string, chunkIndex: number): string {
  return path.join(chapterDir, `chunk_${chunkIndex}.mp3`);
}

/**
 * Get the path to a chunk's duration file
 * @param chapterDir The chapter directory path
 * @param chunkIndex The index of the chunk
 * @returns Path to the chunk duration file
 */
export function getChunkDurationPath(chapterDir: string, chunkIndex: number): string {
  return path.join(chapterDir, `chunk_${chunkIndex}.duration.json`);
}

/**
 * Format a duration in seconds to a timestamp string (HH:MM:SS)
 * @param durationInSeconds The duration in seconds
 * @returns Formatted timestamp string
 */
function formatTimestamp(durationInSeconds: number): string {
  const hours = Math.floor(durationInSeconds / 3600);
  const minutes = Math.floor((durationInSeconds % 3600) / 60);
  const seconds = Math.floor(durationInSeconds % 60);
  return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Save duration data for a chunk
 * @param chapterDir The chapter directory path
 * @param chunkIndex The index of the chunk
 * @param durationInSeconds Duration in seconds
 * @returns Path to the saved file
 */
export function saveChunkDuration(
  chapterDir: string,
  chunkIndex: number,
  durationInSeconds: number
): string {
  const outputPath = getChunkDurationPath(chapterDir, chunkIndex);
  
  // Create duration data matching the format in split-chapters
  const data: ChapterDuration = {
    inSeconds: durationInSeconds,
    inTimestamp: formatTimestamp(durationInSeconds)
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), "utf-8");
  return outputPath;
}

/**
 * Get the duration of a chunk if available
 * @param chapterDir The chapter directory path
 * @param chunkIndex The index of the chunk
 * @returns Duration in seconds or null if not found
 */
export function getChunkDuration(
  chapterDir: string,
  chunkIndex: number
): number | null {
  const durationPath = getChunkDurationPath(chapterDir, chunkIndex);
  
  if (!fs.existsSync(durationPath)) {
    return null;
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(durationPath, "utf-8")) as ChapterDuration;
    return data.inSeconds;
  } catch (error) {
    console.warn(`Error parsing chunk duration at ${durationPath}:`, error);
    return null;
  }
}

// --- Transcript File Utilities ---

/**
 * Get the path to a transcript JSON file
 * @param audioPath Path to the audio file
 * @returns Path to the transcript JSON file
 */
export function getTranscriptPath(audioPath: string): string {
  return path.join(
    path.dirname(audioPath),
    path.basename(audioPath, path.extname(audioPath)) + ".transcript.json"
  );
}

/**
 * Get the path to a transcript raw response file
 * @param audioPath Path to the audio file
 * @returns Path to the transcript raw response file
 */
export function getTranscriptResponsePath(audioPath: string): string {
  return path.join(
    path.dirname(audioPath),
    path.basename(audioPath, path.extname(audioPath)) + ".transcript.res.json"
  );
}

/**
 * Save transcript data to disk
 * @param audioPath Path to the audio file the transcript is for
 * @param transcript The transcript data to save
 * @returns Path to the saved file
 */
export function saveTranscript(audioPath: string, transcript: Transcript): string {
  const outputPath = getTranscriptPath(audioPath);
  fs.writeFileSync(outputPath, JSON.stringify(transcript, null, 2), "utf-8");
  return outputPath;
}

/**
 * Save raw transcript response to disk
 * @param audioPath Path to the audio file the transcript is for
 * @param response The raw response data to save
 * @returns Path to the saved file
 */
export function saveTranscriptResponse(audioPath: string, response: any): string {
  const outputPath = getTranscriptResponsePath(audioPath);
  fs.writeFileSync(outputPath, JSON.stringify(response, null, 2), "utf-8");
  return outputPath;
}

/**
 * Get the transcript for an audio file if available
 * @param audioPath Path to the audio file
 * @returns The transcript or null if not found
 */
export function getTranscript(audioPath: string): Transcript | null {
  const transcriptPath = getTranscriptPath(audioPath);
  
  if (!fs.existsSync(transcriptPath)) {
    return null;
  }
  
  try {
    return JSON.parse(fs.readFileSync(transcriptPath, "utf-8"));
  } catch (error) {
    console.warn(`Error parsing transcript at ${transcriptPath}:`, error);
    return null;
  }
} 