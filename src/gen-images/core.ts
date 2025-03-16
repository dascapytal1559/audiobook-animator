import { Midjourney } from "midjourney";
import path from "path";
import fs from "fs/promises";
import { config } from "dotenv";
import { ImageData, Images } from "./types";
import { Shot, Shots } from "../gen-shots/types";
import { parseIds } from "../common/flags";
import { ensureDirectory } from "../common/paths";
import { generateMemorable } from "../common/names";

// Load environment variables from .env file
config();

/**
 * Load shots data from shots.json file
 */
async function loadShots(book: string, chapter: string, director: string): Promise<Shot[]> {
  const shotsPath = path.join('audiobooks', book, chapter, director, 'shots.json');
  
  try {
    const content = await fs.readFile(shotsPath, 'utf-8');
    const shotsData: Shots = JSON.parse(content);
    return shotsData.shots;
  } catch (error) {
    throw new Error(`Failed to read shots from ${shotsPath}: ${error}`);
  }
}

/**
 * Load prompts from imgprompts.json file
 */
async function loadPrompts(book: string, chapter: string, director: string): Promise<Record<string, string>> {
  const promptsPath = path.join('audiobooks', book, chapter, director, 'imgprompts.json');
  
  try {
    const content = await fs.readFile(promptsPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to read prompts from ${promptsPath}: ${error}`);
  }
}

/**
 * Get or create a visual directory with an optional name
 */
function getVisualDir(book: string, chapter: string, director: string, visualName?: string): string {
  if (!visualName) {
    visualName = generateMemorable('visual-');
  }
  
  const visualDir = path.join('audiobooks', book, chapter, director, visualName);
  ensureDirectory(visualDir);
  return visualDir;
}

/**
 * Wrap a promise with a timeout
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs/1000} seconds: ${operation}`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Generate images for shots using Midjourney
 */
export async function generateImages(
  book: string,
  chapter: string,
  director: string,
  shotIdsInput: string | undefined,
  visualName: string | undefined,
  mjParams: string = ''
) {
  // Load shots and prompts
  const [allShots, prompts] = await Promise.all([
    loadShots(book, chapter, director),
    loadPrompts(book, chapter, director)
  ]);

  // Get all valid shot IDs and parse user input
  const allIds = allShots.map(shot => shot.shotId);
  const shotIds = parseIds(allIds, shotIdsInput);

  // Filter shots based on parsed IDs
  const shotsToProcess = allShots.filter(shot => shotIds.includes(shot.shotId));

  if (shotsToProcess.length === 0) {
    throw new Error('No matching shots found for the provided shot IDs');
  }

  // Get or create visual directory
  const visualDir = getVisualDir(book, chapter, director, visualName);
  console.log('Visual directory:', visualDir);

  // Validate Midjourney credentials
  if (!process.env.DISCORD_SERVER_ID || !process.env.DISCORD_CHANNEL_ID || !process.env.DISCORD_TOKEN) {
    throw new Error("Missing required Midjourney credentials in environment variables");
  }

  // Initialize Midjourney client
  const client = new Midjourney({
    ServerId: process.env.DISCORD_SERVER_ID,
    ChannelId: process.env.DISCORD_CHANNEL_ID,
    SalaiToken: process.env.DISCORD_TOKEN,
    Debug: true,
    Ws: true,
  });

  const imagesDir = path.join(visualDir, "images4");
  // Ensure images directory exists
  await fs.mkdir(imagesDir, { recursive: true });

  // Initialize or load existing images data
  const imagesJsonPath = path.join(imagesDir, "images.json");
  let images: Images = {};
  try {
    const existingImages = await fs.readFile(imagesJsonPath, "utf-8");
    console.log("Successfully read: " + imagesJsonPath);
    images = JSON.parse(existingImages);
  } catch (error) {
    // It's okay if the file doesn't exist yet
  }

  // Track failed shots
  const failedShots: string[] = [];

  // Process shots in batches of 3
  const batchSize = 3;
  for (let i = 0; i < shotsToProcess.length; i += batchSize) {
    const batch = shotsToProcess.slice(i, i + batchSize);
    console.log(`\nProcessing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(shotsToProcess.length/batchSize)}: shots ${batch.map(s => s.shotId).join(", ")}`);

    try {
      // Sleep function for staggered delays
      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      // Process batch concurrently with staggered starts
      const batchImageDatas = await Promise.all(
        batch.map(async (shot, index): Promise<ImageData | null> => {
          const prompt = prompts[shot.shotId];
          if (!prompt) {
            console.log(`No prompt found for shot ${shot.shotId}, skipping...`);
            return null;
          }

          const fullPrompt = prompt + " --ar 37:20 --q 2 --style raw --v 6.1 " + mjParams;

          // Stagger requests: i=0 no delay, i=1 2s delay, i=2 4s delay
          if (index > 0) {
            const delay = index * 3000;
            await sleep(delay);
          }

          try {
            console.log(`Generating image for shot ${shot.shotId}...`);

            // Generate the image with timeout
            const result = await withTimeout(
              client.Imagine(fullPrompt),
              120000, // 2 minutes
              `Image generation for shot ${shot.shotId}`
            );

            if (!result?.uri) {
              console.error(`Failed to generate image for shot ${shot.shotId}`);
              return null;
            }

            // Download and save the image locally
            const imageExt = path.extname(new URL(result.uri).pathname) || ".png";
            const localPath = path.join(imagesDir, `shot${shot.shotId}${imageExt}`);
            console.log(`Downloading image for shot ${shot.shotId} to: ${localPath}`);

            // Download image
            const response = await fetch(result.uri);
            const buffer = await response.arrayBuffer();
            await fs.writeFile(localPath, Buffer.from(buffer));
            console.log(`Successfully saved image for shot ${shot.shotId}`);

            return {
              shotId: shot.shotId,
              prompt: fullPrompt,
              url: result.uri,
              width: result.width || 0,
              height: result.height || 0,
            };
          } catch (error: any) {
            const errorMessage = error?.response?.status === 429
              ? "Rate limit"
              : error?.message || "Unknown error";
            const failInfo = `Shot ${shot.shotId}: ${errorMessage} (prompt: ${fullPrompt})`;
            failedShots.push(failInfo);
            console.error(`Failed: ${failInfo}`);
            return null;
          }
        })
      );

      // Check if entire batch failed
      if (batchImageDatas.every(data => data === null)) {
        console.error('\nEntire batch failed - stopping further processing');
        console.error('Failed shots summary:');
        failedShots.forEach((failure) => console.error(failure));
        return { images, failedShots };
      }

      // Update images data with successful results
      for (const data of batchImageDatas) {
        if (data) {
          images[data.shotId.toString()] = data;
        }
      }

      // Save the complete updated record after each batch
      await fs.writeFile(imagesJsonPath, JSON.stringify(images, null, 2));
      console.log(`Successfully updated: ${imagesJsonPath}`);
    } catch (error) {
      console.error(`Error processing batch:`, error);
    }
  }

  // Log summary of failed shots
  if (failedShots.length > 0) {
    console.log("\nFailed shots summary:");
    failedShots.forEach((failure) => console.log(failure));
  }

  return { images, failedShots };
}