import * as fs from 'fs';
import * as path from 'path';
import { GeminiTranscript } from './types';

export function validateAudioFile(audioPath: string): void {
  // Check if file exists
  if (!fs.existsSync(audioPath)) {
    throw new Error(`Audio file not found: ${audioPath}`);
  }

  // Check if it's an audio file (by extension)
  const ext = path.extname(audioPath).toLowerCase();
  if (!['.mp3', '.wav', '.m4a', '.mp4'].includes(ext)) {
    throw new Error(`Unsupported audio format: ${ext}`);
  }
}

export function saveJson(filePath: string, data: any): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`JSON saved to: ${filePath}`);
} 