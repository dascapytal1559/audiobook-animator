import { Command } from "commander";
import { CliTimer } from "../common/timer";
import { generateShots, combineShots } from "./core";
import { FLAGS } from "../common/flags";
import path from "path";

async function main() {
  const timer = new CliTimer();
  timer.start();

  try {
    const program = new Command();

    // Default command (generate)
    const defaultCommand = new Command('generate')
      .description("Generate shots from sections")
      .requiredOption(FLAGS.book.flag, FLAGS.book.description)
      .requiredOption(FLAGS.chapter.flag, FLAGS.chapter.description)
      .requiredOption(FLAGS.director.flag, FLAGS.director.description)
      .option("-s, --section <section>", "Section ID to process (optional, processes all sections if not specified)")
      .action(async (options) => {
        try {
          await generateShots(options.book, options.chapter, options.director, options.section);
          process.exit(0);
        } catch (error) {
          console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      });

    // Combine command
    const combineCommand = new Command('combine')
      .description("Combine all section shots into a single shots.json file")
      .requiredOption(FLAGS.book.flag, FLAGS.book.description)
      .requiredOption(FLAGS.chapter.flag, FLAGS.chapter.description)
      .requiredOption(FLAGS.director.flag, FLAGS.director.description)
      .action(async (options) => {
        try {
          const directorDir = path.join('audiobooks', options.book, options.chapter, options.director);
          await combineShots(directorDir);
          process.exit(0);
        } catch (error) {
          console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      });

    program
      .description("Process sections into shots")
      .addCommand(defaultCommand, { isDefault: true }) // Make generate the default command
      .addCommand(combineCommand);

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