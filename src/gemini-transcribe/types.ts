export interface GeminiTranscript {
  text: string;
  duration?: number;
}

export interface GeminiFileInfo {
  name: string;
  displayName: string;
  uri: string;
  mimeType: string;
  state: string;
} 