import { Command } from "commander";
import { CliTimer } from "../common/timer";
import { generateVideo } from "./core";
import { FLAGS } from "../common/flags";
import { VideoOptions } from "./types";

async function main() {
  const timer = new CliTimer();
  timer.start();

  try {
    const program = new Command();

    // Create generate command (default)
    const generateCmd = new Command('generate')
      .description('Generate video from images and audio')
      .requiredOption(FLAGS.book.flag, FLAGS.book.description)
      .requiredOption(FLAGS.chapter.flag, FLAGS.chapter.description)
      .requiredOption(FLAGS.director.flag, FLAGS.director.description)
      .requiredOption(FLAGS.visual.flag, FLAGS.visual.description)
      .option(FLAGS.shotIds.flag, FLAGS.shotIds.description)
      .option('--upscaled', 'Use upscaled images', false)
      .action(async (options) => {
        try {
          const videoOptions: VideoOptions = {
            useUpscaledImages: options.upscaled
          };

          await generateVideo(
            options.book,
            options.chapter,
            options.director,
            options.visual,
            options.shots,
            videoOptions
          );
          process.exit(0);
        } catch (error) {
          console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      });

    // Set up main program
    program
      .name("gen-video")
      .description("Generate video from images and audio")
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