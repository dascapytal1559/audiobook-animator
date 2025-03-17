/**
 * Parse a timestamp string in format HH:MM:SS or MM:SS into total seconds
 */
export function parseTimestamp(timestamp: string): number {
  const parts = timestamp.split(":").map(Number);
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return minutes * 60 + seconds;
  } else {
    throw new Error(`Invalid timestamp format: ${timestamp}`);
  }
}
