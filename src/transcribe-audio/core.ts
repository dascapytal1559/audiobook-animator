import { OpenAI } from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { ElapsedTimer } from '../common/timer';
import { validateAudioFile, saveJson } from './utils';
import { Transcript } from './types';

const openai = new OpenAI();

export async function transcribeAudio(audioPath: string): Promise<OpenAI.Audio.TranscriptionVerbose> {
  validateAudioFile(audioPath);
  const stats = fs.statSync(audioPath);
  console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log('Starting transcription...');

  // Start timer for API request
  const timer = new ElapsedTimer();
  timer.start();
  const response = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["word", "segment"],
    temperature: 0,          // Use zero temperature for maximum accuracy
    language: "en",         // Explicitly specify English
    prompt: "This is an audiobook narration",  // Give context about the content
  });
  timer.stop();

  // Log some debug info
  console.log(`\nTranscribed duration: ${response.duration} seconds`);
  console.log(`Number of segments: ${response.segments?.length}`);
  
  return response;
}

export function cleanTranscript(response: OpenAI.Audio.TranscriptionVerbose): Transcript {
  return {
    duration: Number(response.duration),
    segmentCount: response.segments?.length ?? 0,
    segments: response.segments?.map(segment => ({
      id: segment.id,
      start: segment.start,
      end: segment.end,
      text: segment.text.replace("\"'", "").replace(/'$/, ""),
    })) ?? [],
    text: response.text,
  };
}

/**
 * Transcribe a chapter from a book
 * @param book The book name
 * @param chapterDir The chapter directory name (format: "0_Chapter_Name")
 */
export async function transcribeChapter(book: string, chapterDir: string): Promise<void> {
  const chapterPath = path.join("audiobooks", book, chapterDir);
  const audioFileName = `${chapterDir}.mp3`;
  const audioPath = path.join(chapterPath, audioFileName);

  // Create output paths in the same directory as the audio file
  const rawResponsePath = path.join(chapterPath, 'transcript.res.json');
  const transcriptPath = path.join(chapterPath, 'transcript.json');

  console.log(`Processing: ${path.basename(audioPath)}`);
  console.log(`Book: ${book}`);
  console.log(`Chapter: ${chapterDir}`);

  // Get transcription from OpenAI
  const response = await transcribeAudio(audioPath);
  
  // Save raw response
  saveJson(rawResponsePath, response);
  console.log(`Raw response saved to: ${rawResponsePath}`);

  // Clean and save transcript
  const transcript = cleanTranscript(response);
  saveJson(transcriptPath, transcript);
  console.log(`Cleaned transcript saved to: ${transcriptPath}`);
} 