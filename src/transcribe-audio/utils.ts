import * as fs from 'fs';
import * as path from 'path';
import { ensureDirectory } from '../common/paths';

export function validateAudioFile(audioPath: string): void {
  if (!fs.existsSync(audioPath)) {
    throw new Error(`Audio file not found: ${audioPath}`);
  }

  const extension = path.extname(audioPath).toLowerCase();
  if (extension !== '.mp3') {
    throw new Error(`Unsupported audio format: ${extension}. Only .mp3 files are supported.`);
  }
}

export function saveJson(filePath: string, data: any): void {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}
