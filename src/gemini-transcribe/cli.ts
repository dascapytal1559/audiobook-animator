import { Command } from "commander";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "fs";
import * as path from "path";
import {
  FLAGS,
  parseBookDir,
  parseChapterDirs,
  parseIds,
} from "../common/flags";
import { CliTimer, ElapsedTimer } from "../common/timer";
import { ensureDirectory } from "../common/paths";
import * as dotenv from "dotenv";

// --- Types ---
interface GeminiTranscript {
  text: string;
  duration?: number;
  sentences?: Array<{ text: string; startTime: number; endTime: number }>;
}

interface GeminiFileInfo {
  name: string;
  displayName: string;
  uri: string;
  mimeType: string;
  state: string;
}

// For saving uploaded file metadata
interface UploadedFileInfo {
  name: string;
  uri: string;
  mimeType: string;
  displayName: string;
  uploadDate: string;
  originalPath: string;
  fileSize: number;
  state: string;
}

// --- Utils ---
function validateAudioFile(audioPath: string): void {
  // Check if file exists
  if (!fs.existsSync(audioPath)) {
    throw new Error(`Audio file not found: ${audioPath}`);
  }

  // Check if it's an audio file (by extension)
  const ext = path.extname(audioPath).toLowerCase();
  if (![".mp3", ".wav", ".m4a", ".mp4"].includes(ext)) {
    throw new Error(`Unsupported audio format: ${ext}`);
  }
}

function saveJson(filePath: string, data: any): void {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  console.log(`JSON saved to: ${filePath}`);
}

function getUploadInfoPath(audioPath: string): string {
  return audioPath + ".upload-info.json";
}

function getUploadedFileInfo(audioPath: string): UploadedFileInfo | null {
  const infoPath = getUploadInfoPath(audioPath);
  if (fs.existsSync(infoPath)) {
    try {
      return JSON.parse(fs.readFileSync(infoPath, "utf8"));
    } catch (e) {
      console.warn(`Failed to parse upload info file: ${infoPath}`, e);
      return null;
    }
  }
  return null;
}

function saveUploadedFileInfo(
  audioPath: string,
  fileInfo: UploadedFileInfo
): void {
  const infoPath = getUploadInfoPath(audioPath);
  saveJson(infoPath, fileInfo);
}

// --- Core Logic ---
// Load environment variables
dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is not set");
}

const fileManager = new GoogleAIFileManager(API_KEY);
const genAI = new GoogleGenerativeAI(API_KEY);

async function transcribeAudio(audioPath: string): Promise<GeminiTranscript> {
  validateAudioFile(audioPath);
  const stats = fs.statSync(audioPath);
  console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log("Starting transcription with Gemini...");

  try {
    // Check if we already have upload info for this file
    let fileInfo: UploadedFileInfo | null = getUploadedFileInfo(audioPath);
    let uploadResult: { file: GeminiFileInfo };

    if (fileInfo && fileInfo.fileSize === stats.size) {
      console.log(`Found existing upload info for ${path.basename(audioPath)}`);
      uploadResult = {
        file: {
          name: fileInfo.name,
          uri: fileInfo.uri,
          mimeType: fileInfo.mimeType,
          displayName: fileInfo.displayName,
          state: fileInfo.state,
        },
      };
    } else {
      // Upload the file
      console.log("Uploading audio file...");

      let timer = new ElapsedTimer();
      const result = await fileManager.uploadFile(audioPath, {
        mimeType: `audio/${path.extname(audioPath).substring(1)}`,
        displayName: path.basename(audioPath),
      });
      timer.stop();

      console.log(`Uploaded file ${result.file.displayName}`);

      // Convert the result to ensure all required fields are present
      uploadResult = {
        file: {
          name: result.file.name,
          uri: result.file.uri,
          mimeType:
            result.file.mimeType ||
            `audio/${path.extname(audioPath).substring(1)}`,
          displayName: result.file.displayName || path.basename(audioPath),
          state: result.file.state || FileState.ACTIVE,
        },
      };

      // Save upload info for future use
      fileInfo = {
        name: uploadResult.file.name,
        uri: uploadResult.file.uri,
        mimeType: uploadResult.file.mimeType,
        displayName: uploadResult.file.displayName,
        uploadDate: new Date().toISOString(),
        originalPath: audioPath,
        fileSize: stats.size,
        state: uploadResult.file.state,
      };

      saveUploadedFileInfo(audioPath, fileInfo);
    }

    // Wait for processing to complete
    let file = await fileManager.getFile(uploadResult.file.name);
    console.log("Waiting for file processing to complete...");

    while (file.state === FileState.PROCESSING) {
      process.stdout.write(".");
      // Sleep for 10 seconds
      await new Promise((resolve) => setTimeout(resolve, 10_000));
      // Fetch the file from the API again
      file = await fileManager.getFile(uploadResult.file.name);
    }

    if (file.state === FileState.FAILED) {
      throw new Error("Audio processing failed.");
    }

    console.log(`Processing complete. Getting transcription...`);

    let timer = new ElapsedTimer();
    // Use Gemini model to transcribe
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-pro-exp-03-25",
    });
    const result = await model.generateContent(
      [
        `
      Transcribe this audio file accurately, word-for-word. 

      Break down the transcription into scenes and shots:

      1. Identify distinct scenes based on context changes, settings, or narrative shifts
      2. Within each scene, identify individual shots that would work well as visual segments
      3. For each shot, include:
         - A concise description of what's happening in the shot
         - The transcribed text contained in that shot
         - Start time (in seconds)
         - End time (in seconds) 
         - Key characters visible or mentioned (if any)
         - Key objects/items visible or described (if any)

      Return the result as JSON with this format: 

      {
        "text": "Transcript text",
        "bookDescription": "Description of the book",
        "scenes": [
          {
            "sceneDescription": "Description of scene setting/context",
            "shots": [
              {
                "shotDescription": "Description of what's happening in this shot",
                "transcript": "Exact transcribed text for this shot",
                "startTime": 0.0,
                "endTime": 5.0,
                "keyCharacters": ["character1", "character2"],
                "keyObjects": ["object1", "object2"]
              }
            ]
          }
        ]
      }
      `,
        {
          fileData: {
            fileUri: uploadResult.file.uri,
            mimeType: uploadResult.file.mimeType,
          },
        },
      ],
    );

    timer.stop();

    const responseText = result.response.text();
    let transcript: GeminiTranscript = { text: responseText };

    // Try to parse JSON if present in the response
    try {
      if (responseText.includes("{") && responseText.includes("}")) {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsedJson = JSON.parse(jsonMatch[0]);
          if (parsedJson.text) {
            transcript = parsedJson;
            console.log(
              `Transcription complete with ${
                transcript.sentences?.length || 0
              } timestamped sentences`
            );
          }
        }
      }
    } catch (e) {
      // If parsing fails, we already have the raw text in transcript
      console.log("Could not parse sentence timestamps, using raw transcript");
    }

    console.log(`Transcription complete`);
    return transcript;
  } catch (error) {
    console.error("Error during transcription:", error);
    throw error;
  }
}

async function transcribeChapter(
  chapterDir: string,
  chunkIndices?: number[]
): Promise<void> {
  const chapterName = path.basename(chapterDir);

  // Check if we're transcribing chunks or the whole chapter
  if (!chunkIndices || chunkIndices.length === 0) {
    // Transcribe the whole chapter
    const audioPath = path.join(chapterDir, `chapter.mp3`);
    const transcriptPath = path.join(
      chapterDir,
      "chapter.gemini-transcript.json"
    );

    console.log(`Processing full chapter: ${chapterName}`);
    console.log(`Audio file: ${audioPath}`);

    // Get transcription from Gemini
    const transcript = await transcribeAudio(audioPath);

    // Save transcript
    saveJson(transcriptPath, transcript);
    console.log(`Transcript saved to: ${transcriptPath}`);
  } else {
    // Transcribe specific chunks
    console.log(
      `Processing ${chunkIndices.length} chunks for chapter: ${chapterName}`
    );

    for (const chunkIndex of chunkIndices) {
      const chunkFileName = `chunk_${chunkIndex}.mp3`;
      const audioPath = path.join(chapterDir, chunkFileName);

      if (!fs.existsSync(audioPath)) {
        console.warn(`Chunk file not found: ${audioPath}, skipping`);
        continue;
      }

      const transcriptPath = path.join(
        chapterDir,
        `chunk_${chunkIndex}.gemini-transcript.json`
      );

      console.log(`Processing chunk ${chunkIndex}: ${chunkFileName}`);
      console.log(`Audio file: ${audioPath}`);

      // Get transcription from Gemini
      const transcript = await transcribeAudio(audioPath);

      // Save transcript
      saveJson(transcriptPath, transcript);
      console.log(`Transcript saved to: ${transcriptPath}`);
    }
  }
}

// --- CLI Logic ---
async function main() {
  const timer = new CliTimer();

  try {
    const program = new Command();

    program
      .description("Transcribe chapter audio files using Google Gemini")
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
          console.log(`Processing specific chunks: ${chunkIndices.join(", ")}`);
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
