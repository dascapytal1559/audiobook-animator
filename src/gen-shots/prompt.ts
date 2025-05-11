import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';
import { Section } from '../split-sections/types';
import { Segment } from '../openai-transcribe/types';

// Zod schemas for validation
export const ShotSchema = z.object({
  title: z.string(),
  description: z.string(),
  startSegment: z.number(),
  endSegment: z.number(),
});

export const ResponseSchema = z.object({
  shots: z.array(ShotSchema),
});

export function createPrompt(section: Section, segments: Segment[]): ChatCompletionCreateParamsNonStreaming {
  return {
    model: 'o3-mini', // never change this
    response_format: zodResponseFormat(ResponseSchema, "shots_extraction"),
    messages: [
      {
        role: 'developer',
        content: `You are a graphic novel artist and visual storyteller. Your task is to break down narrative text into distinct shots that will form a compelling visual sequence.

Key requirements for shots:
1. Each shot must cover a continuous sequence of segments with NO GAPS
2. Each shot must start immediately after the previous shot's end segment
3. Each shot should be visually striking and memorable
4. Aim for approximately 1 shot every 4 segments to maintain a good narrative pace
5. Shot boundaries should align with dramatic moments, key actions, or shifts in dialogue
6. Focus on creating shots that would look stunning in a cinematic format

For each shot, provide:
- title: A brief, descriptive title for the shot
- description: A detailed description of the shot's visual composition, including camera angles, character poses, expressions, environmental details, and any text/dialogue placement
- startSegment: The first segment ID in the shot
- endSegment: The last segment ID in the shot`
      },
      {
        role: 'user',
        content: `Break down this section into a sequence of continuous camera shots. The section has segments numbered from ${section.startSegment} to ${section.endSegment}.

Section title: ${section.title}
Section text:
${segments.map(seg => seg.text).join(' ')}

Remember:
- Each shot must start with the segment immediately after the previous shot's end
- The first shot must start with segment ${section.startSegment}
- The last shot must end with segment ${section.endSegment}
- There must be NO GAPS between shots`
      }
    ],
  };
} 