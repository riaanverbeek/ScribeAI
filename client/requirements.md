## Packages
framer-motion | Complex animations and page transitions
recharts | Data visualization for meeting topics and analytics
date-fns | Date formatting for meeting timelines
react-dropzone | Drag and drop file uploads for audio
wavesurfer.js | Audio waveform visualization and playback

## Notes
Tailwind Config - extend fontFamily:
fontFamily: {
  display: ["var(--font-display)"],
  body: ["var(--font-body)"],
}

API expects multipart/form-data for audio uploads at /api/meetings/:id/audio
AI processing is triggered via POST /api/meetings/:id/process
