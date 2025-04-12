export class ElapsedTimer {
  private startTime: number;
  private timerInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startTime = Date.now();
    this.timerInterval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
      process.stdout.write(`\rElapsed time: ${elapsedSeconds}s`);
    }, 1000);
  }

  stop() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    const elapsedSeconds = (Date.now() - this.startTime)/1000;
    console.log(`\rCompleted in ${elapsedSeconds.toFixed(1)} seconds`);
    return elapsedSeconds;
  }
} 

export class CliTimer {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  stop() {
    const elapsedSeconds = (Date.now() - this.startTime)/1000;
    console.log(`\nProgram completed in ${elapsedSeconds.toFixed(1)} seconds`);
    return elapsedSeconds;
  }
} 