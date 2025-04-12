export function parseTimestamp(timestamp: string): number {
  const parts = timestamp.split(":").map(Number);
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return minutes * 60 + seconds;
  } else if (parts.length === 1) {
    const [seconds] = parts;
    return seconds;
  } else {
    throw new Error(`Invalid timestamp format: ${timestamp}`);
  }
}

export function addDuration(timestamp: string, duration: string): string {
  const startSeconds = parseTimestamp(timestamp);
  const durationSeconds = parseTimestamp(duration);
  const totalSeconds = startSeconds + durationSeconds;
  const resultHours = Math.floor(totalSeconds / 3600);
  const remainingSeconds = totalSeconds % 3600;
  const resultMinutes = Math.floor(remainingSeconds / 60);
  const resultSeconds = remainingSeconds % 60;
  
  return `${String(resultHours).padStart(2, '0')}:${String(resultMinutes).padStart(2, '0')}:${String(resultSeconds).padStart(2, '0')}`;
}
  

