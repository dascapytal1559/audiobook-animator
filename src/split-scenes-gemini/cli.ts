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
import * as dotenv from "dotenv";

// --- Types ---

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

// Scene output format
interface Scene {
  id: number;
  startTime: number;  // in seconds
  endTime: number;    // in seconds
  description: string;
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

function ensureDirectory(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getUploadInfoPath(audioPath: string): string {
  return audioPath + ".upload-info.json";
}

function getSceneOutputPath(audioPath: string): string {
  return path.join(path.dirname(audioPath), "scenes.json");
}

function getRawResponsePath(audioPath: string): string {
  return path.join(path.dirname(audioPath), "scenes.raw-response.txt");
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

function getChapterDuration(chapterDir: string): number {
  const durationPath = path.join(chapterDir, 'chapter.duration.json');
  if (!fs.existsSync(durationPath)) {
    throw new Error(`Chapter duration file not found: ${durationPath}`);
  }
  const durationData = JSON.parse(fs.readFileSync(durationPath, 'utf8'));
  return durationData.inSeconds;
}

function saveScenes(outputPath: string, scenes: Scene[]): void {
  ensureDirectory(path.dirname(outputPath));
  fs.writeFileSync(outputPath, JSON.stringify(scenes, null, 2), "utf8");
  console.log(`Scenes saved to: ${outputPath}`);
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

async function splitScenes(audioPath: string): Promise<Scene[]> {
  validateAudioFile(audioPath);
  const stats = fs.statSync(audioPath);
  console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log("Starting scene splitting with Gemini...");

  // Get chapter duration
  const chapterDir = path.dirname(audioPath);
  const duration = getChapterDuration(chapterDir);
  console.log(`Chapter duration: ${duration} seconds`);

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

      const infoPath = getUploadInfoPath(audioPath);
      fs.writeFileSync(infoPath, JSON.stringify(fileInfo, null, 2), "utf8");
      console.log(`Upload info saved to: ${infoPath}`);
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

    console.log(`Processing complete. Analyzing scenes...`);

    let timer = new ElapsedTimer();
    // Use Gemini model to analyze the audio for scenes
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-pro-exp-03-25",
    });
    const result = await model.generateContent([
      `
      Listen to this audiobook file and break it down into distinct scenes.

      Important: The total duration of this audio file is ${duration} seconds.
      
      For each scene, provide:
      1. Scene number (sequential)
      2. Start time (in seconds)
      3. End time (in seconds)
      4. Brief description of what happens in the scene
      
      Ensure all timestamps are accurate and never exceed ${duration} seconds.
      
      RESPONSE FORMAT:
      - You must respond with ONLY a valid JSON array
      - Do not include any explanation, markdown formatting, or additional text
      - Do not wrap the JSON in code blocks
      - Provide a clean, parseable JSON array that follows this exact structure:
      
      [
        {
          "id": 1,
          "startTime": 0,
          "endTime": 120,
          "description": "Introduction to main character"
        },
        {
          "id": 2,
          "startTime": 120,
          "endTime": 240,
          "description": "Conversation between characters"
        }
      ]
      
      The JSON must be properly formatted with double quotes around property names and string values.
      `,
      {
        fileData: {
          fileUri: uploadResult.file.uri,
          mimeType: uploadResult.file.mimeType,
        },
      },
    ]);
    timer.stop();

    console.log(`Analysis completed in ${timer.stop()} seconds`);
    
    const responseText = result.response.text();
    
    // Save the raw response to a file regardless of parsing success
    const rawResponsePath = getRawResponsePath(audioPath);
    fs.writeFileSync(rawResponsePath, responseText, "utf8");
    console.log(`Raw Gemini response saved to: ${rawResponsePath}`);
    
    // Try different methods to extract valid JSON from the response
    let jsonData: string | null = null;
    
    // Method 1: Look for array format with standard regex
    let jsonMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (jsonMatch) {
      jsonData = jsonMatch[0];
    }
    
    // Method 2: Look for JSON within code blocks
    if (!jsonData) {
      const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        // Remove any non-JSON text that might be in the code block
        const potentialJson = codeBlockMatch[1].trim();
        if (potentialJson.startsWith('[') && potentialJson.endsWith(']')) {
          jsonData = potentialJson;
        }
      }
    }
    
    // Method 3: Last resort - try to find anything that looks like a JSON array
    if (!jsonData) {
      const lastResortMatch = responseText.match(/\[\s*\{\s*"id"\s*:/);
      if (lastResortMatch) {
        // Try to find the closing bracket of the array
        const startIndex = lastResortMatch.index;
        let bracketCount = 0;
        let endIndex = -1;
        
        if (startIndex !== undefined) {
          for (let i = startIndex; i < responseText.length; i++) {
            if (responseText[i] === '[') bracketCount++;
            else if (responseText[i] === ']') {
              bracketCount--;
              if (bracketCount === 0) {
                endIndex = i + 1;
                break;
              }
            }
          }
          
          if (endIndex !== -1) {
            jsonData = responseText.substring(startIndex, endIndex);
          }
        }
      }
    }
    
    if (!jsonData) {
      console.error("Could not extract valid JSON from Gemini response. Check the raw response file for details.");
      throw new Error("Could not extract valid JSON from Gemini response");
    }
    
    try {
      const scenes = JSON.parse(jsonData) as Scene[];
      console.log(`Successfully extracted ${scenes.length} scenes`);
      return scenes;
    } catch (error) {
      console.error("Failed to parse scene JSON:", error);
      console.log("Review the raw response file to see what Gemini returned.");
      throw new Error("Failed to parse scene data from Gemini response");
    }
  } catch (error) {
    console.error("Error in scene analysis:", error);
    throw error;
  }
}

async function processChapter(chapterDir: string): Promise<void> {
  console.log(`Processing chapter: ${chapterDir}`);
  
  // Find the audio file
  const files = fs.readdirSync(chapterDir);
  const audioFile = files.find((f) => 
    [".mp3", ".wav", ".m4a", ".mp4"].includes(path.extname(f).toLowerCase())
  );
  
  if (!audioFile) {
    throw new Error(`No audio file found in chapter directory: ${chapterDir}`);
  }
  
  const audioPath = path.join(chapterDir, audioFile);
  const outputPath = getSceneOutputPath(audioPath);
  
  // Check if scenes already exist
  if (fs.existsSync(outputPath)) {
    console.log(`Scenes file already exists at ${outputPath}, overwriting...`);
  }
  
  // Split the audio into scenes
  const scenes = await splitScenes(audioPath);
  
  // Save the scenes
  saveScenes(outputPath, scenes);
}

async function main() {
  const program = new Command();

  program
    .description("Split audio files into scenes using Gemini AI")
    .requiredOption(FLAGS.book.flag, FLAGS.book.description)
    .requiredOption(FLAGS.chapters.flag, FLAGS.chapters.description)
    .option(FLAGS.chunks.flag, FLAGS.chunks.description)
    .action(async (options) => {
      const timer = new CliTimer();

      try {
        const bookDir = parseBookDir(options.book);
        let chapterDirs: string[] = [];

        if (options.chapters) {
          chapterDirs = parseChapterDirs(bookDir, options.chapters);
        } else if (options.chunks) {
          // Get all chapter directories
          const allChapterDirs = fs
            .readdirSync(bookDir)
            .filter((d) => d.match(/^\d+$/))
            .map((d) => path.join(bookDir, d));
          
          // Get all chapter indices
          const allChapterIndices = allChapterDirs.map(dir => 
            parseInt(path.basename(dir))
          );
          
          // Parse the selected indices
          const selectedIndices = parseIds(allChapterIndices, options.chunks);
          
          // Filter chapter directories by the selected indices
          chapterDirs = allChapterDirs.filter((dir) => {
            const chapterNum = parseInt(path.basename(dir));
            return selectedIndices.includes(chapterNum);
          });
        } else {
          // Process all chapter directories
          chapterDirs = fs
            .readdirSync(bookDir)
            .filter((d) => d.match(/^\d+$/))
            .map((d) => path.join(bookDir, d));
        }

        console.log(`Processing ${chapterDirs.length} chapter(s)`);

        for (const chapterDir of chapterDirs) {
          await processChapter(chapterDir);
        }

        timer.stop();
        console.log(`All done!`);
      } catch (error) {
        console.error("Error:", error);
        process.exit(1);
      }
    });

  program.parse(process.argv);
}

main(); 