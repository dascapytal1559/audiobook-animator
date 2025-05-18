import { Command } from "commander";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "fs";
import * as path from "path";
import {
  FLAGS,
  parseBookDir,
  parseChapterDirs,
} from "../common/flags";
import { CliTimer, ElapsedTimer } from "../common/timer";
import * as dotenv from "dotenv";
import {
  GeminiSummary,
  findChapterAudioFile,
  getUploadInfoPath,
  getSummaryResponsePath,
  saveSummary
} from "./paths";
import {
  getChapterDir,
  formatChapterDirName
} from "../split-chapters/paths";

// --- Types ---
/**
 * Result of a summary generation from Gemini
 */
interface SummaryResult {
  shortSummary: string;
  longSummary: string;
  book: string;
  chapter: string;
}

/**
 * Information about a file uploaded to Gemini
 */
interface GeminiFileInfo {
  name: string;
  displayName: string;
  uri: string;
  mimeType: string;
  state: string;
}

/**
 * Stored information about an uploaded file
 */
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

// --- Utility Functions ---
function validateAudioFile(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  if (!filePath.endsWith(".mp3") && !filePath.endsWith(".wav")) {
    throw new Error(`File must be an audio file (mp3 or wav): ${filePath}`);
  }
}

function getUploadedFileInfo(audioPath: string): UploadedFileInfo | null {
  const infoPath = getUploadInfoPath(audioPath);
  if (fs.existsSync(infoPath)) {
    try {
      return JSON.parse(fs.readFileSync(infoPath, "utf8"));
    } catch (error) {
      console.warn(`Could not parse upload info file: ${infoPath}`);
      return null;
    }
  }
  return null;
}

function writeSummary(chapterDir: string, summaryResult: SummaryResult): string {
  const summaryData: GeminiSummary = {
    shortSummary: summaryResult.shortSummary,
    longSummary: summaryResult.longSummary,
    book: summaryResult.book,
    chapter: summaryResult.chapter,
    generated: new Date().toISOString()
  };
  
  const summaryPath = saveSummary(chapterDir, summaryData);
  console.log(`Summary saved to ${summaryPath}`);
  return summaryPath;
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

async function generateSummary(chapterDir: string): Promise<SummaryResult> {
  console.log(`Processing chapter directory: ${chapterDir}`);
  
  // Get book and chapter info from path
  const pathParts = chapterDir.split(path.sep);
  const book = pathParts[pathParts.indexOf("audiobooks") + 1] || "unknown";
  const chapterName = pathParts[pathParts.length - 1] || "unknown";
  
  // Find the MP3 file
  const audioPath = findChapterAudioFile(chapterDir);
  console.log(`Found audio file: ${path.basename(audioPath)}`);
  validateAudioFile(audioPath);
  
  const stats = fs.statSync(audioPath);
  console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  
  try {
    // Check if we already have upload info for this file
    let fileInfo: UploadedFileInfo | null = getUploadedFileInfo(audioPath);
    let uploadResult: { file: { name: string; uri: string; mimeType: string; displayName: string; state: string; } };
    
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
      console.log("Uploading audio file to Gemini...");
      const timer = new ElapsedTimer();
      
      const result = await fileManager.uploadFile(audioPath, {
        mimeType: `audio/${path.extname(audioPath).substring(1)}`,
        displayName: path.basename(audioPath),
      });
      
      timer.stop();
      console.log(`File uploaded successfully`);
      
      // Convert the result to ensure all required fields are present
      uploadResult = {
        file: {
          name: result.file.name,
          uri: result.file.uri,
          mimeType: result.file.mimeType || `audio/${path.extname(audioPath).substring(1)}`,
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
      
      const infoPath = getUploadInfoPath(audioPath);
      fs.writeFileSync(infoPath, JSON.stringify(fileInfo, null, 2), "utf8");
      console.log(`Upload info saved to: ${infoPath}`);
    }
    
    // Fetch the file from the API to check its state
    let file = await fileManager.getFile(uploadResult.file.name);
    
    if (file.state === FileState.PROCESSING) {
      console.log("Audio file is processing. This may take a few minutes...");
    }
    
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
    
    console.log(`\nAudio processing complete. Generating summary...`);
    
    const timer = new ElapsedTimer();
    
    // Use Gemini model to generate summary
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-pro-preview-05-06",
    });
    
    const result = await model.generateContent([
      `
      Listen to this audiobook chapter and provide two summaries of the content in the following format:

      Please include in your summaries:
      1. Main plot events and storyline
      2. Key character developments
      3. Important themes or motifs
      4. Significant revelations
      
      Your response must be formatted as JSON with EXACTLY this structure:
      {
        "shortSummary": "A concise 2-3 sentence summary that captures the essence of the chapter",
        "longSummary": "A comprehensive summary (500-800 words) that provides more detail on plot, characters, themes, and revelations"
      }
      
      IMPORTANT: Do NOT include any newline characters (\n) in the longSummary field. The entire summary should be a single continuous paragraph.
      
      Use present tense and focus on what happens rather than analyzing or interpreting.
      Do NOT include any explanations, formatting, or text outside of the JSON.
      `,
      {
        fileData: {
          fileUri: uploadResult.file.uri,
          mimeType: uploadResult.file.mimeType,
        },
      },
    ]);
    
    const elapsedTime = timer.stop();
    console.log(`Summary generated in ${elapsedTime.toFixed(1)} seconds`);
    
    const responseText = result.response.text().trim();
    
    // Save raw response to file for examination
    const responseFilePath = getSummaryResponsePath(chapterDir);
    fs.writeFileSync(responseFilePath, responseText, "utf-8");
    console.log(`Raw response saved to ${responseFilePath}`);
    
    // Parse the JSON response
    try {
      let jsonResponse;
      // Check if response is wrapped in code blocks and extract just the JSON
      if (responseText.startsWith("```json")) {
        const jsonContent = responseText.replace(/```json|```/g, "").trim();
        jsonResponse = JSON.parse(jsonContent);
      } else {
        jsonResponse = JSON.parse(responseText);
      }
      
      if (!jsonResponse.shortSummary || !jsonResponse.longSummary) {
        throw new Error("Response is missing required fields");
      }
      
      return {
        shortSummary: jsonResponse.shortSummary,
        longSummary: jsonResponse.longSummary,
        book,
        chapter: chapterName,
      };
      
    } catch (parseError) {
      console.error("Failed to parse JSON response:", parseError);
      console.log("Raw response:", responseText);
      
      // Fallback if parsing fails
      return {
        shortSummary: "Error parsing short summary",
        longSummary: responseText, // Use full text as long summary
        book,
        chapter: chapterName,
      };
    }
  } catch (error) {
    console.error(`Error generating summary for ${chapterDir}:`, error);
    throw error;
  }
}

// --- CLI Logic ---
const program = new Command();

program
  .description("Generate chapter summaries using Google's Gemini AI directly from audio files")
  .requiredOption(FLAGS.book.flag, FLAGS.book.description)
  .requiredOption(FLAGS.chapters.flag, FLAGS.chapters.description)
  .action(async (options) => {
    const timer = new CliTimer();
    try {
      const bookDir = parseBookDir(options.book);
      const chapterDirs = parseChapterDirs(bookDir, options.chapters);
      
      if (chapterDirs.length === 0) {
        console.error("No valid chapters found. Exiting.");
        process.exit(1);
      }
      
      console.log(`Processing ${chapterDirs.length} chapter(s) for book: ${options.book}`);
      
      for (const chapterDir of chapterDirs) {
        console.log(`\n--- Processing ${path.basename(chapterDir)} ---`);
        const result = await generateSummary(chapterDir);
        writeSummary(chapterDir, result);
      }
      
      console.log("\nSummary generation complete! 🎉");
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    } finally {
      timer.stop();
    }
  });

// --- Entrypoint ---
if (require.main === module) {
  program.parse(process.argv);
}