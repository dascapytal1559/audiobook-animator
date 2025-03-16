import * as fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { CropConfig } from './types';
import { ensureDirectory } from '../common/paths';
import { parseIds } from '../common/flags';
import { Shots } from '../gen-shots/types';

interface CropVariationParams {
  inputPath: string;
  outputPath: string;
  variationId: number;
}

/**
 * Get all valid shot IDs from shots.json
 */
function getAllShotIds(book: string, chapter: string): number[] {
  const shotsPath = path.join('audiobooks', book, chapter, 'shots.json');
  if (!fs.existsSync(shotsPath)) {
    throw new Error(`shots.json not found at: ${shotsPath}`);
  }

  const shotsData: Shots = JSON.parse(fs.readFileSync(shotsPath, 'utf-8'));
  return shotsData.shots.map(shot => shot.shotId).sort((a, b) => a - b);
}

/**
 * Load or create crop config, ensuring all specified shot IDs have a variation value
 */
async function loadOrUpdateCropConfig(visualDir: string, shotIds: number[]): Promise<CropConfig> {
  const croppedImagesDir = path.join(visualDir, 'cropped-images');
  ensureDirectory(croppedImagesDir);
  const configPath = path.join(croppedImagesDir, 'crop-config.json');

  let config: CropConfig;

  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } else {
    config = { variations: {} };
  }

  // Add any missing shot IDs with default variation 1
  let hasChanges = false;
  for (const shotId of shotIds) {
    if (!(shotId.toString() in config.variations)) {
      config.variations[shotId] = 1;
      hasChanges = true;
      console.log(`Added shot ${shotId} to crop-config.json with default variation 1`);
    }
  }

  // Save if we made any changes
  if (hasChanges || !fs.existsSync(configPath)) {
    await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
    console.log('Updated crop-config.json with new shots');
  }

  return config;
}

/**
 * Crops a specific variation (1-4) from a 4-variation image
 */
async function cropVariation({
  inputPath,
  outputPath,
  variationId
}: CropVariationParams): Promise<void> {
  if (variationId < 1 || variationId > 4) {
    throw new Error(`Invalid variation ID: ${variationId}. Must be 1-4.`);
  }

  // Get dimensions of input image
  const metadata = await sharp(inputPath).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('Failed to get image dimensions');
  }

  // Calculate coordinates for the variation
  const halfWidth = Math.floor(metadata.width / 2);
  const halfHeight = Math.floor(metadata.height / 2);
  let left = 0;
  let top = 0;

  switch (variationId) {
    case 1: // Top-left
      left = 0;
      top = 0;
      break;
    case 2: // Top-right
      left = halfWidth;
      top = 0;
      break;
    case 3: // Bottom-left
      left = 0;
      top = halfHeight;
      break;
    case 4: // Bottom-right
      left = halfWidth;
      top = halfHeight;
      break;
  }

  // Create output directory if it doesn't exist
  const outputDir = path.dirname(outputPath);
  ensureDirectory(outputDir);

  // Extract and save the variation
  await sharp(inputPath)
    .extract({
      left,
      top,
      width: halfWidth,
      height: halfHeight,
    })
    .toFile(outputPath);

  console.log(`Cropped variation ${variationId} to: ${outputPath}`);
}

async function cropImagesFromConfig(visualDir: string, shotIds: number[]): Promise<void> {
  // Load or update crop config
  const config = await loadOrUpdateCropConfig(visualDir, shotIds);

  // Process each shot in the config
  for (const shotId of shotIds) {
    const variationId = config.variations[shotId];
    if (!variationId) {
      console.warn(`Warning: No variation specified for shot ${shotId}, skipping...`);
      continue;
    }

    const parsedVariationId = Number(variationId);
    if (isNaN(parsedVariationId) || parsedVariationId < 1 || parsedVariationId > 4) {
      console.warn(`Warning: Invalid variation ID for shot ${shotId}: ${variationId}. Must be 1-4.`);
      continue;
    }

    const inputPath = path.join(visualDir, 'images4', `shot${shotId}.png`);
    if (!fs.existsSync(inputPath)) {
      console.warn(`Warning: Source image not found for shot ${shotId}: ${inputPath}`);
      continue;
    }

    const outputPath = path.join(visualDir, 'cropped-images', `shot${shotId}.png`);
    await cropVariation({
      inputPath,
      outputPath,
      variationId: parsedVariationId
    });
  }
}

/**
 * Main function to crop images based on configuration
 */
export async function cropImages(
  book: string,
  chapter: string,
  visual: string,
  shotIdsInput?: string
): Promise<void> {
  try {
    // Setup visual directory path
    const visualDir = path.join('audiobooks', book, chapter, visual);
    ensureDirectory(visualDir);

    // Get all valid shot IDs and parse user input
    const allIds = getAllShotIds(book, chapter);
    const shotIds = parseIds(allIds, shotIdsInput);

    // Crop images based on config
    await cropImagesFromConfig(visualDir, shotIds);
  } catch (error) {
    throw error;
  }
}
