import { Command } from "commander";
import { CliTimer } from "../common/timer";
import { generateImages } from "./core";
import { FLAGS } from "../common/flags";

async function main() {
  const timer = new CliTimer();
  timer.start();

  try {
    const program = new Command();

    // Create generate command (default)
    const generateCmd = new Command('generate')
      .description('Generate 4 variations per shot using Midjourney')
      .requiredOption(FLAGS.book.flag, FLAGS.book.description)
      .requiredOption(FLAGS.chapter.flag, FLAGS.chapter.description)
      .requiredOption(FLAGS.director.flag, FLAGS.director.description)
      .option(FLAGS.shotIds.flag, FLAGS.shotIds.description)
      .option(FLAGS.visual.flag, FLAGS.visual.description)
      .option("--mj <params>", "Midjourney params")
      .action(async (options) => {
        try {
          await generateImages(
            options.book,
            options.chapter,
            options.director,
            options.shots,
            options.visual,
            options.mj
          );
          process.exit(0);
        } catch (error) {
          console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      });

    // Set up main program
    program
      .name("gen-images")
      .description("Generate images using Midjourney")
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
