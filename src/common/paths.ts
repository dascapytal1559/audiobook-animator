import * as fs from 'fs';

/**
 * Ensure a directory exists, creating it if necessary
 */
export function ensureDirectory(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
