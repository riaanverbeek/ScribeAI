# ScribeAI - Meeting Transcription & Analysis Platform

## Overview

ScribeAI is a full-stack web application that processes meeting audio recordings to generate transcriptions, summaries, action items, and topic analysis using AI. Users can upload audio files or record directly in the browser, then the system processes the audio through speech-to-text and AI analysis pipelines.

The application follows a monorepo structure with a React frontend, Express backend, and PostgreSQL database, all configured for deployment on Replit.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### Feb 15, 2026 - Quick Record Mode
- New Quick Record page (`client/src/pages/QuickRecord.tsx`) at `/quick-record` for streamlined phone call recording
- Three-phase UI: ready (large record button with instructions), recording (live waveform + timer), saving (title input + client selector)
- Title auto-filled with "Phone Call - [date/time]" format on recording stop
- Optional client assignment before saving
- Full offline support: saves to IndexedDB when offline, auto-syncs when back online
- Added Quick Record button to Dashboard header alongside New Meeting
- Added Quick Record to navigation (Phone icon), available on mobile bottom bar
- Route registered in App.tsx as protected route with Layout

### Feb 15, 2026 - Tile/List View Toggle
- Reusable `useViewMode` hook (`client/src/hooks/use-view-mode.ts`) with localStorage persistence per page
- `ViewToggle` component (`client/src/components/ViewToggle.tsx`) with tile/list buttons
- Dashboard, Clients, and ClientDetail pages support switching between tile (card grid) and compact list (row) views
- View preference stored separately per page (dashboard-view, clients-view, client-detail-view)

### Feb 14, 2026 - Offline Recording & PWA Support
- Added IndexedDB storage for offline audio recordings (`client/src/lib/offlineDb.ts`)
- Offline sync manager auto-uploads pending recordings when back online (`client/src/lib/offlineSync.ts`)
- `useOnlineStatus` hook for reactive connectivity detection (`client/src/hooks/use-offline.ts`)
- `useOfflineRecordings` hook for managing IndexedDB recordings state
- NewMeeting page detects offline state: shows amber banner, saves recordings to IndexedDB with "Save for Later" flow
- Dashboard shows "Saved Offline" section with pending recordings, status badges (pending/syncing/failed), manual retry, delete
- Service worker (`client/public/sw.js`) caches app shell for offline access, serves cached pages when offline
- PWA manifest (`client/public/manifest.json`) enables "Add to Home Screen" on mobile
- Offline fallback HTML page (`client/public/offline.html`) shown when navigating offline without cache
- Service worker registered in `client/src/main.tsx` on app load
- Auto-sync initialized on app start with online/offline event listeners

### Feb 13, 2026 - User Roles System
- Added `roles` table with name (unique), createdAt fields
- Added `roleId` FK and `customRole` text fields to users table
- Added `userRole` text field to meetings table (snapshot of user's role at meeting creation)
- Superuser CRUD routes for roles at `/api/superuser/roles/*`
- Public GET `/api/roles` for fetching available roles
- User role update endpoint: PATCH `/api/users/me/role` (set roleId or customRole)
- Role is auto-captured when creating a meeting (resolved from roleId name or customRole text)
- AI processing pipeline includes user role in system prompt context for both process and reprocess
- Settings page (`/settings`) with searchable role dropdown, "Other" custom input, save/clear buttons
- Roles tab added to SuperuserAdmin page for role management
- Navigation updated with Settings link

### Feb 13, 2026 - Superuser Functionality
- Added `isSuperuser` boolean field to users table
- Hardcoded superuser credentials in `server/auth.ts` (SUPERUSER_EMAIL, SUPERUSER_PASSWORD)
- Superuser auto-created on first login with hardcoded credentials
- `requireSuperuser` middleware for access control
- Superuser API routes under `/api/superuser/*` for full CRUD on users, clients, meetings, templates, roles
- SuperuserAdmin frontend page (`/superuser`) with tabs for Users, Clients, Meetings, Templates, Roles
- Client-side `SuperuserRoute` wrapper prevents non-superusers from accessing the page
- Navigation shows "Superuser" link only for superuser accounts

### Feb 13, 2026 - Templates & Meeting Context System
- Added `templates` table with name, description, formatPrompt, isDefault, createdBy fields
- Added `templateId`, `contextText`, `contextFileUrl`, `contextFileName` fields to meetings table
- Added `isAdmin` flag to users table with `requireAdmin` middleware
- Template CRUD routes (GET/POST/PATCH/DELETE) with admin-only create/edit/delete
- Meeting context routes: PATCH `/api/meetings/:id/context` and POST `/api/meetings/:id/context-file`
- AI processing pipeline now injects template formatPrompt and user-provided context into LLM system prompt
- Frontend: Templates admin page (`/templates`) with create/edit/delete UI
- Navigation shows Templates link only for admin users
- NewMeeting page: template selector dropdown + context text input + context file attach
- MeetingDetail page: displays selected template, context text, and attached file name

### Feb 13, 2026 - Authentication & Subscription System
- Added `users` table with registration, password hashing (bcrypt), auto-login on registration
- Added `userId` FK to `meetings` and `clients` tables for multi-tenant data isolation
- Implemented session-based auth with `express-session` + `connect-pg-simple`
- 7-day free trial starts immediately on registration (no email verification required)
- PayFast subscription integration (sandbox mode, R199/month recurring):
  - Checkout URL generation with signature
  - ITN webhook with signature + merchant_id validation
  - Cancel subscription API
- Access control middleware: `requireAuth`, `requireAdmin`, `requireSuperuser`, `requireSubscription`
- All routes enforce userId ownership checks (users can only access their own meetings/clients)
- Password reset flow: forgot-password sends email with token (1hr expiry), reset-password validates token and updates password
- Frontend: Login, Register, ForgotPassword, ResetPassword, Subscription, SubscriptionSuccess, SubscriptionCancel pages
- Protected routes via `ProtectedRoute` and `PublicOnlyRoute` wrappers
- Subscription paywall banner on MeetingDetail when AI features are locked
- Navigation updated with user info, subscription link, and sign-out

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
- **Authentication**: Session-based auth with bcrypt password hashing
  - `server/auth.ts` - Middleware (requireAuth, requireVerified, requireSubscription) and helpers
  - `server/email.ts` - Resend email integration for verification emails
  - `server/payfast.ts` - PayFast subscription checkout, ITN webhook, cancellation
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
  - `users` - User accounts with subscription fields (status, trial dates, PayFast tokens)
  - `clients` - Client information (name, email, company, userId FK)
  - `meetings` - Meeting metadata, status tracking, client association, userId FK, templateId FK, context fields
  - `templates` - Admin-managed AI summary format templates (name, description, formatPrompt, isDefault, createdBy)
  - `transcripts` - Full transcription text
  - `action_items` - Extracted tasks with assignees
  - `topics` - Identified discussion topics with relevance scores
  - `meeting_summaries` - AI-generated executive summaries
  - `conversations`/`messages` - Chat functionality for Replit integrations

### Auth & Subscription Flow
- Registration creates user with auto-login and immediate 7-day trial (no email verification required)
- Trial expiry check on login and /api/auth/me
- PayFast subscription checkout redirects to PayFast payment page
- ITN webhook receives payment status (COMPLETE/CANCELLED) and updates user
- Subscription status: none → trialing → active/expired/cancelled
- Access control: unsubscribed users can create meetings and play audio, but AI analysis, transcription, summaries, action items, topics, and client management require active subscription or trial

### Key Design Patterns
- **Shared Types**: Schema and route definitions in `shared/` folder are used by both frontend and backend
- **Storage Abstraction**: `server/storage.ts` implements `IStorage` interface for database operations
- **Status State Machine**: Meetings progress through `uploading` → `processing` → `completed`/`failed`
- **Polling**: Frontend polls every 2 seconds for meetings in `processing` or `uploading` status
- **Ownership Checks**: All routes validate userId on meetings/clients to prevent cross-tenant access

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

### Payment
- **PayFast** (sandbox mode): Subscription payments
- **Environment Variables Required**:
  - `PAYFAST_MERCHANT_ID`
  - `PAYFAST_MERCHANT_KEY`
  - `PAYFAST_PASSPHRASE`

### Email
- **Resend** (via Replit Integrations): Verification emails

### Auth
- **Environment Variables Required**:
  - `SESSION_SECRET`

### Database
- **PostgreSQL**: Connection via `DATABASE_URL` environment variable
- **Session Storage**: `connect-pg-simple` for Express sessions

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
