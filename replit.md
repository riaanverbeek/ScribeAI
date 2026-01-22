# ScribeAI - Meeting Transcription & Analysis Platform

## Overview

ScribeAI is a full-stack web application that processes meeting audio recordings to generate transcriptions, summaries, action items, and topic analysis using AI. Users can upload audio files or record directly in the browser, then the system processes the audio through speech-to-text and AI analysis pipelines.

The application follows a monorepo structure with a React frontend, Express backend, and PostgreSQL database, all configured for deployment on Replit.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state, local React state for UI
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style)
- **Build Tool**: Vite with path aliases (`@/` for client, `@shared/` for shared code)
- **Animations**: Framer Motion for transitions
- **Audio**: WaveSurfer.js for waveform visualization and playback

### Backend Architecture
- **Framework**: Express 5 on Node.js with TypeScript
- **API Pattern**: RESTful endpoints defined in `shared/routes.ts` with Zod schemas for validation
- **File Uploads**: Multer for handling audio file uploads to `uploads/` directory
- **AI Processing**: OpenAI API integration via Replit AI Integrations for:
  - Speech-to-text transcription
  - Meeting summarization
  - Action item extraction
  - Topic analysis

### Data Layer
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` defines all tables
- **Migrations**: Drizzle Kit with `db:push` command
- **Core Tables**:
  - `meetings` - Meeting metadata and status tracking
  - `transcripts` - Full transcription text
  - `action_items` - Extracted tasks with assignees
  - `topics` - Identified discussion topics with relevance scores
  - `meeting_summaries` - AI-generated executive summaries
  - `conversations`/`messages` - Chat functionality for Replit integrations

### Key Design Patterns
- **Shared Types**: Schema and route definitions in `shared/` folder are used by both frontend and backend
- **Storage Abstraction**: `server/storage.ts` implements `IStorage` interface for database operations
- **Status State Machine**: Meetings progress through `uploading` → `processing` → `completed`/`failed`
- **Polling**: Frontend polls every 2 seconds for meetings in `processing` or `uploading` status

### Build Configuration
- **Development**: `tsx` runs TypeScript directly, Vite handles frontend HMR
- **Production**: esbuild bundles server to `dist/index.cjs`, Vite builds frontend to `dist/public`
- **Server Bundling**: Common dependencies are bundled to reduce cold start times (see `script/build.ts` allowlist)

## External Dependencies

### AI Services
- **OpenAI API** (via Replit AI Integrations): Used for speech-to-text, text generation, and image generation
- **Environment Variables Required**:
  - `AI_INTEGRATIONS_OPENAI_API_KEY`
  - `AI_INTEGRATIONS_OPENAI_BASE_URL`

### Database
- **PostgreSQL**: Connection via `DATABASE_URL` environment variable
- **Session Storage**: `connect-pg-simple` for Express sessions (if authentication added)

### Audio Processing
- **ffmpeg**: Required system dependency for converting WebM audio (from browser recording) to WAV format for API processing

### Replit Integrations
Pre-built integration modules in `server/replit_integrations/`:
- `audio/` - Speech-to-text, text-to-speech, voice chat
- `chat/` - Conversation storage and OpenAI chat completions
- `image/` - Image generation with gpt-image-1
- `batch/` - Rate-limited batch processing utilities

### Frontend Libraries
- **wavesurfer.js**: Audio waveform visualization
- **framer-motion**: Page transitions and animations
- **date-fns**: Date formatting
- **recharts**: Data visualization (available for analytics)