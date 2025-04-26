1. break a book down into

2. break a chapter into chunks to improve iteration speed

3. transcribe chunk into:
  - scenes
    - description
    - sentences
      - text
      - timestamp
      
(we know we need prompt context here, we might need the sentences to be prompt context)

4. analyse scene description and each sentence to generate:
  - midjourney prompt
  - runway shot description
  
- send prompt to midjourney to get images
- crop midjourney images
- [MAYBE] upscale image
- send image to runway to get video
- send videos with timestamps to ffmpeg to get video


//

- audiobook
- chapter
- chunk
- scenes and shots
- prompt
- image
- clip
- video