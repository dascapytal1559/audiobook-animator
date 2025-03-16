import * as fs from 'fs';
import { OpenAI } from 'openai';
import * as path from 'path';
import { Transcript } from '../transcribe-audio/types';
import { ElapsedTimer } from '../common/timer';
import { ResponseSchema, createPrompt } from './prompt';
import { Sections } from './types';
import { ensureDirectory } from '../common/paths';
import { generateMemorable } from '../common/names';

const openai = new OpenAI();

/**
 * Process sections with text segments and timestamps
 */
function processSections(response: ReturnType<typeof ResponseSchema.parse>, segments: Transcript['segments']): Sections['sections'] {
  if (!segments) throw new Error('No segments found in transcript');

  return response.sections.map((parsed, index: number) => {
    const sectionSegments = segments.filter(seg => 
      seg.id >= parsed.startSegment && seg.id <= parsed.endSegment
    );
    
    if (sectionSegments.length === 0) {
      throw new Error(`No segments found for section "${parsed.title}" between segments ${parsed.startSegment} and ${parsed.endSegment}`);
    }

    const start = sectionSegments[0].start;
    const end = sectionSegments[sectionSegments.length - 1].end;
    const duration = end - start;
    
    return {
      title: parsed.title,
      description: parsed.description,
      start: start,
      end: end,
      duration: duration,
      startSegment: parsed.startSegment,
      endSegment: parsed.endSegment,
      segmentCount: sectionSegments.length,
      segments: sectionSegments,
    };
  });
}

/**
 * Validate and clean section boundaries against transcript segments
 */
function validateSectionBoundaries(response: ReturnType<typeof ResponseSchema.parse>, segments: Transcript['segments']) {
  if (!segments) throw new Error('No segments found in transcript');

  let lastEndSegment = segments[0].id - 1;
  for (const section of response.sections) {
    // Check continuity
    if (section.startSegment !== lastEndSegment + 1) {
      throw new Error(`Gap detected before section "${section.title}" (expected segment ${lastEndSegment + 1}, got ${section.startSegment})`);
    }
    lastEndSegment = section.endSegment;
  }

  // Check complete coverage
  if (lastEndSegment !== segments[segments.length - 1].id) {
    throw new Error(`Incomplete coverage: last section ended at segment ${lastEndSegment}, expected ${segments[segments.length - 1].id}`);
  }
}

/**
 * Get or use provided director name
 */
function getDirectorName(directorInput?: string): string {
  if (directorInput) return directorInput;
  return generateMemorable('director-');
}

/**
 * Split chapter transcript into sections
 */
export async function splitSections(
  book: string,
  chapter: string,
  directorInput?: string,
  targetSections: number = 10
): Promise<void> {
  const timer = new ElapsedTimer();
  timer.start();

  try {
    // Setup paths
    const chapterDir = path.join('audiobooks', book, chapter);
    const transcriptPath = path.join(chapterDir, 'transcript.json');

    // Validate transcript exists
    if (!fs.existsSync(transcriptPath)) {
      throw new Error(`Transcript not found at: ${transcriptPath}`);
    }

    // Get or create director directory
    const directorName = getDirectorName(directorInput);
    const directorDir = path.join(chapterDir, directorName);
    const sectionsDir = path.join(directorDir, 'sections');
    ensureDirectory(sectionsDir);

    // Read transcript
    const transcript = JSON.parse(fs.readFileSync(transcriptPath, 'utf-8'));
    console.log(`Processing transcript from: ${transcriptPath}`);

    // Get OpenAI response
    const completion = await openai.beta.chat.completions.parse(createPrompt(transcript, targetSections));
    const response = ResponseSchema.parse(completion.choices[0].message.parsed);

    // Save the raw response for debugging
    const responsePath = path.join(sectionsDir, 'sections.res.json');
    fs.writeFileSync(responsePath, JSON.stringify(response, null, 2));
    console.log(`Saved raw response to: ${responsePath}`);

    // Validate sections
    validateSectionBoundaries(response, transcript.segments);

    // Process sections
    const processedSections = processSections(response, transcript.segments);

    // Save the final processed sections
    const outputPath = path.join(sectionsDir, 'sections.json');
    const finalSections: Sections = {
      duration: transcript.duration,
      sectionCount: processedSections.length,
      sections: processedSections
    };

    fs.writeFileSync(outputPath, JSON.stringify(finalSections, null, 2));
    console.log(`Saved sections data to: ${outputPath}`);

    timer.stop();
  } catch (error) {
    throw error;
  }
}

