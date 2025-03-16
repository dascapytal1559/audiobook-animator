import { Command } from "commander";
import { CliTimer } from "../common/timer";
import { FLAGS } from "../common/flags";
import { transcribeChapter, cleanTranscript } from "./core";
import * as path from 'path';
import * as fs from 'fs';
import { saveJson } from "./utils";

async function cleanTranscriptionFiles(book: string, chapter: string): Promise<void> {
  const chapterDir = path.join("audiobooks", book, chapter);
  const rawResponsePath = path.join(chapterDir, 'transcript.res.json');
  const transcriptPath = path.join(chapterDir, 'transcript.json');

  console.log(`Processing: ${chapter}`);
  console.log(`Book: ${book}`);
  console.log(`Chapter: ${chapter}`);

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
  timer.start();

  try {
    const program = new Command();

    // Default command (transcribe)
    const transcribeCommand = new Command('transcribe')
      .description("Transcribe an audio file using OpenAI Whisper")
      .requiredOption(FLAGS.book.flag, FLAGS.book.description)
      .requiredOption(FLAGS.chapter.flag, FLAGS.chapter.description)
      .action(async (options) => {
        try {
          await transcribeChapter(options.book, options.chapter);
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
      .requiredOption(FLAGS.chapter.flag, FLAGS.chapter.description)
      .action(async (options) => {
        try {
          await cleanTranscriptionFiles(options.book, options.chapter);
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