import { OpenAI } from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { Shot, Shots } from '../gen-shots/types';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { zodResponseFormat } from 'openai/helpers/zod';
import { FLAGS } from '../common/flags';
import { Command } from 'commander';

const openai = new OpenAI();
const BATCH_SIZE = 10;

// Schema for the FFmpeg effects response
const EffectSchema = z.object({
  effects: z.array(z.object({
    shotId: z.number(),
    ffmpegEffects: z.string().describe('FFmpeg filter chain for the shot'),
    explanation: z.string().describe('Explanation of why these effects were chosen')
  }))
}).describe('A list of FFmpeg effects for each shot');

type Effect = {
  shotId: number;
  ffmpegEffects: string;
  explanation: string;
};

/**
 * Create a prompt for OpenAI to generate FFmpeg effects
 */
function createPrompt(shots: Shot[]) {
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `You are an expert cinematographer and video editor with deep knowledge of FFmpeg filters and effects.
Your task is to analyze each shot's description and suggest appropriate FFmpeg zoom and pan effects to create subtle motion.

Key principles:
1. Start with very subtle movements in early shots
2. Gradually increase the intensity of motion as the story progresses
3. Match the movement to the scene's emotional tone
4. Keep effects simple and clean

Use only these FFmpeg filters:
- zoompan: Create subtle zoom and pan effects
  Format: zoompan=z='if(eq(on,1),1,zoom+0.0001)':x='iw/2':y='ih/2':d=duration*24:s=1472x800

Parameters to vary:
- z: Zoom expression (use if(eq(on,1),1,zoom+speed) where speed starts very subtle like 0.0001)
- x,y: Pan position (use expressions with iw/ih for frame size)
- d: Duration in frames (must be shot duration in seconds * fps)
- s: Output size (must be 1472x800)

Example effects:
Early shot (subtle): "zoompan=z='if(eq(on,1),1,zoom+0.0001)':x='iw/2':y='ih/2':d=duration*24:s=1472x800"
Later shot (more motion): "zoompan=z='if(eq(on,1),1,zoom+0.0002)':x='iw/2-(iw*0.1*pow(1-on/n,2))':y='ih/2':d=duration*24:s=1472x800"

For each shot, provide:
1. A simple zoompan filter with appropriate intensity
2. A brief explanation of why the movement enhances the scene

Note: The 'duration' in the d parameter will be replaced with the actual shot duration in seconds.`
    },
    {
      role: "user",
      content: JSON.stringify(shots, null, 2)
    }
  ];

  return {
    model: "o3-mini",
    response_format: zodResponseFormat(EffectSchema, "ffmpeg_effects"),
    messages
  };
}

/**
 * Process a batch of shots and get their effects
 */
async function processShots(shots: Shot[], batchIndex: number): Promise<Effect[]> {
  const startId = shots[0].shotId;
  const endId = shots[shots.length - 1].shotId;
  console.log(`Processing batch ${batchIndex + 1} with shots ${startId} to ${endId}...`);
  
  try {
    const completion = await openai.beta.chat.completions.parse(createPrompt(shots));
    const effects = completion.choices[0].message.parsed as { effects: Effect[] };
    console.log(`✓ Completed batch ${batchIndex + 1} (shots ${startId}-${endId})`);
    return effects.effects;
  } catch (error) {
    console.error(`× Failed batch ${batchIndex + 1} (shots ${startId}-${endId}):`, error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

/**
 * Process a shots.json file and add FFmpeg effects
 */
async function addShotEffects(shotsPath: string): Promise<void> {
  // Read shots file
  console.log(`Reading shots from: ${shotsPath}`);
  const shotsData: Shots = JSON.parse(fs.readFileSync(shotsPath, 'utf-8'));

  // Split shots into batches
  const batches: Shot[][] = [];
  for (let i = 0; i < shotsData.shots.length; i += BATCH_SIZE) {
    batches.push(shotsData.shots.slice(i, i + BATCH_SIZE));
  }

  console.log(`Processing ${shotsData.shots.length} shots in ${batches.length} batches of ${BATCH_SIZE}...\n`);

  // Process all batches in parallel
  const batchPromises = batches.map((batch, index) => processShots(batch, index));
  const results = await Promise.all(batchPromises);
  const allEffects = results.flat();
  
  // Add effects to shots data
  const enhancedShots = shotsData.shots.map(shot => {
    const effectData = allEffects.find(e => e.shotId === shot.shotId);
    if (!effectData) {
      throw new Error(`No effects generated for shot ${shot.shotId}`);
    }
    return {
      ...shot,
      ffmpegEffects: effectData.ffmpegEffects,
      effectsExplanation: effectData.explanation
    };
  });

  // Save enhanced shots
  const outputPath = path.join(path.dirname(shotsPath), 'shots.effects.json');
  const enhancedShotsData = {
    ...shotsData,
    shots: enhancedShots
  };

  fs.writeFileSync(outputPath, JSON.stringify(enhancedShotsData, null, 2));
  console.log(`\nSaved enhanced shots with effects to: ${outputPath}`);
}

async function main() {
  const program = new Command();

  program
    .description('Add FFmpeg effects to shots based on AI cinematographer suggestions')
    .requiredOption(FLAGS.book.flag, FLAGS.book.description)
    .requiredOption(FLAGS.chapter.flag, FLAGS.chapter.description)
    .requiredOption(FLAGS.director.flag, FLAGS.director.description)
    .action(async (options) => {
      try {
        const shotsPath = path.join('audiobooks', options.book, options.chapter, options.director, 'shots.json');
        if (!fs.existsSync(shotsPath)) {
          throw new Error(`shots.json not found at: ${shotsPath}`);
        }

        await addShotEffects(shotsPath);
        process.exit(0);
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  await program.parseAsync(process.argv);
}

if (require.main === module) {
  main();
} 