export interface ImageData {
  shotId: number;
  prompt: string;
  url: string;
  width: number;
  height: number;
}

export type Images = Record<string, ImageData>; // Key is shotId
