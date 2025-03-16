export class ElapsedTimer {
  private startTime: number;
  private timerInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startTime = Date.now();
  }

  start() {
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
    const elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    console.log(`\nCompleted in ${elapsedSeconds} seconds`);
    return elapsedSeconds;
  }
} 

export class CliTimer {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  start() {
    this.startTime = Date.now();
  }

  stop() {
    return this.getElapsedTime();
  }

  getElapsedTime(): number {
    return Date.now() - this.startTime;
  }
} 