import * as fs from 'fs';
import * as path from 'path';
import { Transcript } from '../transcribe-audio/types';
import { ElapsedTimer } from '../common/timer';
import { Sentence, Sentences } from './types';
import { ensureDirectory } from '../common/paths';
import { generateMemorable } from '../common/names';

/**
 * Check if the text ends with an ending punctuation
 */
function hasEndingPunctuation(text: string): boolean {
  return /[.!?]$/.test(text.trim());
}

/**
 * Process segments into sentences
 */
function processSegmentsIntoSentences(segments: Transcript['segments']): Sentence[] {
  if (!segments || segments.length === 0) {
    throw new Error('No segments found in transcript');
  }

  const sentences: Sentence[] = [];
  
  // First segment is always the chapter name
  sentences.push({
    text: segments[0].text.trim(),
    start: segments[0].start,
    end: segments[0].end,
    elapsed: segments[0].end - segments[0].start,
    startSegment: segments[0].id,
    endSegment: segments[0].id,
    segmentCount: 1,
    segments: [segments[0]]
  });

  let currentSentence: {
    text: string;
    startSegment: number;
    segments: typeof segments;
  } = {
    text: '',
    startSegment: -1,
    segments: []
  };

  // Start from the second segment (index 1)
  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i];
    
    // If we're starting a new sentence
    if (currentSentence.text === '') {
      currentSentence.text = segment.text.trim();
      currentSentence.startSegment = segment.id;
      currentSentence.segments = [segment];
    } else {
      // Append to current sentence
      currentSentence.text += segment.text;
      currentSentence.segments.push(segment);
    }

    // Check if the current segment ends the sentence
    if (hasEndingPunctuation(segment.text)) {
      const startSegment = currentSentence.startSegment;
      const endSegment = segment.id;
      const sentenceSegments = currentSentence.segments;
      
      // Create the sentence object
      sentences.push({
        text: currentSentence.text.trim(),
        start: sentenceSegments[0].start,
        end: segment.end,
        elapsed: segment.end - sentenceSegments[0].start,
        startSegment: startSegment,
        endSegment: endSegment,
        segmentCount: sentenceSegments.length,
        segments: sentenceSegments
      });

      // Reset for next sentence
      currentSentence = {
        text: '',
        startSegment: -1,
        segments: []
      };
    }
  }

  // If there's an incomplete sentence at the end, add it anyway
  if (currentSentence.text !== '') {
    const lastSegment = segments[segments.length - 1];
    sentences.push({
      text: currentSentence.text.trim(),
      start: currentSentence.segments[0].start,
      end: lastSegment.end,
      elapsed: lastSegment.end - currentSentence.segments[0].start,
      startSegment: currentSentence.startSegment,
      endSegment: lastSegment.id,
      segmentCount: currentSentence.segments.length,
      segments: currentSentence.segments
    });
  }

  return sentences;
}

/**
 * Get or use provided director name
 */
function getDirectorName(directorInput?: string): string {
  if (directorInput) return directorInput;
  return generateMemorable('director-');
}

/**
 * Split chapter transcript into sentences
 */
export async function splitSentences(
  book: string,
  chapter: string,
  directorInput?: string
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
    const sentencesDir = path.join(directorDir, 'sentences');
    ensureDirectory(sentencesDir);

    // Read transcript
    const transcript = JSON.parse(fs.readFileSync(transcriptPath, 'utf-8')) as Transcript;
    console.log(`Processing transcript from: ${transcriptPath}`);

    // Process segments into sentences
    const sentences = processSegmentsIntoSentences(transcript.segments);

    // Save the sentences
    const outputPath = path.join(sentencesDir, 'sentences.json');
    const finalSentences: Sentences = {
      duration: transcript.duration,
      sentenceCount: sentences.length,
      sentences: sentences
    };

    fs.writeFileSync(outputPath, JSON.stringify(finalSentences, null, 2));
    console.log(`Saved sentences data to: ${outputPath}`);

    timer.stop();
  } catch (error) {
    throw error;
  }
} 