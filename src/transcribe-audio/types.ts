export interface Segment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface Transcript {
  duration: number;
  segmentCount: number;
  segments: Segment[];
  text: string;
}