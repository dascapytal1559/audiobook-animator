import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "fs";
import * as path from "path";
import { ElapsedTimer } from "../common/timer";
import { validateAudioFile, saveJson } from "./utils";
import { GeminiTranscript, GeminiFileInfo } from "./types";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is not set");
}

const fileManager = new GoogleAIFileManager(API_KEY);
const genAI = new GoogleGenerativeAI(API_KEY);

export async function transcribeAudio(
  audioPath: string
): Promise<GeminiTranscript> {
  validateAudioFile(audioPath);
  const stats = fs.statSync(audioPath);
  console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log("Starting transcription with Gemini...");

  try {
    // Upload the file
    console.log("Uploading audio file...");
    
    let timer = new ElapsedTimer();
    timer.start();
    const uploadResult = await fileManager.uploadFile(audioPath, {
      mimeType: `audio/${path.extname(audioPath).substring(1)}`,
      displayName: path.basename(audioPath),
    });
    timer.stop();

    console.log(`Uploaded file ${uploadResult.file.displayName}`);

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

    console.log(`\nProcessing complete. Getting transcription...`);


    timer = new ElapsedTimer();
    timer.start();

    // Use Gemini model to transcribe
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent([
      "Transcribe this audio file accurately, word-for-word. Only output the transcription text.",
      {
        fileData: {
          fileUri: uploadResult.file.uri,
          mimeType: uploadResult.file.mimeType,
        },
      },
    ]);

    timer.stop();
    const transcription = result.response.text();
    console.log(`Transcription complete`);

    return {
      text: transcription,
    };
  } catch (error) {
    console.error("Error during transcription:", error);
    throw error;
  }
}

export async function transcribeChapter(
  book: string,
  chapter: string
): Promise<void> {
  const audioPath = path.join("audiobooks", book, chapter, `${chapter}.mp3`);

  // Create output paths in the same directory as the audio file
  const chapterDir = path.dirname(audioPath);
  const transcriptPath = path.join(chapterDir, "gemini-transcript.json");

  console.log(`Processing: ${path.basename(audioPath)}`);
  console.log(`Book: ${book}`);
  console.log(`Chapter: ${chapter}`);

  // Get transcription from Gemini
  const transcript = await transcribeAudio(audioPath);

  // Save transcript
  saveJson(transcriptPath, transcript);
  console.log(`Transcript saved to: ${transcriptPath}`);
}
