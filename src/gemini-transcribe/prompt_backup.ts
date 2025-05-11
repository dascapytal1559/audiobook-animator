// `
// Transcribe this audiobook file accurately, word-for-word.

// Important: The total duration of this audio file is ${duration} seconds (${Math.floor(duration/60)}:${(duration%60).toString().padStart(2, '0')}).
// You MUST make sure all timestamps in your transcription are accurate and correspond to the actual spoken content.

// 1. Present the transcription as an array of sentences each with a start and end time in seconds. 
//   - The first sentence should start at the actual beginning of spoken content.
//   - The last sentence MUST end at or before ${duration} seconds.
//   - DO NOT generate timestamps that exceed the total duration of ${duration} seconds.
//   - If there is silence at the end, note this as a "trailingSilence" value (in seconds).
//   - IMPORTANT: The sum of all sentence durations plus any trailing silence MUST NOT exceed ${duration} seconds.

// 2. Analyse the story and break it into chapters that are distinct in setting or physical location, 
// each scene refers to the starting and ending sentence index, along with matching start and end time in seconds.

// 3. Analyse the story to find ONLY the main characters and their description. 
// Describe their appearance if possible.

// 4. Write a concise storyDescription field summarizing the overall story in 1-3 sentences.

// 5. VALIDATION STEP: Before returning your final response, verify:
//    - No sentence ends after the ${duration} second mark
//    - No scene ends after the ${duration} second mark
//    - The total spoken content + trailing silence matches the total duration
//    - Timestamps are in ascending order with no overlaps

// Return the result as JSON with this format: 

// {
//   "sentences": [
//     {
//       "index": 0,
//       "text": "Sentence text",
//       "startTime": 0.0,
//       "endTime": 5.0,
//     }
//   ],
//   "scenes": [
//     {
//       "description": "Description of the scene",
//       "startSentence": 0,
//       "endSentence": 5,
//       "startTime": 0.0,
//       "endTime": 5.0,
//     }
//   ],
//   "characters": [
//     {
//       "name": "Character name",
//       "description": "Description of the character",
//     }
//   ],
//   "storyDescription": "A concise summary of the overall story.",
//   "trailingSilence": 0.0 // (optional, seconds of silence at the end if present)
// }
// `,