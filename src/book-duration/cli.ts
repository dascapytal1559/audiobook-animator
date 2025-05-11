import { Command } from "commander";
import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import { FLAGS, parseBookDir } from "../common/flags";
import { parseDuration, parseTimestamp } from "../common/timestamps";

// Used to get the duration of the book in seconds

const execAsync = promisify(exec);

// Get audio duration in seconds using ffmpeg
async function getAudioDurationInSeconds(filePath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `ffmpeg -i "${filePath}" -hide_banner 2>&1 | grep "Duration" | awk '{print $2}' | tr -d ,`
    );
    
    const durationStr = stdout.trim();
    if (!durationStr) {
      throw new Error("Could not extract duration information");
    }

    return parseTimestamp(durationStr);
  } catch (error) {
    console.error("Error getting audio duration:", error);
    throw error;
  }
}

async function main(): Promise<void> {
  const program = new Command();
  
  program
    .description("Analyze audiobook duration and output to duration.json")
    .requiredOption(FLAGS.book.flag, FLAGS.book.description)
    .action(async (options: { book: string }) => {
      try {
        const bookDir = parseBookDir(options.book);
        
        if (!fs.existsSync(bookDir)) {
          console.error(`Book directory not found: ${bookDir}`);
          process.exit(1);
        }
        
        // Check for book audio file
        const audioFilename = `book.mp3`;
        const audioPath = path.join(bookDir, audioFilename);
        
        if (!fs.existsSync(audioPath)) {
          console.error(`Audio file not found: ${audioPath}`);
          process.exit(1);
        }
        
        console.log(`Analyzing duration of ${audioPath}...`);
        const durationInSeconds = await getAudioDurationInSeconds(audioPath);
        const durationInTimestamp = parseDuration(durationInSeconds);
        console.log(`Duration: ${durationInSeconds} seconds (${durationInTimestamp})`);
        
        // Create duration data object
        const durationData = {
          inSeconds: durationInSeconds,
          inTimestamp: durationInTimestamp
        };
        
        // Save duration.json to the book directory
        const outputPath = path.join(bookDir, "book.duration.json");
        fs.writeFileSync(outputPath, JSON.stringify(durationData, null, 2), "utf-8");
        console.log(`Duration saved to ${outputPath}`);
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

