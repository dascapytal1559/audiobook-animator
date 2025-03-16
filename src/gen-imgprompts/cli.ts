import { Command } from "commander";
import { CliTimer } from "../common/timer";
import { generateImagePrompts } from "./core";
import { FLAGS } from "../common/flags";

async function main() {
  const timer = new CliTimer();
  timer.start();

  try {
    const program = new Command();

    // Default command (generate)
    const defaultCommand = new Command('generate')
      .description("Generate image prompts from shots")
      .requiredOption(FLAGS.book.flag, FLAGS.book.description)
      .requiredOption(FLAGS.chapter.flag, FLAGS.chapter.description)
      .requiredOption(FLAGS.director.flag, FLAGS.director.description)
      .option(FLAGS.shotIds.flag, FLAGS.shotIds.description)
      .action(async (options) => {
        try {
          await generateImagePrompts(
            options.book,
            options.chapter,
            options.director,
            options.shots ? options.shots.split(',').map(Number) : []
          );
          process.exit(0);
        } catch (error) {
          console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      });

    program
      .description("Generate image prompts from shots")
      .addCommand(defaultCommand, { isDefault: true }); // Make generate the default command

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
