import { Segment } from "../transcribe-audio/types";

export interface Section {
  title: string;
  description: string;
  start: number;
  end: number;
  duration: number;
  startSegment: number;
  endSegment: number;
  segmentCount: number;
  segments: Segment[];
}

export interface Sections {
  duration: number;
  sectionCount: number;
  sections: Section[];
}
