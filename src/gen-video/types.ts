export interface VideoConfig {
  fps: number;
  width: number;
  height: number;
}

export interface VideoSegment {
  startTime: number;
  endTime: number;
  duration: number;
  shotIds: number[];
}

export interface VideoOptions {
  useUpscaledImages: boolean;
  fps?: number;
  resolution?: string;
} 