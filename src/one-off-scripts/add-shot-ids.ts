import * as fs from 'fs';
import * as path from 'path';
import { Shot, Shots } from '../gen-shots/types';

function addShotIds(shotsData: Shots): Shots {
  return {
    ...shotsData,
    shots: shotsData.shots.map((shot, index) => ({
      ...shot,
      shotId: index
    }))
  };
}

async function main() {
  const book = process.argv[2];
  const chapter = process.argv[3];

  if (!book || !chapter) {
    console.error('Usage: npx ts-node src/scripts/add-shot-ids.ts <book> <chapter>');
    process.exit(1);
  }

  try {
    // Process chapter shots file
    const chapterShotsPath = path.join('audiobooks', book, chapter, 'shots.json');
    if (fs.existsSync(chapterShotsPath)) {
      console.log(`Processing chapter shots: ${chapterShotsPath}`);
      const chapterShots: Shots = JSON.parse(fs.readFileSync(chapterShotsPath, 'utf-8'));
      const updatedChapterShots = addShotIds(chapterShots);
      fs.writeFileSync(chapterShotsPath, JSON.stringify(updatedChapterShots, null, 2));
      console.log('✓ Updated chapter shots.json');
    }

    // Process section shots files
    const sectionsDirPath = path.join('audiobooks', book, chapter, 'sections');
    if (fs.existsSync(sectionsDirPath)) {
      const files = fs.readdirSync(sectionsDirPath);
      const sectionShotsFiles = files.filter(f => f.endsWith('.shots.json'));

      for (const file of sectionShotsFiles) {
        const filePath = path.join(sectionsDirPath, file);
        console.log(`Processing section shots: ${filePath}`);
        const sectionShots: Shots = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const updatedSectionShots = addShotIds(sectionShots);
        fs.writeFileSync(filePath, JSON.stringify(updatedSectionShots, null, 2));
        console.log(`✓ Updated ${file}`);
      }
    }

    console.log('\nAll shots.json files have been updated with shotId field');
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
} 