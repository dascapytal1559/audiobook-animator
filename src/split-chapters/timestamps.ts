/**
 * Converts a timestamp string (HH:MM:SS or MM:SS) to seconds
 * @param timestamp Timestamp string in format "HH:MM:SS" or "MM:SS"
 * @returns Total seconds
 */
function timestampToSeconds(timestamp: string): number {
  const parts = timestamp.split(':').map(part => parseInt(part, 10));
  
  if (parts.length === 3) {
    // HH:MM:SS format
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    // MM:SS format
    return parts[0] * 60 + parts[1];
  }
  
  throw new Error(`Invalid timestamp format: ${timestamp}`);
}

/**
 * Converts seconds to a timestamp string
 * @param seconds Total seconds
 * @returns Timestamp string in format "HH:MM:SS" or "MM:SS" if hours is 0
 */
function secondsToTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

/**
 * Adds two timestamp strings together
 * @param timestamp1 First timestamp string in format "HH:MM:SS" or "MM:SS"
 * @param timestamp2 Second timestamp string in format "HH:MM:SS" or "MM:SS"
 * @returns Sum of timestamps in appropriate format
 * 
 * @example
 * // Returns "01:07:35"
 * addTimestamps("00:20", "01:07:15");
 */
export function addTimestamps(timestamp1: string, timestamp2: string): string {
  const seconds1 = timestampToSeconds(timestamp1);
  const seconds2 = timestampToSeconds(timestamp2);
  const totalSeconds = seconds1 + seconds2;
  
  return secondsToTimestamp(totalSeconds);
}

/**
 * Parses a timestamp string in different formats and returns total seconds
 * Supports: "HH:MM:SS", "MM:SS", and "SS"
 */
export function parseTimestamp(timestamp: string): number {
  const parts = timestamp.trim().split(':').map(part => parseInt(part, 10));
  
  if (parts.length === 3) {
    // HH:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    // MM:SS
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    // SS
    return parts[0];
  }
  
  throw new Error(`Invalid timestamp format: ${timestamp}`);
}

/**
 * Formats seconds into the most appropriate timestamp format
 * Will use HH:MM:SS if hours > 0, MM:SS if minutes > 0, or SS otherwise
 */
export function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else if (minutes > 0) {
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return secs.toString().padStart(2, '0');
  }
}
