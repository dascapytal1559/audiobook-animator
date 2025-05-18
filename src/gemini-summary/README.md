# Gemini Summary Generator

This module uses Google's Gemini AI to generate comprehensive summaries directly from audiobook audio files.

## Features

- Processes audiobook chapter MP3 files directly using Gemini 2.5 Pro
- Uploads audio to Gemini API and handles processing
- Generates two summary formats:
  - Short summary (2-3 sentences) for quick reference
  - Long summary (500-800 words) with comprehensive details
- Captures main plot events, character developments, themes, and revelations
- Outputs summaries in structured JSON format

## Prerequisites

- Node.js and npm installed
- Google Cloud account with access to Gemini API
- `GEMINI_API_KEY` environment variable set
- MP3 files for the chapters to summarize

## Usage

Run the module from the project root directory:

```bash
# Process all chapters in a book
npx ts-node src/gemini-summary/cli.ts --book "book_name" --chapters "all"

# Process specific chapters
npx ts-node src/gemini-summary/cli.ts --book "book_name" --chapters "1,3,5-10"
```

## Output

The module creates a `summary.json` file in each chapter directory with the following structure:

```json
{
  "shortSummary": "A concise 2-3 sentence summary of the chapter",
  "longSummary": "A comprehensive 500-800 word summary with detailed information",
  "book": "book_name",
  "chapter": "chapter_name",
  "generated": "2023-05-18T14:25:30.000Z"
}
```

## Pipeline Integration

This module is designed to be used as an early stage in the audiobook processing pipeline:

1. Generate summaries directly from audio files
2. Use summaries as context for later stages like scene splitting or image generation
3. Short summaries can be used for quick references, while long summaries provide detailed context

## Requirements

- Requires MP3 files to be present in each chapter directory
- Audio files must be accessible and playable
- Each upload can take time for initial processing (depending on file size)
- Long chapters may take several minutes to process
- Large books with many chapters should be processed in batches 