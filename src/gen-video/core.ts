import * as fs from 'fs';
import * as path from 'path';
import { Shots } from '../gen-shots/types';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import ProgressBar from 'progress';
import { ensureDirectory } from '../common/paths';
import { parseIds } from '../common/flags';
import { VideoConfig, VideoSegment, VideoOptions } from './types';

const execAsync = promisify(exec);

// Default video configuration
const DEFAULT_CONFIG: VideoConfig = {
  fps: 24,
  width: 1472,
  height: 800
};

/**
 * Get shot timing information from shots.json
 */
function getShotTimings(book: string, chapter: string, director: string, shotIds: number[]): VideoSegment {
  const shotsPath = path.join('audiobooks', book, chapter, director, 'shots.json');
  if (!fs.existsSync(shotsPath)) {
    throw new Error(`shots.json not found at: ${shotsPath}`);
  }

  const shotsData: Shots = JSON.parse(fs.readFileSync(shotsPath, 'utf-8'));
  const validShots = shotsData.shots.filter(shot => shotIds.includes(shot.shotId));

  if (validShots.length === 0) {
    throw new Error('No valid shots found for the specified IDs');
  }

  // Sort shots by start time
  validShots.sort((a, b) => a.start - b.start);

  return {
    startTime: validShots[0].start,
    endTime: validShots[validShots.length - 1].end,
    duration: validShots[validShots.length - 1].end - validShots[0].start,
    shotIds: validShots.map(shot => shot.shotId)
  };
}

/**
 * Create a trimmed audio file for the specified time range
 */
async function createTrimmedAudio(
  audioPath: string,
  startTime: number,
  duration: number,
  outputPath: string
): Promise<void> {
  console.log(`Trimming audio from ${startTime}s to ${startTime + duration}s...`);
  await execAsync(`ffmpeg -y -i ${JSON.stringify(audioPath)} -ss ${startTime} -t ${duration} ${JSON.stringify(outputPath)}`);
}

/**
 * Load shots with effects if available
 */
function loadShotsWithEffects(book: string, chapter: string, director: string): Shots {
  const shotsPath = path.join('audiobooks', book, chapter, director, 'shots.json');
  const effectsPath = path.join('audiobooks', book, chapter, director, 'shots.effects.json');

  if (!fs.existsSync(shotsPath)) {
    throw new Error(`shots.json not found at: ${shotsPath}`);
  }

  // Try to load shots with effects first
  if (fs.existsSync(effectsPath)) {
    console.log('Found shots.effects.json, using enhanced shots with FFmpeg effects');
    return JSON.parse(fs.readFileSync(effectsPath, 'utf-8'));
  }

  console.log('No shots.effects.json found, using base shots without effects');
  return JSON.parse(fs.readFileSync(shotsPath, 'utf-8'));
}

/**
 * Generate ffmpeg filter complex string for a shot
 */
function generateFilterComplex(shotId: number, shot: any, inputIndex: number): string {
  const filters = [];
  
  // Add base input label
  filters.push(`[0:v]`);

  // Add FFmpeg effects if available
  if (shot.ffmpegEffects) {
    // Replace duration placeholder with actual duration
    const effectWithDuration = shot.ffmpegEffects.replace(
      /d=duration\*24/,
      `d=${Math.ceil(shot.duration * DEFAULT_CONFIG.fps)}`
    );
    
    // Ensure the zoompan filter has the correct output size
    const zoompanEffect = effectWithDuration.replace(
      /s=\d+x\d+/,
      `s=${DEFAULT_CONFIG.width}x${DEFAULT_CONFIG.height}`
    );
    
    // Add the effect
    filters.push(zoompanEffect);
  }

  // Add output label
  filters.push(`[v${shotId}]`);

  return filters.join('');
}

/**
 * Generate ffmpeg input file for the image sequence
 */
function createInputFile(
  shots: number[],
  imagesDir: string,
  shotsData: Shots,
  inputFilePath: string,
  filterFilePath: string
): void {
  console.log('Generating ffmpeg input and filter files...');
  const inputFileLines: string[] = [];
  const filterComplexLines: string[] = [];
  const concatParts: string[] = [];

  shots.forEach((shotId, index) => {
    const shot = shotsData.shots.find(s => s.shotId === shotId);
    if (!shot) throw new Error(`Shot ${shotId} not found in shots data`);

    // Add input file entry
    const imagePath = path.resolve(path.join(imagesDir, `shot${shotId}.png`));
    const escapedPath = imagePath.replace(/'/g, "'\\''");
    inputFileLines.push(`file '${escapedPath}'`);
    inputFileLines.push(`duration ${shot.duration}`);

    // Add filter complex for this shot if it has effects
    if (shot.ffmpegEffects && shot.ffmpegEffects.includes('zoompan')) {
      filterComplexLines.push(generateFilterComplex(shotId, shot, index));
      concatParts.push(`[v${shotId}]`);
    } else {
      concatParts.push(`[0:v]`);
    }
  });

  // Add the concat filter at the end if we have any effects
  if (filterComplexLines.length > 0) {
    filterComplexLines.push(`${concatParts.join('')}concat=n=${shots.length}:v=1:a=0[outv]`);
  }

  // Write the input file
  fs.writeFileSync(inputFilePath, inputFileLines.join('\n'));

  // Write the filter complex file if we have any effects
  if (filterComplexLines.length > 0) {
    fs.writeFileSync(filterFilePath, filterComplexLines.join(';\n'));
  }
}

/**
 * Main function to generate video
 */
export async function generateVideo(
  book: string,
  chapter: string,
  director: string,
  visual: string,
  shotIdsInput?: string,
  options: Partial<VideoOptions> = {}
): Promise<void> {
  try {
    // Setup paths
    const chapterDir = path.join('audiobooks', book, chapter);
    const directorDir = path.join(chapterDir, director);
    const visualDir = path.join(directorDir, visual);
    const audioPath = path.join(chapterDir, `${chapter}.mp3`);

    // Validate audio path
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    // Load shots data (with effects if available)
    const shotsData = loadShotsWithEffects(book, chapter, director);
    const allIds = shotsData.shots.map(shot => shot.shotId);
    const shotIds = parseIds(allIds, shotIdsInput);

    // Get timing information for the selected shots
    const timing = getShotTimings(book, chapter, director, shotIds);

    // Setup working directory
    const tmpDir = path.join(visualDir, 'tmp');
    ensureDirectory(tmpDir);

    // Create trimmed audio if needed
    const audioInputPath = shotIdsInput
      ? path.join(tmpDir, 'trimmed_audio.mp3')
      : audioPath;

    if (shotIdsInput) {
      await createTrimmedAudio(audioPath, timing.startTime, timing.duration, audioInputPath);
    }

    // Determine images directory
    const imagesDir = path.join(visualDir, options.useUpscaledImages ? 'upscaled' : 'cropped-images');
    if (!fs.existsSync(imagesDir)) {
      throw new Error(`Images directory not found: ${imagesDir}`);
    }

    // Validate all required images exist
    const missingImages = timing.shotIds.filter(shotId => {
      return !fs.existsSync(path.join(imagesDir, `shot${shotId}.png`));
    });
    if (missingImages.length > 0) {
      throw new Error(`Missing images for shots: ${missingImages.join(', ')}`);
    }

    // Create input and filter files for ffmpeg
    const inputFilePath = path.join(tmpDir, 'input.txt');
    const filterFilePath = path.join(tmpDir, 'filter.txt');
    createInputFile(timing.shotIds, imagesDir, shotsData, inputFilePath, filterFilePath);

    // Setup progress bar
    const bar = new ProgressBar('Generating video [:bar] :percent :etas', {
      complete: '=',
      incomplete: ' ',
      width: 50,
      total: timing.duration
    });

    // Build ffmpeg command
    const firstShotId = timing.shotIds[0];
    const lastShotId = timing.shotIds[timing.shotIds.length - 1];
    const outputPath = path.join(visualDir, `shots-${firstShotId}-${lastShotId}.mp4`);
    const resolution = options.resolution || `${DEFAULT_CONFIG.width}x${DEFAULT_CONFIG.height}`;
    const fps = options.fps || DEFAULT_CONFIG.fps;

    // Base arguments
    const args = [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', inputFilePath,
      '-i', audioInputPath
    ];

    // Add filter_complex if we have effects
    if (fs.existsSync(filterFilePath)) {
      const filterComplex = fs.readFileSync(filterFilePath, 'utf-8');
      args.push('-filter_complex', filterComplex);
      args.push('-map', '[outv]');
      args.push('-map', '1:a');
    } else {
      args.push('-map', '0:v');
      args.push('-map', '1:a');
    }

    // Add encoding parameters
    args.push(
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-r', fps.toString(),
      '-s', resolution,
      '-c:a', 'aac',
      '-shortest',
      '-progress', 'pipe:2',
      outputPath
    );

    // Run ffmpeg
    console.log('Generating video...');
    console.log('FFmpeg command:', ['ffmpeg', ...args].join(' '));
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', args);
      let lastTime = 0;

      ffmpeg.stderr.on('data', (data) => {
        const output = data.toString();
        console.log('FFmpeg output:', output);
        const timeMatch = output.match(/time=(\d+):(\d+):(\d+.\d+)/);
        if (timeMatch) {
          const [_, hours, minutes, seconds] = timeMatch;
          const currentTime = parseFloat(hours) * 3600 + parseFloat(minutes) * 60 + parseFloat(seconds);
          const progress = currentTime - lastTime;
          lastTime = currentTime;
          bar.tick(progress);
        }
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          bar.terminate();
          console.log(`\nVideo generated successfully: ${outputPath}`);
          resolve();
        } else {
          reject(new Error(`ffmpeg process exited with code ${code}`));
        }
      });

      ffmpeg.on('error', reject);
    });

    // Don't cleanup tmp directory for debugging
    // fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (error) {
    throw error;
  }
} 
