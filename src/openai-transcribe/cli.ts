import { Command } from "commander";
import { OpenAI } from "openai";
import * as fs from "fs";
import * as path from "path";
import { FLAGS, parseBookDir, parseChapterDirs, parseIds } from "../common/flags";
import { CliTimer, ElapsedTimer } from "../common/timer";
import { ensureDirectory } from "../common/paths";

// --- Types ---
interface Segment {
  id: number;
  start: number;
  end: number;
  text: string;
}

interface Transcript {
  duration: number;
  segmentCount: number;
  segments: Segment[];
  text: string;
}

// --- Utils ---
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

function getChapterDuration(chapterDir: string): number {
  const durationPath = path.join(chapterDir, 'chapter.duration.json');
  if (!fs.existsSync(durationPath)) {
    throw new Error(`Chapter duration file not found: ${durationPath}`);
  }
  const durationData = JSON.parse(fs.readFileSync(durationPath, 'utf8'));
  return durationData.inSeconds;
}

function validateTranscriptDuration(transcript: Transcript, expectedDuration: number): void {
  const actualDuration = transcript.duration;
  const durationDiff = Math.abs(actualDuration - expectedDuration);
  
  // Allow for small timing differences (up to 1 second)
  if (durationDiff > 1) {
    console.warn(`Warning: Transcript duration (${actualDuration.toFixed(2)}s) differs from expected duration (${expectedDuration.toFixed(2)}s) by ${durationDiff.toFixed(2)}s`);
  }
}

function cleanTranscript(response: OpenAI.Audio.TranscriptionVerbose): Transcript {
  const transcript = {
    duration: Number(response.duration),
    segmentCount: response.segments?.length ?? 0,
    segments: response.segments?.map(segment => ({
      id: segment.id,
      start: segment.start,
      end: segment.end,
      text: segment.text
        .replace(/^["']|["']$/g, '')  // Remove quotes at start/end
        .replace(/\s+/g, ' ')         // Normalize whitespace
        .trim(),                      // Trim leading/trailing whitespace
    })) ?? [],
    text: response.text
      .replace(/^["']|["']$/g, '')    // Remove quotes at start/end
      .replace(/\s+/g, ' ')           // Normalize whitespace
      .trim(),                        // Trim leading/trailing whitespace
  };

  // Sort segments by start time to ensure proper order
  transcript.segments.sort((a, b) => a.start - b.start);

  return transcript;
}

// --- Core Logic ---
async function transcribeAudio(audioPath: string): Promise<OpenAI.Audio.TranscriptionVerbose> {
  validateAudioFile(audioPath);
  const stats = fs.statSync(audioPath);
  console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log("Starting transcription...");

  // Get chapter duration
  const chapterDir = path.dirname(audioPath);
  const duration = getChapterDuration(chapterDir);
  console.log(`Expected chapter duration: ${duration} seconds (${Math.floor(duration/60)}:${(duration%60).toString().padStart(2, '0')})`);

  const openai = new OpenAI();
  
  // Start timer for API request
  const timer = new ElapsedTimer();
  const response = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model: "whisper-1",
    response_format: "verbose_json",
    temperature: 0,          // Use zero temperature for maximum accuracy
    language: "en",         // Explicitly specify English
    prompt: `This is an audiobook narration. The audio file is exactly ${duration} seconds long.
Please transcribe it accurately, paying special attention to:
1. Proper sentence breaks and punctuation
2. Accurate word-for-word transcription
3. Correct handling of dialogue and quotes
4. Proper capitalization of names and titles
5. Maintaining the exact timing of the audio (${duration} seconds total)

The transcription should be precise and maintain the literary quality of the text.`,
  });
  timer.stop();

  // Log some debug info
  console.log(`Transcribed duration: ${response.duration} seconds`);
  console.log(`Number of segments: ${response.segments?.length}`);
  
  // Validate the duration
  const transcript = cleanTranscript(response);
  validateTranscriptDuration(transcript, duration);
  
  return response;
}

async function transcribeChapter(chapterDir: string, chunkIndices?: number[]): Promise<void> {
  const chapterName = path.basename(chapterDir);
  
  // Check if we're transcribing chunks or the whole chapter
  if (!chunkIndices || chunkIndices.length === 0) {
    // Transcribe the whole chapter
    const audioPath = path.join(chapterDir, `chapter.mp3`);
    const rawResponsePath = path.join(chapterDir, "chapter.transcript.res.json");
    const transcriptPath = path.join(chapterDir, "chapter.transcript.json");

    console.log(`Processing full chapter: ${chapterName}`);
    console.log(`Audio file: ${audioPath}`);

    // Get transcription from OpenAI
    const response = await transcribeAudio(audioPath);
    
    // Save raw response
    saveJson(rawResponsePath, response);
    console.log(`Raw response saved to: ${rawResponsePath}`);

    // Clean and save transcript
    const transcript = cleanTranscript(response);
    saveJson(transcriptPath, transcript);
    console.log(`Cleaned transcript saved to: ${transcriptPath}`);
  } else {
    // Transcribe specific chunks
    console.log(`Processing ${chunkIndices.length} chunks for chapter: ${chapterName}`);
    
    for (const chunkIndex of chunkIndices) {
      const chunkFileName = `chunk_${chunkIndex}.mp3`;
      const audioPath = path.join(chapterDir, chunkFileName);
      
      if (!fs.existsSync(audioPath)) {
        console.warn(`Chunk file not found: ${audioPath}, skipping`);
        continue;
      }
      
      const rawResponsePath = path.join(chapterDir, `chunk_${chunkIndex}.transcript.res.json`);
      const transcriptPath = path.join(chapterDir, `chunk_${chunkIndex}.transcript.json`);

      console.log(`\nProcessing chunk ${chunkIndex}: ${chunkFileName}`);
      console.log(`Audio file: ${audioPath}`);

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
  }
}

// --- CLI Logic ---
async function main() {
  const timer = new CliTimer();

  try {
    const program = new Command();
    
    program
      .description("Transcribe chapter audio files")
      .option(FLAGS.book.flag, FLAGS.book.description)
      .requiredOption(FLAGS.chapters.flag, FLAGS.chapters.description)
      .option(FLAGS.chunks.flag, FLAGS.chunks.description)
      .action(async (options) => {
        const chapterPaths = parseChapterDirs(
          parseBookDir(options.book),
          options.chapters
        );

        // Parse chunk indices if provided
        let chunkIndices: number[] | undefined;
        if (options.chunks) {
          // Parse all available chunk indices (assuming they're numbered 0,1,2,...)
          // We don't know the actual chunks until runtime, so we use a large number as maximum
          const potentialChunkIds = Array.from({ length: 100 }, (_, i) => i);
          chunkIndices = parseIds(potentialChunkIds, options.chunks);
          console.log(`Processing specific chunks: ${chunkIndices.join(', ')}`);
        }

        // Process each chapter
        for (const chapterPath of chapterPaths) {
          await transcribeChapter(chapterPath, chunkIndices);
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