import { Segment } from "../transcribe-audio/types";

export interface Sentence {
  text: string;
  start: number;
  end: number;
  elapsed: number;
  startSegment: number;
  endSegment: number;
  segmentCount: number;
  segments: Segment[];
}

export interface Sentences {
  duration: number;
  sentenceCount: number;
  sentences: Sentence[];
} 