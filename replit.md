# ScribeAI - Session Transcription & Analysis Platform

## Overview

ScribeAI is a full-stack web application designed to process session/meeting audio recordings. It leverages AI to generate transcriptions, summaries, action items, and topic analysis. Users can upload audio files or record directly in the browser. The platform aims to streamline post-session workflows by automating the extraction of key information.

**UI Terminology**: All user-facing text uses "session/sessions" instead of "meeting/meetings". The underlying code (variable names, database columns, API routes) still uses "meeting" internally.

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
- **Audio Recording**: Auto-detects supported MIME types (WebM/Opus preferred, MP4/AAC fallback for iOS Safari). Server converts all non-WAV formats (WebM, MP4, M4A, OGG, AAC, CAF) to WAV via ffmpeg before storage. Includes periodic auto-save of recording chunks to IndexedDB every 5 seconds for resilience against iOS Safari call interruptions, with recovery UI on both QuickRecord and NewMeeting pages. **IndexedDB stores chunks as ArrayBuffer[] (not Blob[])** to avoid iOS Safari's known bug where Blobs become unreadable after page reload — ArrayBuffers survive round-trips reliably. Recording button features audio-reactive animation that pulses based on real-time microphone input volume. Robust iOS PWA error handling: checks `navigator.mediaDevices` availability, classifies `getUserMedia` errors by type (permission denied, not found, not readable, aborted), shows persistent error banners with actionable guidance (upload alternative), and reports client-side errors to server via `POST /api/client-errors` for deployment log visibility. Upload flow validates blob size (>100 bytes) before GCS PUT and reports all upload failures to server via `reportError()`. **Auto-restart on interruption**: When MediaRecorder fires `onerror`, the current chunks are saved as a "segment" to a dedicated `recording-segments` IndexedDB store, and a new MediaRecorder is automatically started. Multiple segments are combined into a single audio blob on stop. UI shows segment count and auto-restart banner. Key files: `client/src/replit_integrations/audio/useVoiceRecorder.ts`, `client/src/lib/logError.ts`, `client/src/lib/offlineDb.ts`.
- **Session Merge**: Users can merge multiple sessions into one from the Dashboard. Enter merge mode via the "Merge" toolbar button or "Merge with..." in a session's context menu. Select 2+ sessions with checkboxes, then choose a primary session in the merge dialog. Transcripts, action items, and topics from source sessions are combined into the primary session, source sessions are deleted, and the merged session is automatically reprocessed by AI. API: `POST /api/meetings/:id/merge` with `{ sourceIds: number[] }`. Key files: `client/src/components/MergeDialog.tsx`, `client/src/pages/Dashboard.tsx`, `server/routes.ts`.
- **Upload Retry**: If audio upload fails after meeting creation (e.g. GCS PUT failure), the meeting ID is preserved in state (`failedMeetingId`) and the user can retry without creating a duplicate meeting. On MeetingDetail, meetings stuck in "uploading" or "failed" with no audio show a re-upload card with file picker and "Upload & Process" button. On NewMeeting, a persistent red "Upload failed" inline banner appears when `failedMeetingId` is set, guiding the user to tap "Process Session" to retry. Server-side `cleanupStaleUploads()` auto-marks meetings stuck in "uploading" for >30 minutes as "failed" on startup and periodically.
- **Recording Recovery Awareness**: Shared `useHasRecoverableRecording()` hook (`client/src/hooks/use-recovery.ts`) provides reactive recovery state across all components via a listener pattern. Dashboard shows a blue "Interrupted recording found" banner with navigation buttons to Quick Record or New Session plus a Discard option. Navigation shows a pulsing blue dot on the Quick Record icon when recoverable data exists. Recovery state syncs instantly when recordings are recovered, discarded, or cleared via `invalidateRecoveryState()`.
- **Audio Visualization**: WaveSurfer.js for waveform display and playback
- **Offline Support**: IndexedDB for offline audio recording storage and a Service Worker for PWA capabilities and offline access.
- **UI/UX**: Support for tile and list views on key pages, with preference persistence.
- **Landing Page**: Public marketing homepage at `/` for unauthenticated users (Stitch Express-inspired design). Includes hero, features, pricing (R199/month with 1-month free trial), FAQ accordion, security section, and footer with legal page links. Authenticated users at `/` see the Dashboard. Legal pages: `/privacy-policy`, `/terms-of-use`, `/paia-manual`, `/terms-and-conditions` (all public). **Tenant-aware**: All brand names, taglines, logos, and accent colors are dynamically sourced from `TenantContext` via the `useBrandColors()` hook — defaults to "ScribeAI" with amber palette when no tenant branding is set. Custom tenant domains get their own branded landing page with the same layout. Key files: `client/src/pages/LandingPage.tsx`, `client/src/pages/legal/`.

### Backend Architecture
- **Framework**: Express 5 on Node.js with TypeScript
- **API Pattern**: RESTful endpoints with Zod for validation
- **Authentication**: Session-based authentication with bcrypt hashing, email verification, and password reset flow.
- **Authorization**: Role-based access control (Superuser, Admin, standard users) and subscription-based feature gating.
- **File Uploads**: Multer for audio file handling.
- **AI Processing**: Integration with OpenAI API for speech-to-text, summarization, action item extraction, and topic analysis. Core processing logic extracted into `server/processMeeting.ts` (`processMeetingCore()`) — shared by the process route, reprocess route, and auto-retry system. Supports Afrikaans output with translated section headers in default template.
- **Processing Resilience**: `retryStaleProcessing()` in `server/migrations.ts` auto-detects meetings stuck in "processing" status for >5 minutes (e.g., interrupted by server restart during deployment) and retries them automatically. Runs on server startup and every 5 minutes. Meetings with no audio or transcript are marked as "failed".
- **Email**: Resend integration for transactional emails.
- **Subscription Management**: PayFast integration for recurring payments and webhook processing.
- **User Roles**: System for defining and assigning roles, including custom roles, with role information captured during meeting creation for AI context.
- **Templates & Context**: System for defining AI summary templates (superuser-only CRUD) with many-to-many tenant assignment via `template_tenants` junction table. Templates page (`/templates`) is superuser-only with sorting, filtering by tenant/name, and tenant assignment checkboxes. Users can provide additional context (text or file) for AI processing.
- **Internal Meeting Flag**: Meetings can be marked as "Internal Meeting" (internal discussion/dictation without the client present). When checked, the AI is instructed not to look for client responses and frames the summary as internal notes.
- **Transcript Upload**: Users can paste transcript text directly or upload a text file (.txt, .md, .csv, .json) instead of audio. The transcript is saved via `POST /api/meetings/:id/transcript` and the process route skips audio transcription when a transcript already exists.
- **Audio Language**: Meetings have an `audioLanguage` field (default: "auto") separate from `outputLanguage`. Set to "af" for South African Afrikaans/English code-switching to prevent Whisper from mis-transcribing Afrikaans as Dutch. The language hint is passed to `transcribeLongAudio()` and then to `speechToText()` as the Whisper `language` parameter. Changing `audioLanguage` via Edit & Regenerate automatically clears the existing transcript so it gets re-transcribed with the new language hint. Users have a `defaultAudioLanguage` preference (stored on users table, default "af") that pre-fills the audio language selector on New Session and Quick Record pages. Editable in Settings page under "Recording Defaults" card via `PATCH /api/users/me/preferences`.

### Multi-Tenancy
- **Model**: Shared database with `tenantId` foreign key on all data tables (users, clients, meetings, templates, roles)
- **Tenant Table**: `tenants` table with fields: id, name, slug (unique), domain (unique, nullable), logoUrl, primaryColor, accentColor, tagline, isActive, createdAt
- **Tenant Resolution**: Middleware in `server/tenant.ts` resolves tenant from `req.hostname` — matches against `domain` field, falls back to default tenant (id=1, slug="default"). In-memory cache with 60s TTL, invalidated on tenant writes via `invalidateTenantCache()`.
- **Data Isolation**: All storage queries accept optional `tenantId` for scoping. User-facing routes pass `req.tenant.id`. Superuser routes optionally bypass tenant scoping.
- **Auth Enforcement**: `requireAuth` middleware checks `user.tenantId === req.tenant.id` (superusers exempt). Login scopes `getUserByEmail` by tenant. Registration assigns new users to `req.tenant.id`.
- **Frontend Branding**: `TenantContext` (`client/src/contexts/TenantContext.tsx`) fetches branding from `GET /api/tenant/branding` (public endpoint). Dynamically updates page title, CSS custom properties (`--primary`, `--accent`), and branding in Login, Register, and Navigation components.
- **Tenant Management**: Superuser-only CRUD at `/api/tenants`. UI in SuperuserAdmin.tsx "Tenants" tab with create/edit/delete dialogs.
- **Email**: Verification and password reset emails use tenant name in sender, subject, and body.
- **Key files**: `server/tenant.ts` (middleware), `client/src/contexts/TenantContext.tsx` (frontend context), SuperuserAdmin.tsx (management UI)

### Data Layer
- **Database**: PostgreSQL with Drizzle ORM
- **Core Tables**: `tenants`, `users`, `clients`, `meetings`, `templates`, `template_tenants`, `transcripts`, `action_items`, `topics`, `meeting_summaries`.
- **Schema**: Defined in `shared/schema.ts`.
- **Migrations**: Drizzle Kit.

### Key Design Patterns
- **Shared Types**: `shared/` folder for common frontend/backend definitions.
- **Storage Abstraction**: `server/storage.ts` for database operations.
- **Status State Machine**: For tracking meeting processing status (`uploading`, `processing`, `completed`/`failed`).
- **Polling**: Frontend polls for meeting status updates.
- **Ownership Checks**: Enforced on all routes for data isolation. Combined with tenant scoping for multi-tenant security.

### Build Configuration
- **Development**: `tsx` and Vite for HMR.
- **Production**: esbuild for server bundling, Vite for frontend build.

## External Dependencies

### AI Services
- **OpenAI API** (via Replit AI Integrations): Speech-to-text, text generation (summaries, action items, topics).

### Payment
- **PayFast**: Subscription payments, including checkout and ITN webhook processing.
- **Stripe** (via Replit Integration): Alternative payment option for card payments. Uses Stripe Checkout for subscriptions, with webhook handling for status updates. Both PayFast and Stripe feed into the same `subscriptionStatus` system on the `users` table.
  - Key files: `server/stripeClient.ts` (client/credentials), `server/webhookHandlers.ts` (webhook processing)
  - Routes: `POST /api/stripe/checkout`, `POST /api/stripe/webhook`, `POST /api/stripe/cancel`
  - DB fields: `stripe_customer_id`, `stripe_subscription_id` on users table
  - Subscription status endpoint (`/api/subscription/status`) returns `provider` field ("payfast", "stripe", or "none")

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