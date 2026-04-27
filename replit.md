# ScribeAI - Session Transcription & Analysis Platform

## Overview

ScribeAI is a full-stack web application designed to process session/meeting audio recordings. It leverages AI to generate transcriptions, summaries, action items, and topic analysis. Users can upload audio files or record directly in the browser. The platform aims to streamline post-session workflows by automating the extraction of key information. The project uses a monorepo structure, combining a React frontend, an Express backend, and a PostgreSQL database, all optimized for deployment on Replit.

## User Preferences

Preferred communication style: Simple, everyday language.

Auto-push to GitHub: After every code change or session, all changes should be automatically pushed to GitHub without prompting the user.

Responsiveness: Every screen — whether newly developed or modified — must be fully responsive across all device sizes: desktop, tablet, and mobile. Use Tailwind responsive prefixes (sm:, md:, lg:, xl:) throughout. Never ship a screen that only works at one viewport size. No horizontal overflow is ever acceptable on any screen or device size. Always apply `min-w-0` to flex children that may contain long content, `overflow-x-hidden` to scroll containers, and test on narrow viewports before considering a layout complete.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, Wouter for routing, TanStack React Query for server state.
- **Styling**: Tailwind CSS with shadcn/ui components.
- **Build Tool**: Vite.
- **Animations**: Framer Motion.
- **Audio Recording**: Robust in-browser recording with auto-detection of MIME types, server-side conversion to WAV via ffmpeg, and periodic auto-save to IndexedDB for resilience. Includes auto-restart on recording interruptions and a recovery awareness system.
- **Session Merge**: Users can merge multiple sessions, combining their data and reprocessing by AI.
- **Upload Retry**: Mechanism to retry failed audio uploads without creating duplicate sessions.
- **Audio Visualization**: WaveSurfer.js for waveform display.
- **Offline Support**: IndexedDB for offline audio storage and a Service Worker for PWA capabilities.
- **UI/UX**: Support for tile and list views with preference persistence.
- **Landing Page**: Public marketing homepage with features, pricing, FAQ, and legal pages. It is multi-tenant aware, dynamically sourcing branding via `TenantContext`.

### Backend Architecture
- **Framework**: Express 5 on Node.js with TypeScript.
- **API Pattern**: RESTful endpoints with Zod for validation.
- **Authentication**: Session-based authentication with bcrypt, email verification, and password reset.
- **Authorization**: Role-based access control (Superuser, Admin, standard users) and subscription-based feature gating.
- **File Uploads**: Multer for audio file handling.
- **AI Processing**: Integration with OpenAI API for speech-to-text, summarization, action items, and topic analysis, with core logic in `server/processMeeting.ts`. Supports Afrikaans output.
- **Processing Resilience**: Automatic retry for meetings stuck in "processing" status.
- **Email**: Resend integration for transactional emails.
- **Subscription Management**: PayFast integration for recurring payments and webhooks.
- **User Roles**: System for defining and assigning roles.
- **Templates & Context**: AI summary templates (superuser-only CRUD) with tenant assignment. Users can provide additional context for AI processing.
- **Internal Meeting Flag**: Option to mark meetings as "Internal" to guide AI processing.
- **Transcript Upload**: Users can upload text transcripts instead of audio.
- **Audio Language**: `audioLanguage` field to specify language for transcription, separate from `outputLanguage`.

### Multi-Tenancy
- **Model**: Shared database with `tenantId` foreign key.
- **Tenant Table**: Stores tenant details (name, slug, domain, branding).
- **Tenant Resolution**: Middleware resolves tenant from `req.hostname`.
- **Data Isolation**: All storage queries are scoped by `tenantId`.
- **Auth Enforcement**: `requireAuth` middleware enforces tenant-specific user access.
- **Frontend Branding**: `TenantContext` dynamically updates UI branding based on the tenant.
- **Tenant Management**: Superuser-only CRUD for tenants.

### Data Layer
- **Database**: PostgreSQL with Drizzle ORM.
- **Core Tables**: `tenants`, `users`, `clients`, `meetings`, `templates`, `transcripts`, `action_items`, `topics`, `meeting_summaries`, `audio_language_options`, `prompt_settings`, `system_settings`.
- **Schema**: Defined in `shared/schema.ts`.
- **Migrations**: Runtime SQL migrations on server startup.
- **Prompt Settings**: `prompt_settings` table stores LLM prompts, configurable via Superuser UI.
- **System Settings**: `system_settings` table stores configurable model keys.
- **Superuser UIs**: Admin interfaces for managing prompts, LLM models, and PayFast billing audits.
- **Per-template Analysis Model**: Allows overriding the global default analysis model on a per-template basis.
- **LLM Registry**: `server/llmRegistry.ts` defines available LLM models.
- **Anthropic Support**: Integration for Anthropic models.
- **Soniox Support**: Integration for Soniox API.

### Key Design Patterns
- **Shared Types**: `shared/` folder for common definitions.
- **Storage Abstraction**: `server/storage.ts` for database operations.
- **Status State Machine**: For tracking meeting processing status.
- **Polling**: Frontend polls for meeting status updates.
- **Ownership Checks**: Enforced on all routes for data isolation.
- **Recording parity rule**: Recording logic in `QuickRecord.tsx` and `NewMeeting.tsx` must always be kept in sync.

### Build Configuration
- **Development**: `tsx` and Vite for HMR.
- **Production**: esbuild for server, Vite for frontend.

## External Dependencies

### AI Services
- **OpenAI API** (via Replit AI Integrations)
- **Anthropic AI**
- **Soniox API**

### Payment
- **PayFast**
- **Stripe** (via Replit Integration)

### Email
- **Resend** (via Replit Integrations)

### Database
- **PostgreSQL**

### Audio Processing
- **ffmpeg**

### Replit Integrations
- **Replit AI Integrations** (audio processing, chat, image generation, batch utilities)

### Frontend Libraries
- **wavesurfer.js**
- **framer-motion**
- **date-fns**
- **recharts**