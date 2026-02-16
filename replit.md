# ScribeAI - Meeting Transcription & Analysis Platform

## Overview

ScribeAI is a full-stack web application designed to process meeting audio recordings. It leverages AI to generate transcriptions, summaries, action items, and topic analysis. Users can upload audio files or record directly in the browser. The platform aims to streamline post-meeting workflows by automating the extraction of key information.

The project uses a monorepo structure, combining a React frontend, an Express backend, and a PostgreSQL database, all optimized for deployment on Replit.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack React Query for server state, local React state for UI
- **Styling**: Tailwind CSS with shadcn/ui components
- **Build Tool**: Vite
- **Animations**: Framer Motion
- **Audio Visualization**: WaveSurfer.js for waveform display and playback
- **Offline Support**: IndexedDB for offline audio recording storage and a Service Worker for PWA capabilities and offline access.
- **UI/UX**: Support for tile and list views on key pages, with preference persistence.

### Backend Architecture
- **Framework**: Express 5 on Node.js with TypeScript
- **API Pattern**: RESTful endpoints with Zod for validation
- **Authentication**: Session-based authentication with bcrypt hashing, email verification, and password reset flow.
- **Authorization**: Role-based access control (Superuser, Admin, standard users) and subscription-based feature gating.
- **File Uploads**: Multer for audio file handling.
- **AI Processing**: Integration with OpenAI API for speech-to-text, summarization, action item extraction, and topic analysis.
- **Email**: Resend integration for transactional emails.
- **Subscription Management**: PayFast integration for recurring payments and webhook processing.
- **User Roles**: System for defining and assigning roles, including custom roles, with role information captured during meeting creation for AI context.
- **Templates & Context**: System for defining AI summary templates and allowing users to provide additional context (text or file) for AI processing.

### Data Layer
- **Database**: PostgreSQL with Drizzle ORM
- **Core Tables**: `users`, `clients`, `meetings`, `templates`, `transcripts`, `action_items`, `topics`, `meeting_summaries`.
- **Schema**: Defined in `shared/schema.ts`.
- **Migrations**: Drizzle Kit.

### Key Design Patterns
- **Shared Types**: `shared/` folder for common frontend/backend definitions.
- **Storage Abstraction**: `server/storage.ts` for database operations.
- **Status State Machine**: For tracking meeting processing status (`uploading`, `processing`, `completed`/`failed`).
- **Polling**: Frontend polls for meeting status updates.
- **Ownership Checks**: Enforced on all routes for data isolation.

### Build Configuration
- **Development**: `tsx` and Vite for HMR.
- **Production**: esbuild for server bundling, Vite for frontend build.

## External Dependencies

### AI Services
- **OpenAI API** (via Replit AI Integrations): Speech-to-text, text generation (summaries, action items, topics).

### Payment
- **PayFast**: Subscription payments, including checkout and ITN webhook processing.

### Email
- **Resend** (via Replit Integrations): Sending verification and other transactional emails.

### Database
- **PostgreSQL**: Primary data store and session storage.

### Audio Processing
- **ffmpeg**: System dependency for audio format conversion.

### Replit Integrations
- **Replit AI Integrations**: Modules for audio processing, chat, image generation, and batch processing utilities.

### Frontend Libraries
- **wavesurfer.js**: Audio waveform visualization.
- **framer-motion**: UI animations.
- **date-fns**: Date manipulation and formatting.
- **recharts**: Data visualization.