import { Command } from 'commander';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { StabilityUpscaler } from './core';
import { CliTimer } from '../common/timer';
import { parseIds } from '../common/flags';
import { FLAGS } from '../common/flags';

dotenv.config();
console.log('Starting upscale-images script...');

async function main() {
  const timer = new CliTimer();
  timer.start();

  try {
    console.log('Setting up command line options...');
    const program = new Command();

    program
      .requiredOption(FLAGS.book.flag, FLAGS.book.description)
      .requiredOption(FLAGS.chapter.flag, FLAGS.chapter.description)
      .requiredOption(FLAGS.director.flag, FLAGS.director.description)
      .requiredOption(FLAGS.visual.flag, FLAGS.visual.description)
      .option(FLAGS.shotIds.flag, FLAGS.shotIds.description);

    program.parse();
    const options = program.opts();
    console.log('Parsed command line options:', options);

    const apiKey = process.env.STABILITY_API_KEY;
    if (!apiKey) {
      console.error('Error: STABILITY_API_KEY environment variable is not set');
      process.exit(1);
    }
    console.log('Found STABILITY_API_KEY in environment');

    // Get visual directory
    const visualDir = path.join('audiobooks', options.book, options.chapter, options.director, options.visual);
    console.log('Checking visual directory:', visualDir);
    if (!fs.existsSync(visualDir)) {
      console.error(`Error: Visual directory not found: ${visualDir}`);
      process.exit(1);
    }

    const imagesDir = path.join(visualDir, 'cropped-images');
    console.log('Checking cropped-images directory:', imagesDir);
    if (!fs.existsSync(imagesDir)) {
      console.error(`Error: Images directory not found: ${imagesDir}`);
      process.exit(1);
    }

    // Get shots path to validate shot IDs
    const shotsPath = path.join('audiobooks', options.book, options.chapter, options.director, 'shots.json');
    console.log('Checking shots.json path:', shotsPath);
    if (!fs.existsSync(shotsPath)) {
      console.error(`Error: shots.json not found: ${shotsPath}`);
      process.exit(1);
    }

    // Get all shot IDs from the cropped-images directory
    console.log('Reading cropped-images directory...');
    const files = fs.readdirSync(imagesDir);
    console.log('Found files:', files);
    
    const allIds = files
      .filter(f => f.startsWith('shot') && f.endsWith('.png'))
      .map(f => parseInt(f.replace('shot', '').replace('.png', '')))
      .sort((a, b) => a - b);
    console.log('Found shot IDs:', allIds);

    if (allIds.length === 0) {
      console.error('No shot images found in the cropped-images directory');
      process.exit(1);
    }

    // Parse shot IDs if provided
    let shotIds: number[] | undefined;
    if (options.shots) {
      console.log('Parsing provided shot IDs:', options.shots);
      try {
        shotIds = parseIds(allIds, options.shots);
        console.log(`Will process shots: ${shotIds.join(', ')}`);
      } catch (error) {
        console.error('Error parsing shot IDs:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    } else {
      shotIds = allIds;
      console.log('No specific shots provided, will process all shots:', shotIds);
    }

    console.log('Initializing Stability upscaler...');
    const upscaler = new StabilityUpscaler({ apiKey });

    // Create upscaled directory if it doesn't exist
    const upscaledDir = path.join(visualDir, 'upscaled');
    console.log('Creating upscaled directory:', upscaledDir);
    fs.mkdirSync(upscaledDir, { recursive: true });

    console.log(`\nUpscaling images to high resolution (4 megapixels)...`);

    let successCount = 0;
    let failureCount = 0;

    for (const shotId of shotIds) {
      const imagePath = path.join(visualDir, 'cropped-images', `shot${shotId}.png`);
      console.log(`\nProcessing shot ${shotId}...`);
      console.log('Image path:', imagePath);
      
      if (!fs.existsSync(imagePath)) {
        console.warn(`Warning: Image not found for shot ${shotId}, skipping...`);
        failureCount++;
        continue;
      }

      const upscaledPath = path.join(upscaledDir, `shot${shotId}.png`);
      console.log('Output path:', upscaledPath);

      try {
        console.log('Calling Stability API for upscaling...');
        const result = await upscaler.upscaleFromFile(imagePath, {
          prompt: 'an image',
          creativity: 0.2,  // Minimum creativity for most conservative upscale
          output_format: 'png'
        });

        if (result.success && result.data) {
          console.log(`Writing upscaled image for shot ${shotId}...`);
          fs.writeFileSync(upscaledPath, result.data);
          console.log(`✓ Successfully upscaled shot ${shotId}`);
          successCount++;
        } else {
          console.error(`✗ Failed to upscale shot ${shotId}: ${result.error}`);
          failureCount++;
        }
      } catch (error) {
        console.error(`✗ Error processing shot ${shotId}: ${error instanceof Error ? error.message : error}`);
        failureCount++;
      }
    }

    console.log('\nUpscaling complete!');
    console.log(`Results:`);
    console.log(`- Successfully upscaled: ${successCount}`);
    console.log(`- Failed: ${failureCount}`);
    console.log(`\nUpscaled images are saved in: ${upscaledDir}`);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    timer.stop();
  }
}

if (require.main === module) {
  console.log('Starting main execution...');
  main();
} 