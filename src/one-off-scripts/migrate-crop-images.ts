import * as fs from 'fs';
import * as path from 'path';
import { ensureDirectory } from '../common/paths';

async function migrateVisualDir(visualDir: string): Promise<void> {
  // Create cropped-images directory
  const croppedImagesDir = path.join(visualDir, 'cropped-images');
  ensureDirectory(croppedImagesDir);

  // Move crop-config.json if it exists
  const oldConfigPath = path.join(visualDir, 'crop-config.json');
  const newConfigPath = path.join(croppedImagesDir, 'crop-config.json');
  
  if (fs.existsSync(oldConfigPath)) {
    console.log(`Moving crop-config.json in ${visualDir}`);
    fs.copyFileSync(oldConfigPath, newConfigPath);
    fs.unlinkSync(oldConfigPath);
  }

  // Move cropped images if they exist
  const oldImagesDir = path.join(visualDir, 'images');
  if (fs.existsSync(oldImagesDir)) {
    const files = fs.readdirSync(oldImagesDir);
    const shotImages = files.filter(f => f.startsWith('shot') && f.endsWith('.png'));

    if (shotImages.length > 0) {
      console.log(`Moving ${shotImages.length} cropped images in ${visualDir}`);
      for (const file of shotImages) {
        const oldPath = path.join(oldImagesDir, file);
        const newPath = path.join(croppedImagesDir, file);
        fs.copyFileSync(oldPath, newPath);
        fs.unlinkSync(oldPath);
      }
    }
  }
}

async function main() {
  const book = process.argv[2];
  const chapter = process.argv[3];

  if (!book || !chapter) {
    console.error('Usage: npx ts-node src/scripts/migrate-crop-images.ts <book> <chapter>');
    process.exit(1);
  }

  try {
    const chapterDir = path.join('audiobooks', book, chapter);
    if (!fs.existsSync(chapterDir)) {
      throw new Error(`Chapter directory not found: ${chapterDir}`);
    }

    // Find all visual directories
    const items = fs.readdirSync(chapterDir);
    const visualDirs = items
      .filter(item => item.startsWith('visual-'))
      .map(dir => path.join(chapterDir, dir));

    if (visualDirs.length === 0) {
      console.log('No visual directories found to migrate');
      return;
    }

    // Migrate each visual directory
    for (const visualDir of visualDirs) {
      await migrateVisualDir(visualDir);
    }

    console.log('\nMigration complete!');
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
} 