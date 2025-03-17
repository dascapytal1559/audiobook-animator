import { Command } from "commander";
import { CliTimer } from "../common/timer";
import { FLAGS } from "../common/flags";
import { splitChapter, splitChapterChunks } from "./core";

async function main() {
  const timer = new CliTimer();
  timer.start();

  try {
    const program = new Command();

    // Chapter command (default)
    const chapterCommand = new Command("chapter")
      .description("Split a chapter from a book")
      .requiredOption(FLAGS.book.flag, FLAGS.book.description)
      .requiredOption(FLAGS.chapter.flag, FLAGS.chapter.description)
      .action((options) => {
        splitChapter(options.book, options.chapter);
      });

    // Chunks command
    const chunksCommand = new Command("chunks")
      .description("Split a chapter into chunks")
      .requiredOption(FLAGS.book.flag, FLAGS.book.description)
      .requiredOption(FLAGS.chapter.flag, FLAGS.chapter.description)
      .action((options) => {
        splitChapterChunks(options.book, options.chapter);
      });

    program
      .description("Audiobook splitting CLI")
      .addCommand(chapterCommand, { isDefault: true }) // Make chapter the default command
      .addCommand(chunksCommand);

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
