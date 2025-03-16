import * as fs from "fs";
import * as path from "path";
import { Shot, Shots } from "../gen-shots/types";
import { createPrompt } from "./prompt";
import OpenAI from "openai";
import { parseIds } from "../common/flags";

export async function generatePrompt(shot: Shot): Promise<string> {
  const openai = new OpenAI();
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    try {
      console.log(`Generating prompt for shot ${shot.shotId} (attempt ${attempts + 1}/${maxAttempts})...`);
      const completion = await openai.chat.completions.create(createPrompt(shot));
      
      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error('No content in OpenAI response');
      }
      
      return content.trim();
    } catch (error) {
      attempts++;
      if (attempts === maxAttempts) {
        console.error(`All ${maxAttempts} attempts failed for shot ${shot.shotId}`);
        throw error;
      }
      console.error(`Attempt ${attempts} failed:`, error instanceof Error ? error.message : 'Unknown error');
      console.log(`Retrying in 5 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  throw new Error('Failed to generate prompt after all attempts');
}

/**
 * Generate image prompts and store in imgprompts.json
 */
export async function generateImagePrompts(
  book: string,
  chapter: string,
  director: string,
  shotIdsInput?: string
): Promise<void> {
  const directorDir = path.join('audiobooks', book, chapter, director);
  if (!fs.existsSync(directorDir)) {
    throw new Error(`Director directory not found: ${directorDir}`);
  }

  const shotsPath = path.join(directorDir, 'shots.json');
  const promptsPath = path.join(directorDir, 'imgprompts.json');

  // Load shots data
  console.log(`Processing shots from: ${shotsPath}`);
  const shotsData: Shots = JSON.parse(fs.readFileSync(shotsPath, 'utf-8'));

  // Load existing prompts if any
  let prompts: Record<string, string> = {};
  try {
    prompts = JSON.parse(fs.readFileSync(promptsPath, 'utf-8'));
    console.log('Successfully loaded existing prompts');
  } catch (error) {
    console.log('No existing prompts found, creating new file');
  }

  // Get all valid shot IDs and parse user input
  const allIds = shotsData.shots.map(shot => shot.shotId);
  const shotIds = parseIds(allIds, shotIdsInput);

  // Filter shots if specific IDs provided
  const shotsToProcess = shotsData.shots.filter(shot => shotIds.includes(shot.shotId));

  if (shotsToProcess.length === 0) {
    throw new Error('No matching shots found for the provided shot IDs');
  }

  console.log("Generating prompts for shots...");
  
  // Generate prompts concurrently
  const tasks = shotsToProcess.map(async (shot) => {
    try {
      console.log(`\nProcessing shot ${shot.shotId}: ${shot.title}...`);
      const generatedPrompt = await generatePrompt(shot);
      console.log(`Generated shot ${shot.shotId}`);

      // Store prompt in prompts object
      prompts[shot.shotId.toString()] = generatedPrompt;
    } catch (error) {
      console.error(`Error processing shot ${shot.shotId}:`, error instanceof Error ? error.message : "Unknown error");
    }
  });

  // Wait for all prompts to be generated
  await Promise.all(tasks);

  // Save updated prompts data
  fs.writeFileSync(promptsPath, JSON.stringify(prompts, null, 2));
  console.log(`✓ Updated imgprompts.json with new prompts`);
}
