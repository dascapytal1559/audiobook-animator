import { Command } from "commander";
import { CliTimer } from "../common/timer";
import { splitSections } from "./core";
import { FLAGS } from "../common/flags";

async function main() {
  const timer = new CliTimer();
  timer.start();

  try {
    const program = new Command();

    // Create generate command (default)
    const generateCmd = new Command('generate')
      .description('Split chapter transcript into sections')
      .requiredOption(FLAGS.book.flag, FLAGS.book.description)
      .requiredOption(FLAGS.chapter.flag, FLAGS.chapter.description)
      .option(FLAGS.director.flag, FLAGS.director.description)
      .option('-n, --num-sections <number>', 'Target number of sections', '10')
      .action(async (options) => {
        try {
          await splitSections(
            options.book,
            options.chapter,
            options.director,
            parseInt(options.numSections)
          );
          process.exit(0);
        } catch (error) {
          console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      });

    // Set up main program
    program
      .name("split-sections")
      .description("Split chapter transcript into sections")
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