import path from 'path';

export const FLAGS = {
  book: {
    flag: "-b, --book <book>",
    description: "Name of the book",
  },
  chapter: {
    flag: "-c, --chapter <chapter>",
    description: "Name of the chapter",
  },
  director: {
    flag: "-d, --director <director>",
    description: "Name of the director, usually 'director-<DATETIME>'",
  },
  shotIds: {
    flag: "-s, --shots <shots>",
    description: "e.g., '1,3,5-100'",
  },
  visual: {
    flag: "-v, --visual <visual>",
    description: "Name of the visual,usually 'visual-<DATETIME>'",
  },
};

/**
 * Generate a range of numbers from start to end (inclusive)
 */
function generateRange(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

/**
 * Parse a range expression (e.g., "1-5" or "-5" or "1-")
 */
function parseRange(allIds: number[], range: string): number[] {
  const parts = range.split("-");
  if (parts.length !== 2) throw new Error(`Invalid range syntax: ${range}`);

  let start = 0;
  let end = Math.max(...allIds);

  // Parse start and end
  if (parts[0]) {
    start = parseInt(parts[0].trim());
    if (isNaN(start)) throw new Error(`Invalid start ID: ${parts[0]}`);
  }

  if (parts[1]) {
    end = parseInt(parts[1].trim());
    if (isNaN(end)) throw new Error(`Invalid end ID: ${parts[1]}`);
  }

  // Generate range and filter by valid IDs
  return generateRange(start, end).filter(id => allIds.includes(id));
}

/**
 * Parse an ID string into an array of numbers.
 * Supports:
 * - Comma-separated values (e.g., "1,2,3")
 * - Range syntax within comma-separated parts (e.g., "1-5,7,9-11")
 * - Open-ended ranges (e.g., "-5" or "1-")
 * 
 * @param allIds - Array of all valid IDs to filter against
 * @param input - String input to parse
 * @returns Array of valid IDs that match the input pattern
 */
export function parseIds(allIds: number[], input?: string): number[] {
  if (!input) {
    return allIds;
  }

  // Split by commas first
  const parts = input.split(",").map((p) => p.trim());

  // Process each part and flatten the results
  const result = parts.flatMap((part) => {
    if (part.includes("-")) {
      return parseRange(allIds, part);
    } else {
      const num = parseInt(part);
      if (isNaN(num)) throw new Error(`Invalid ID: ${part}`);
      if (!allIds.includes(num)) {
        console.warn(`Warning: ID ${num} not found in valid IDs, skipping`);
        return [];
      }
      return [num];
    }
  });

  // Remove duplicates and sort
  return [...new Set(result)].sort((a, b) => a - b);
}

/**
 * Get the visual directory path
 */
export function getVisualDir(book: string, chapter: string, visual: string): string {
  return path.join('audiobooks', book, chapter, visual);
}
