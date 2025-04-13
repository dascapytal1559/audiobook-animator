import path from 'path';
import * as fs from 'fs';

export const FLAGS = {
  book: {
    flag: "-b, --book <book>",
    description: "Name of the book",
  },
  chapters: {
    flag: "-c, --chapters <chapters>",
    description: "Chapter indices to process (e.g., '1,3,5-10')",
  },
  chunks: {
    flag: "-k, --chunks <chunks>",
    description: "Chunk indices to process (e.g., '1,3,5-10')",
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

export function parseBookDir(bookName?: string): string {
  // if empty, return audiobooks/Stories_of_Your_Life_and_Others
  if (!bookName) {
    bookName = 'Stories_of_Your_Life_and_Others';
  }
  return path.join('audiobooks', bookName);
}

/**
 * Gets the full paths for selected chapter directories based on input.
 * @param book The name of the book.
 * @param chaptersInput The chapter selection string (e.g., '1,3,5-10').
 * @returns An array of full paths to the selected chapter directories.
 */
export function parseChapterDirs(bookDir: string, chaptersInput?: string): string[] {
  if (!fs.existsSync(bookDir)) {
    console.error(`Error: Book directory not found at ${bookDir}`);
    return [];
  }

  let chapterDirs: { index: number; name: string; }[] = [];
  try {
    const dirents = fs.readdirSync(bookDir, { withFileTypes: true });
    chapterDirs = dirents
      .filter(dirent => dirent.isDirectory())
      .map(dirent => {
        // Assuming chapter dir format is index_title (e.g., 0_Introduction)
        const match = dirent.name.match(/^(\d+)_/);
        return match ? { index: parseInt(match[1], 10), name: dirent.name } : null;
      })
      .filter((dir): dir is { index: number; name: string; } => dir !== null)
      .sort((a, b) => a.index - b.index);

  } catch (error) {
    console.error(`Error reading book directory ${bookDir}:`, error);
    return [];
  }

  if (chapterDirs.length === 0) {
    console.warn(`Warning: No valid chapter directories found in ${bookDir}`);
    return [];
  }

  const allChapterIndices = chapterDirs.map(dir => dir.index);
  const selectedIndices = parseIds(allChapterIndices, chaptersInput);

  // Create a map for quick lookup
  const chapterDirMap = new Map(chapterDirs.map(dir => [dir.index, dir.name]));

  // Get the full paths for selected chapters
  return selectedIndices
    .map(index => chapterDirMap.get(index))
    .filter((name): name is string => name !== undefined) // Filter out undefined (shouldn't happen if parseIds is correct)
    .map(name => path.join(bookDir, name));
}
