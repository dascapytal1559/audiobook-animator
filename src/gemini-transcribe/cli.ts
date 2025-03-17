import { Command } from "commander";
import { CliTimer } from "../common/timer";
import { FLAGS } from "../common/flags";
import { transcribeChapter } from "./core";

async function main() {
  const timer = new CliTimer();
  timer.start();

  try {
    const program = new Command();

    // Default command (transcribe)
    const transcribeCommand = new Command('transcribe')
      .description("Transcribe an audio file using Google Gemini")
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

    program
      .description("Audiobook transcription using Google Gemini CLI")
      .addCommand(transcribeCommand, { isDefault: true }); // Make transcribe the default command

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