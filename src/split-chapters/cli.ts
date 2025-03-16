import { Command } from "commander";
import { CliTimer } from "../common/timer";
import { FLAGS } from "../common/flags";
import { splitSingleChapter } from "./core";

async function main() {
  const timer = new CliTimer();
  timer.start();

  try {
    const program = new Command();

    program
      .description("Split an audiobook into chapters")
      .requiredOption(FLAGS.book.flag, FLAGS.book.description)
      .requiredOption(FLAGS.chapter.flag, FLAGS.chapter.description,)
      .action((options) => {
        return splitSingleChapter(options.book, options.chapter);
      });

    await program.parseAsync();
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