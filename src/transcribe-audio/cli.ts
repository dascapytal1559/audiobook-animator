import { Command } from "commander";
import { CliTimer } from "../common/timer";
import { FLAGS, parseIds } from "../common/flags";
import { transcribeChapter, cleanTranscript } from "./core";
import * as path from 'path';
import * as fs from 'fs';
import { saveJson } from "./utils";

async function cleanTranscriptionFiles(book: string, chapterDir: string): Promise<void> {
  const rawResponsePath = path.join(chapterDir, 'transcript.res.json');
  const transcriptPath = path.join(chapterDir, 'transcript.json');

  console.log(`Processing: ${path.basename(chapterDir)}`);
  console.log(`Book: ${book}`);
  console.log(`Chapter: ${path.basename(chapterDir)}`);

  // Check if raw response file exists
  if (!fs.existsSync(rawResponsePath)) {
    throw new Error(`Raw transcript file not found: ${rawResponsePath}`);
  }

  console.log(`Loading raw transcript from: ${rawResponsePath}`);
  const rawResponse = JSON.parse(fs.readFileSync(rawResponsePath, 'utf8'));
  
  // Clean and save transcript
  const transcript = cleanTranscript(rawResponse);
  saveJson(transcriptPath, transcript);
  console.log(`Cleaned transcript saved to: ${transcriptPath}`);
}

async function main() {
  const timer = new CliTimer();

  try {
    const program = new Command();

    // Default command (transcribe)
    const transcribeCommand = new Command('transcribe')
      .description("Transcribe an audio file using OpenAI Whisper")
      .requiredOption(FLAGS.book.flag, FLAGS.book.description)
      .option(FLAGS.chapters.flag, FLAGS.chapters.description)
      .action(async (options) => {
        try {
          const book = options.book;
          
          // Get chapter directories in the book folder
          const bookPath = path.join("audiobooks", book);
          const entries = fs.readdirSync(bookPath, { withFileTypes: true });
          const chapterDirs = entries
            .filter(entry => entry.isDirectory() && /^\d+_/.test(entry.name))
            .map(entry => ({
              index: parseInt(entry.name.split('_')[0]),
              name: entry.name
            }))
            .sort((a, b) => a.index - b.index);
            
          // Get all valid chapter indices
          const allChapterIndices = chapterDirs.map(dir => dir.index);
          
          // Parse chapter indices from input, or use all if not provided
          const chapterIndices = parseIds(allChapterIndices, options.chapters);
          
          if (chapterIndices.length === 0) {
            console.log("No valid chapters specified. No processing will be done.");
            return;
          }
          
          if (options.chapters) {
            console.log(`Transcribing ${chapterIndices.length} specified chapters: ${chapterIndices.join(", ")}`);
          } else {
            console.log(`Transcribing all ${chapterIndices.length} chapters`);
          }
          
          // Process each specified chapter
          for (const chapterIndex of chapterIndices) {
            const chapterDir = chapterDirs.find(dir => dir.index === chapterIndex)?.name;
            if (!chapterDir) {
              console.warn(`Chapter ${chapterIndex} not found, skipping`);
              continue;
            }
            
            await transcribeChapter(book, chapterDir);
          }
          
          process.exit(0);
        } catch (error) {
          console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      });

    // Clean command
    const cleanCommand = new Command('clean')
      .description("Clean transcription files from temporary data")
      .requiredOption(FLAGS.book.flag, FLAGS.book.description)
      .option(FLAGS.chapters.flag, FLAGS.chapters.description)
      .action(async (options) => {
        try {
          const book = options.book;
          
          // Get chapter directories in the book folder
          const bookPath = path.join("audiobooks", book);
          const entries = fs.readdirSync(bookPath, { withFileTypes: true });
          const chapterDirs = entries
            .filter(entry => entry.isDirectory() && /^\d+_/.test(entry.name))
            .map(entry => ({
              index: parseInt(entry.name.split('_')[0]),
              name: entry.name
            }))
            .sort((a, b) => a.index - b.index);
            
          // Get all valid chapter indices
          const allChapterIndices = chapterDirs.map(dir => dir.index);
          
          // Parse chapter indices from input, or use all if not provided
          const chapterIndices = parseIds(allChapterIndices, options.chapters);
          
          if (chapterIndices.length === 0) {
            console.log("No valid chapters specified. No processing will be done.");
            return;
          }
          
          if (options.chapters) {
            console.log(`Cleaning ${chapterIndices.length} specified chapters: ${chapterIndices.join(", ")}`);
          } else {
            console.log(`Cleaning all ${chapterIndices.length} chapters`);
          }
          
          // Process each specified chapter
          for (const chapterIndex of chapterIndices) {
            const chapterDir = chapterDirs.find(dir => dir.index === chapterIndex)?.name;
            if (!chapterDir) {
              console.warn(`Chapter ${chapterIndex} not found, skipping`);
              continue;
            }
            
            const fullChapterPath = path.join(bookPath, chapterDir);
            await cleanTranscriptionFiles(book, fullChapterPath);
          }
          
          process.exit(0);
        } catch (error) {
          console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      });

    program
      .description("Audiobook transcription CLI")
      .addCommand(transcribeCommand, { isDefault: true }) // Make transcribe the default command
      .addCommand(cleanCommand);

    await program.parseAsync(process.argv);
  } catch (error) {
    console.error(
      "Error:",
      error instanceof Error ? error.message : "Unknown error"
    );
    process.exit(1);
  } finally {
    timer.stop();
  }
}

if (require.main === module) {
  main();
} 