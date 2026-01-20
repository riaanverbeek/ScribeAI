import { z } from 'zod';
import { 
    insertMeetingSchema, 
    meetings, 
    actionItems, 
    topics, 
    meetingSummaries, 
    transcripts 
} from './schema';

// ============================================
// SHARED ERROR SCHEMAS
// ============================================
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

// ============================================
// API CONTRACT
// ============================================
export const api = {
  meetings: {
    list: {
      method: 'GET' as const,
      path: '/api/meetings',
      responses: {
        200: z.array(z.custom<typeof meetings.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/meetings/:id',
      responses: {
        200: z.custom<typeof meetings.$inferSelect & { 
            transcript?: typeof transcripts.$inferSelect,
            actionItems: typeof actionItems.$inferSelect[],
            topics: typeof topics.$inferSelect[],
            summary?: typeof meetingSummaries.$inferSelect
        }>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/meetings',
      input: insertMeetingSchema,
      responses: {
        201: z.custom<typeof meetings.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    uploadAudio: {
        method: 'POST' as const,
        path: '/api/meetings/:id/audio',
        // FormData not typed here directly, handled by multer/busboy on backend
        responses: {
            200: z.object({ message: z.string() }),
            400: errorSchemas.validation,
            404: errorSchemas.notFound
        }
    },
    process: { // Triggers AI analysis
        method: 'POST' as const,
        path: '/api/meetings/:id/process',
        responses: {
            200: z.object({ message: z.string(), status: z.string() }),
            404: errorSchemas.notFound
        }
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/meetings/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
};

// ============================================
// REQUIRED: buildUrl helper
// ============================================
export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
