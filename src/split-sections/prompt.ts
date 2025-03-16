import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';
import { Transcript } from '../transcribe-audio/types';

// Zod schemas for validation
export const SegmentSchema = z.object({
  id: z.number(),
  text: z.string(),
  start: z.number(),
  end: z.number()
});

export const SectionSchema = z.object({
  title: z.string().describe('A descriptive title that captures the key narrative element'),
  description: z.string().describe('A brief description of the section\'s content and themes'),
  startSegment: z.number().describe('The first segment ID in this section'),
  endSegment: z.number().describe('The last segment ID in this section')
});

export const ResponseSchema = z.object({
  sections: z.array(SectionSchema)
}).describe('A sequence of sections that break down the narrative');

export function createPrompt(transcript: Transcript, targetSections: number = 10): ChatCompletionCreateParamsNonStreaming {
  const firstSegmentId = transcript.segments[0].id;
  const lastSegmentId = transcript.segments[transcript.segments.length - 1].id;
  const totalSegments = transcript.segments.length;
  const segmentsPerSection = Math.floor(totalSegments / targetSections);

  return {
    model: "o3-mini",
    response_format: zodResponseFormat(ResponseSchema, "sections_extraction"),
    messages: [
      {
        role: "system",
        content: `You are an expert at breaking down long-form content into meaningful sections. Your task is to analyze a transcript and divide it into approximately ${targetSections} sections that form coherent narrative units.

Key principles:
1. Each section should cover a complete thought, scene, or narrative unit
2. Sections should be roughly balanced in length (target ~${segmentsPerSection} segments each)
3. Section boundaries should occur at natural breaks in the narrative
4. Each section should have a clear focus and purpose
5. Titles should be concise but descriptive
6. Descriptions should summarize the key events or concepts

Important technical requirements:
- Every segment must be included exactly once
- Segments must be continuous (no gaps or overlaps)
- First section must start with segment ${firstSegmentId}
- Last section must end with segment ${lastSegmentId}
- Each section should be within ±25% of target length (${segmentsPerSection} segments) unless there's a compelling narrative reason`
      },
      {
        role: "user",
        content: `Break this transcript into approximately ${targetSections} sections following the requirements above:

${JSON.stringify(transcript, null, 2)}`
      }
    ],
  };
} 