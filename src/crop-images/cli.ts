import { Command } from "commander";
import { CliTimer } from "../common/timer";
import { cropImages } from "./core";
import { FLAGS } from "../common/flags";

async function main() {
  const timer = new CliTimer();
  timer.start();

  try {
    const program = new Command();

    // Create generate command (default)
    const generateCmd = new Command('generate')
      .description('Crop images from images4 directory based on crop-config.json')
      .requiredOption(FLAGS.book.flag, FLAGS.book.description)
      .requiredOption(FLAGS.chapter.flag, FLAGS.chapter.description)
      .requiredOption(FLAGS.visual.flag, FLAGS.visual.description)
      .option(FLAGS.shotIds.flag, FLAGS.shotIds.description)
      .action(async (options) => {
        try {
          await cropImages(
            options.book,
            options.chapter,
            options.visual,
            options.shots
          );
          console.log('\nDone! Images have been cropped based on crop-config.json');
          process.exit(0);
        } catch (error) {
          console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      });

    // Set up main program
    program
      .name("crop-images")
      .description("Crop images from 4-variation images into single images")
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
