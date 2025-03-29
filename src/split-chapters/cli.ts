import { Command } from "commander";
import { FLAGS, parseIds } from "../common/flags";
import { CliTimer } from "../common/timer";
import { splitChapters } from "./core";

async function main() {
  const timer = new CliTimer();
  timer.start();

  try {
    const program = new Command();

    // Chapter command (default)
    const chapterCommand = new Command("split-chapters")
      .description("Split chapters from a book")
      .requiredOption(FLAGS.book.flag, FLAGS.book.description)
      .option(FLAGS.chapter.flag, FLAGS.chapter.description)
      .action(async (options) => {
        const book = options.book;
        
        // Process the chapters
        await splitChapters(book, options.chapters);
      });

    program.addCommand(chapterCommand, { isDefault: true }); // Make chapter the default command

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
