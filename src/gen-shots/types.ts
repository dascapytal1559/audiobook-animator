export interface Shot {
  shotId: number;
  title: string;
  description: string;
  text: string;
  start: number;
  end: number;
  duration: number;
  startSegment: number;
  endSegment: number;
  segmentCount: number;
  ffmpegEffects?: string;
  effectsExplanation?: string;
}

export interface Shots {
  duration: number;
  segmentCount: number;
  shotCount: number;
  shots: Shot[];
}