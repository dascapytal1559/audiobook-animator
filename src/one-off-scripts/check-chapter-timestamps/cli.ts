import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import { FLAGS, parseBookDir } from "../common/flags";
import { parseDuration } from "../common/timestamps";

interface ChapterConfig {
  title: string;
  duration: string; // Format: "HH:MM:SS" or "MM:SS"
}

type ChaptersConfig = ChapterConfig[];

interface DurationData {
  inSeconds: number;
  inTimestamp: string;
}

function parseTimestampToSeconds(timestamp: string): number {
  // Handle different formats: "HH:MM:SS" or "MM:SS"
  const parts = timestamp.split(':').map(Number);
  
  if (parts.length === 3) {
    // HH:MM:SS format
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    // MM:SS format
    const [minutes, seconds] = parts;
    return minutes * 60 + seconds;
  } else {
    throw new Error(`Invalid timestamp format: ${timestamp}`);
  }
}

async function main(): Promise<void> {
  const program = new Command();
  
  program
    .description("Check integrity of chapter timestamps against book duration")
    .requiredOption(FLAGS.book.flag, FLAGS.book.description)
    .action(async (options: { book: string }) => {
      try {
        const bookDir = parseBookDir(options.book);
        
        if (!fs.existsSync(bookDir)) {
          console.error(`Book directory not found: ${bookDir}`);
          process.exit(1);
        }
        
        // Check for chapters.config.json
        const chaptersConfigPath = path.join(bookDir, "chapters.config.json");
        if (!fs.existsSync(chaptersConfigPath)) {
          console.error(`Chapters config file not found: ${chaptersConfigPath}`);
          process.exit(1);
        }
        
        // Check for duration.json
        const durationPath = path.join(bookDir, "duration.json");
        if (!fs.existsSync(durationPath)) {
          console.error(`Duration file not found: ${durationPath}`);
          process.exit(1);
        }
        
        // Read and parse files
        const chaptersConfig: ChaptersConfig = JSON.parse(fs.readFileSync(chaptersConfigPath, "utf-8"));
        const durationData: DurationData = JSON.parse(fs.readFileSync(durationPath, "utf-8"));
        
        // Calculate total duration from chapters
        let totalChapterDurationInSeconds = 0;
        for (const chapter of chaptersConfig) {
          const chapterDurationInSeconds = parseTimestampToSeconds(chapter.duration);
          totalChapterDurationInSeconds += chapterDurationInSeconds;
          console.log(`Chapter: ${chapter.title}, Duration: ${chapter.duration} (${chapterDurationInSeconds}s)`);
        }
        
        const totalChapterDurationFormatted = parseDuration(totalChapterDurationInSeconds);
        
        // Compare durations
        console.log(`\nBook: ${options.book}`);
        console.log(`Total chapter duration: ${totalChapterDurationInSeconds} seconds (${totalChapterDurationFormatted})`);
        console.log(`Book duration: ${durationData.inSeconds} seconds (${durationData.inTimestamp})`);
        
        const difference = Math.abs(totalChapterDurationInSeconds - durationData.inSeconds);
        const differencePercentage = (difference / durationData.inSeconds) * 100;
        
        if (difference < 1) { // Allow for small rounding errors
          console.log("✅ Chapter durations match book duration");
        } else {
          console.log(`❌ Chapter durations do not match book duration`);
          console.log(`   Difference: ${difference.toFixed(2)} seconds (${differencePercentage.toFixed(2)}%)`);
        }
      } catch (error) {
        console.error("Error:", error);
        process.exit(1);
      }
    });
  
  program.parse(process.argv);
}

if (require.main === module) {
  main();
}
