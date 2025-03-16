import { OpenAI } from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { ElapsedTimer } from '../common/timer';
import { Shot, Shots } from './types';
import { Sections } from '../split-sections/types';
import { ResponseSchema, createPrompt } from './prompt';
import { Segment } from '../transcribe-audio/types';

const openai = new OpenAI();

/**
 * Process segments into a shot with timing information
 */
function processShot(
  segments: Segment[],
  title: string,
  description: string,
  startSegment: number,
  endSegment: number
): Shot {
  const shotSegments = segments;
  const startTime = shotSegments[0].start;
  const endTime = shotSegments[shotSegments.length - 1].end;
  const duration = endTime - startTime;
  const segmentCount = shotSegments.length;
  const text = shotSegments.map(seg => seg.text).join(' ');

  return {
    shotId: 0,
    title,
    description,
    text,
    start: startTime,
    end: endTime,
    duration,
    startSegment,
    endSegment,
    segmentCount,
  };
}

/**
 * Validate shot boundaries to ensure continuity and complete coverage
 */
function validateShotBoundaries(shots: { startSegment: number; endSegment: number; title: string }[], startSegment: number, endSegment: number): void {
  let lastEndSegment = startSegment - 1;
  
  for (const shot of shots) {
    // Check continuity
    if (shot.startSegment !== lastEndSegment + 1) {
      throw new Error(`Gap detected before shot "${shot.title}" (expected segment ${lastEndSegment + 1}, got ${shot.startSegment})`);
    }
    lastEndSegment = shot.endSegment;
  }

  // Check complete coverage
  if (lastEndSegment !== endSegment) {
    throw new Error(`Incomplete coverage: last shot ended at segment ${lastEndSegment}, expected ${endSegment}`);
  }
}

/**
 * Generate shots using AI for a single section
 */
export async function genSectionShots(sectionsDirPath: string, sectionId: number): Promise<string> {
  // Read the sections file
  const sectionsPath = path.join(sectionsDirPath, 'sections.json');
  const sections: Sections = JSON.parse(fs.readFileSync(sectionsPath, 'utf-8'));
  const section = sections.sections[sectionId];
  if (!section) {
    throw new Error(`Section ${sectionId} not found`);
  }

  // Get OpenAI response
  console.log(`Extracting shots from section ${sectionId}: ${section.title}...`);
  const timer = new ElapsedTimer();
  timer.start();
  const completion = await openai.beta.chat.completions.parse(createPrompt(section, section.segments));
  timer.stop();
  console.log(''); // Add newline after timer output

  const response = ResponseSchema.parse(completion.choices[0].message.parsed);

  // Save the response
  const responsePath = path.join(sectionsDirPath, `section${sectionId}.shots.res.json`);
  fs.writeFileSync(responsePath, JSON.stringify(response, null, 2));
  console.log(`Saved response data to: ${responsePath}`);

  return responsePath;
}

/**
 * Clean and validate the response
 */
export async function cleanSectionShots(responsePath: string, sectionsDirPath: string, sectionId: number): Promise<string> {
  // Read the input files
  const sectionsPath = path.join(sectionsDirPath, 'sections.json');
  const sections: Sections = JSON.parse(fs.readFileSync(sectionsPath, 'utf-8'));
  const section = sections.sections[sectionId];
  if (!section) {
    throw new Error(`Section ${sectionId} not found`);
  }

  const response = ResponseSchema.parse(JSON.parse(fs.readFileSync(responsePath, 'utf-8')));

  // Validate shot boundaries
  validateShotBoundaries(response.shots, section.startSegment, section.endSegment);

  // Process shots with timing information
  const shots: Shot[] = [];
  let totalDuration = 0;
  let totalSegmentCount = 0;

  for (const shot of response.shots) {
    const shotSegments = section.segments.slice(
      shot.startSegment - section.startSegment,
      shot.endSegment - section.startSegment + 1
    );

    if (shotSegments.length === 0) {
      throw new Error(`No segments found for shot "${shot.title}" between segments ${shot.startSegment} and ${shot.endSegment}`);
    }

    const processedShot = processShot(
      shotSegments,
      shot.title,
      shot.description,
      shot.startSegment,
      shot.endSegment
    );

    shots.push(processedShot);
    totalDuration += processedShot.duration;
    totalSegmentCount += processedShot.segmentCount;
  }

  // Save the processed data
  const outputPath = path.join(sectionsDirPath, `section${sectionId}.shots.json`);
  const shotsData: Shots = {
    duration: totalDuration,
    segmentCount: totalSegmentCount,
    shotCount: shots.length,
    shots: shots.map((shot, index) => {
      shot.shotId = index;
      return shot;
    }),
  };

  fs.writeFileSync(outputPath, JSON.stringify(shotsData, null, 2));
  console.log(`Saved shots data to: ${outputPath}`);

  return outputPath;
}

/**
 * Combine all section shots into a single shots file
 */
export async function combineShots(book: string, chapter: string): Promise<void> {
  const sectionsDirPath = path.join('audiobooks', book, chapter, 'sections');
  console.log(`Reading sections from: ${path.join(sectionsDirPath, 'sections.json')}`);
  
  // Read sections to get section IDs
  const sections: Sections = JSON.parse(fs.readFileSync(path.join(sectionsDirPath, 'sections.json'), 'utf-8'));
  const sectionIds = Object.keys(sections.sections).map(id => parseInt(id));

  const allShots: Shot[] = [];
  let shotIdOffset = 0;
  let totalDuration = 0;
  let totalSegmentCount = 0;

  for (const sectionId of sectionIds) {
    const sectionShotsPath = path.join(sectionsDirPath, `section${sectionId}.shots.json`);
    if (!fs.existsSync(sectionShotsPath)) {
      throw new Error(`Section shots file not found: ${sectionShotsPath}`);
    }
    
    console.log(`Processing section ${sectionId}...`);
    const sectionShots: Shots = JSON.parse(fs.readFileSync(sectionShotsPath, 'utf-8'));
    
    allShots.push(...sectionShots.shots.map((shot, index)=>{
      shot.shotId = shotIdOffset + index;
      return shot;
    }));
    shotIdOffset += sectionShots.shots.length;
    totalDuration += sectionShots.duration;
    totalSegmentCount += sectionShots.segmentCount;
  }

  const combinedShots: Shots = {
    duration: totalDuration,
    segmentCount: totalSegmentCount,
    shotCount: allShots.length,
    shots: allShots,
  };

  const outputPath = path.join('audiobooks', book, chapter, 'shots.json');
  fs.writeFileSync(outputPath, JSON.stringify(combinedShots, null, 2));
  console.log(`\nCombined all shots into: ${outputPath}`);
}

/**
 * Orchestrator function that runs the full sequence to generate shots for a chapter
 */
export async function generateShots(book: string, chapter: string, sectionId?: string): Promise<void> {
  try {
    const sectionsDirPath = path.join('audiobooks', book, chapter, 'sections');
    console.log(`Processing sections from: ${path.join(sectionsDirPath, 'sections.json')}`);
    
    if (sectionId !== undefined) {
      console.log(`Processing section ${sectionId} into shots`);
      const secId = parseInt(sectionId)
      const responsePath = await genSectionShots(sectionsDirPath, secId);
      await cleanSectionShots(responsePath, sectionsDirPath, secId);
    } else {
      console.log('Processing all sections into shots');
      const sections: Sections = JSON.parse(fs.readFileSync(path.join(sectionsDirPath, 'sections.json'), 'utf-8'));
      const sectionIds = Object.keys(sections.sections).map(id => parseInt(id));
      
      let lastOutputPath = '';
      for (const id of sectionIds) {
        console.log(`\nProcessing section ${id}...`);
        const responsePath = await genSectionShots(sectionsDirPath, id);
        lastOutputPath = await cleanSectionShots( responsePath, sectionsDirPath, id);
      }
      
      if (!lastOutputPath) {
        throw new Error('No sections were processed');
      }

      // Combine all section shots into a single file
      await combineShots(book, chapter);
    }
  } catch (error) {
    console.error('Error processing sections into shots:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}
