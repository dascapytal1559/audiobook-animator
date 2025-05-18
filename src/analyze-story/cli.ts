#!/usr/bin/env node

import { Command } from "commander";
import * as dotenv from "dotenv";
import { OpenAI } from "openai";
import * as path from "path";
import { FLAGS, parseBookDir, parseChapterDirs } from "../common/flags";
import { CliTimer } from "../common/timer";
import {
  getChapterTranscript,
  saveSceneAnalysis,
  Scene,
  SceneAnalysis,
} from "./paths";

dotenv.config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- Scene Analysis Logic ---

/**
 * Analyze a transcript to identify scenes using OpenAI
 * @param bookName Name of the book
 * @param chapterName Name of the chapter
 * @param transcriptText The full transcript text
 * @returns Scene analysis results
 */
async function analyzeTranscriptScenes(
  bookName: string,
  chapterName: string,
  transcriptText: string
): Promise<SceneAnalysis> {
  console.log(`Analyzing transcript to identify scenes...`);

  const prompt = `
Analyze the following story transcript and break it down into distinct scenes.
For each scene, provide:
1. A descriptive title that captures the essence of the scene
2. The exact starting few words of the scene from the transcript (to identify the scene later)
3. Character appearances (list all characters present in the scene)
4. Setting/Location (where the scene takes place)
5. Props or symbolic elements (important objects, symbols, or elements)
6. Mood/Atmosphere (the emotional tone or atmosphere of the scene)

The transcript is from the book "${bookName}", chapter "${chapterName}".

Format your response as a valid JSON array of scene objects with these properties:
[
  {
    "id": 1,
    "title": "Scene title",
    "startText": "Exact starting words from transcript",
    "characterAppearances": ["Character 1", "Character 2"],
    "location": "Setting description",
    "props": ["Prop 1", "Prop 2"],
    "mood": "Mood description"
  },
  ...
]

TRANSCRIPT:
${transcriptText}
`;

  // Call OpenAI API to analyze scenes
  const response = await openai.chat.completions.create({
    model: "gpt-4.1",
    messages: [
      {
        role: "system",
        content:
          "You are a literary analyst specializing in scene breakdown and narrative structure. You carefully identify distinct scenes in a story and provide detailed analysis.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 4000,
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("No content returned from OpenAI");
  }

  try {
    // Extract JSON array from response
    const jsonMatch = content.match(/\[\s*\{.*\}\s*\]/s);
    if (!jsonMatch) {
      throw new Error("No valid JSON array found in the response");
    }

    const scenes = JSON.parse(jsonMatch[0]) as Scene[];

    return {
      bookName,
      chapterName,
      sceneCount: scenes.length,
      scenes,
    };
  } catch (error) {
    console.error("Error parsing OpenAI response:", error);
    console.log("Raw response:", content);
    throw new Error("Failed to parse scenes from OpenAI response");
  }
}

// --- CLI Logic ---

const program = new Command();

program
  .description(
    "Analyze a story transcript to produce a list of scenes with details"
  )
  .version("1.0.0")
  .requiredOption(FLAGS.book.flag, FLAGS.book.description)
  .requiredOption(FLAGS.chapters.flag, FLAGS.chapters.description);

program.action(async (options) => {
  const timer = new CliTimer();

  // Parse book and chapter directories
  const bookDir = parseBookDir(options.book);
  const chapterDirs = parseChapterDirs(bookDir, options.chapters);

  if (chapterDirs.length === 0) {
    console.error("No chapters found or selected");
    process.exit(1);
  }

  console.log(`Processing ${chapterDirs.length} chapter(s)...`);

  // Process each chapter
  for (const chapterDir of chapterDirs) {
    const chapterName = path.basename(chapterDir);
    console.log(`\n=== Processing chapter: ${chapterName} ===`);

    // Get transcript for chapter
    const transcript = getChapterTranscript(chapterDir);
    if (!transcript) {
      console.warn(`No transcript found for chapter: ${chapterName}, skipping`);
      continue;
    }

    console.log(
      `Found transcript with ${transcript.segmentCount} segments, ${transcript.text.length} characters`
    );

    try {
      // Analyze transcript to identify scenes
      const sceneAnalysis = await analyzeTranscriptScenes(
        options.book,
        chapterName,
        transcript.text
      );

      // Save results
      const outputPath = saveSceneAnalysis(chapterDir, sceneAnalysis);
      console.log(`Identified ${sceneAnalysis.sceneCount} scenes`);
      console.log(`Saved scene analysis to: ${outputPath}`);
    } catch (error) {
      console.error(
        `Error analyzing scenes for chapter ${chapterName}:`,
        error
      );
    }
  }

  const duration = timer.stop();
});

// Execute if this module is run directly
if (require.main === module) {
  program.parse(process.argv);
}
