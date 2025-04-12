# Audibler

## Pipeline

starting with an audiobook
> split into chapters [reworked]
> split into chunks [reworked]
> transcribe chunks
> create scenes
> create image
> animate image
> stitch into video

Base Pipeline (one-time per chapter):
- start with audiobook
- split-chapters
- transcribe-audio

Director Pipeline (can have multiple directors):
- split-sections (creates director-{DATETIME})
- gen-shots
- gen-imgprompts
- gen-images (creates visual-{DATETIME})
- crop-images
- upscale-images
- gen-video

## Directory Structure
```
audiobooks/
  BookName/
    ChapterName/
      chapter.mp3
      transcript.json
      director-02_12-01_28/     # A director's creative take
        sections/
          sections.json
          section0.shots.json
          ...
        shots.json
        imgprompts.json
        visual-02_12-01_28/     # A visual interpretation
          images4/             # Raw 4-variation images
          cropped-images/      # Selected variations
            crop-config.json
          upscaled/           # Upscaled versions
          video.mp4
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory with your API keys:
```
OPENAI_API_KEY=
DISCORD_TOKEN=
DISCORD_SERVER_ID=
DISCORD_CHANNEL_ID=
```