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
  saveProcessedSceneAnalysis,
  Scene,
  SceneAnalysis,
  ProcessedScene,
  ProcessedSceneAnalysis,
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

/**
 * Matches scene start text with transcript segments to find segment IDs
 * @param scenes Array of scenes from OpenAI analysis
 * @param transcript Complete transcript with segments
 * @returns Processed scene array with segment IDs
 */
function matchScenesWithSegments(
  sceneAnalysis: SceneAnalysis,
  transcript: {
    segmentCount: number;
    segments: { id: number; start: number; end: number; text: string }[];
  }
): ProcessedSceneAnalysis {
  console.log("Matching scenes with transcript segments...");
  
  const processedScenes: ProcessedScene[] = [];
  
  // Process each scene to find matching segment
  for (let i = 0; i < sceneAnalysis.scenes.length; i++) {
    const scene = sceneAnalysis.scenes[i];
    let originalStartText = scene.startText;
    let startText = originalStartText;
    let startSegId: number | null = null;
    
    // Try to find exact match first
    while (startText.length > 0 && startSegId === null) {
      // Look for segments that include the startText
      const matchingSegments = transcript.segments.filter(seg => 
        seg.text.includes(startText)
      );
      
      if (matchingSegments.length === 1) {
        // Found a unique match
        startSegId = matchingSegments[0].id;
      } else if (matchingSegments.length > 1) {
        // Multiple matches, halve the startText and try again
        const newLength = Math.floor(startText.length / 2);
        if (newLength === 0) {
          // We've reached a single character and still have multiple matches
          throw new Error(`Multiple matches found for scene ${scene.id}: "${originalStartText}"`);
        }
        startText = startText.substring(0, newLength);
      } else {
        // No matches, halve the startText and try again
        const newLength = Math.floor(startText.length / 2);
        if (newLength === 0) {
          // We've reached a single character and still have no matches
          throw new Error(`No match found for scene ${scene.id}: "${originalStartText}"`);
        }
        startText = startText.substring(0, newLength);
      }
    }
    
    if (startSegId === null) {
      throw new Error(`Could not find matching segment for scene ${scene.id}`);
    }
    
    // For endSegId - use the startSegId of the next scene minus 1, or the last segment if it's the last scene
    let endSegId: number | undefined;
    if (i < sceneAnalysis.scenes.length - 1) {
      // This is not the last scene, so find the next scene's startSegId
      const nextScene = sceneAnalysis.scenes[i + 1];
      let nextStartText = nextScene.startText;
      let nextStartSegId: number | null = null;
      
      // Try to find exact match for next scene
      while (nextStartText.length > 0 && nextStartSegId === null) {
        const matchingSegments = transcript.segments.filter(seg => 
          seg.text.includes(nextStartText)
        );
        
        if (matchingSegments.length === 1) {
          nextStartSegId = matchingSegments[0].id;
        } else if (matchingSegments.length > 1) {
          const newLength = Math.floor(nextStartText.length / 2);
          if (newLength === 0) break;
          nextStartText = nextStartText.substring(0, newLength);
        } else {
          const newLength = Math.floor(nextStartText.length / 2);
          if (newLength === 0) break;
          nextStartText = nextStartText.substring(0, newLength);
        }
      }
      
      if (nextStartSegId !== null) {
        // Found the next segment, this scene ends at the previous segment
        endSegId = nextStartSegId - 1;
      }
    } else {
      // This is the last scene, so it ends at the last segment
      endSegId = transcript.segments[transcript.segments.length - 1].id;
    }
    
    // Calculate segment count, start time, end time, and duration
    const finalEndSegId = endSegId || transcript.segments[transcript.segments.length - 1].id;
    
    // Find the start segment by ID
    const startSegment = transcript.segments.find(seg => seg.id === startSegId);
    if (!startSegment) {
      throw new Error(`Could not find start segment with ID ${startSegId} for scene ${scene.id}`);
    }
    
    // Find the end segment by ID
    const endSegment = transcript.segments.find(seg => seg.id === finalEndSegId);
    if (!endSegment) {
      throw new Error(`Could not find end segment with ID ${finalEndSegId} for scene ${scene.id}`);
    }
    
    // Calculate segment count (inclusive of start and end)
    const segCount = finalEndSegId - startSegId + 1;
    
    // Calculate timing information
    const startTime = startSegment.start;
    const endTime = endSegment.end;
    const duration = endTime - startTime;
    
    // Add the processed scene with segment IDs and timing data
    processedScenes.push({
      ...scene,
      startSegId,
      endSegId,
      segCount,
      startTime,
      endTime,
      duration,
    });
  }
  
  return {
    bookName: sceneAnalysis.bookName,
    chapterName: sceneAnalysis.chapterName,
    sceneCount: processedScenes.length,
    scenes: processedScenes,
  };
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

      // Save raw results
      const outputPath = saveSceneAnalysis(chapterDir, sceneAnalysis);
      console.log(`Identified ${sceneAnalysis.sceneCount} scenes`);
      console.log(`Saved raw scene analysis to: ${outputPath}`);
      
      // Process scenes to add segment IDs
      const processedSceneAnalysis = matchScenesWithSegments(sceneAnalysis, transcript);
      
      // Save processed results
      const processedOutputPath = saveProcessedSceneAnalysis(chapterDir, processedSceneAnalysis);
      console.log(`Processed ${processedSceneAnalysis.sceneCount} scenes with segment IDs`);
      console.log(`Saved processed scene analysis to: ${processedOutputPath}`);
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
