import { Command } from "commander";
import { CliTimer } from "../common/timer";
import { splitSentences } from "./core";
import { FLAGS } from "../common/flags";

async function main() {
  const timer = new CliTimer();
  timer.start();

  try {
    const program = new Command();

    // Create generate command (default)
    const generateCmd = new Command('generate')
      .description('Split chapter transcript into sentences')
      .requiredOption(FLAGS.book.flag, FLAGS.book.description)
      .requiredOption(FLAGS.chapter.flag, FLAGS.chapter.description)
      .option(FLAGS.director.flag, FLAGS.director.description)
      .action(async (options) => {
        try {
          await splitSentences(
            options.book,
            options.chapter,
            options.director
          );
          process.exit(0);
        } catch (error) {
          console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      });

    // Set up main program
    program
      .name("split-sentences")
      .description("Split chapter transcript into sentences based on punctuation")
      .addCommand(generateCmd, { isDefault: true });

    await program.parseAsync(process.argv);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  } finally {
    timer.stop();
  }
}

if (require.main === module) {
  main();
} 