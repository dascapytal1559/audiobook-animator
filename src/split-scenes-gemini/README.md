# Split Scenes with Gemini

This module uses Google's Gemini AI to analyze audiobook files and break them down into distinct scenes with timestamps.

## Features

- Analyzes audio files using Gemini AI
- Identifies natural scene boundaries in a story
- Provides start and end timestamps for each scene
- Includes brief descriptions of each scene
- Outputs results in JSON format

## Prerequisites

- Node.js and npm installed
- Google Cloud account with access to Gemini API
- `GEMINI_API_KEY` environment variable set

## Usage

Run the module from the project root directory:

```bash
# Process all chapters in a book
npx ts-node src/split-scenes-gemini/cli.ts --book "book_name" --chapters "all"

# Process specific chapters
npx ts-node src/split-scenes-gemini/cli.ts --book "book_name" --chapters "1,3,5-10"

# Process specific chunks within specified chapters
npx ts-node src/split-scenes-gemini/cli.ts --book "book_name" --chapters "1,3,5-10" --chunks "1,3,5"
```

Note: The `--book` and `--chapters` flags are required. If existing scene files are found, they will be automatically overwritten.

## Output

The module creates a `scenes.json` file in each chapter directory with the following format:

```json
[
  {
    "id": 1,
    "startTime": 0,
    "endTime": 120,
    "description": "Introduction to main character"
  },
  {
    "id": 2,
    "startTime": 120,
    "endTime": 240,
    "description": "Conversation between characters"
  }
]
```

## Integration

This module can be used as part of a pipeline for audiobook visualization, video generation, or chapter segmentation. 