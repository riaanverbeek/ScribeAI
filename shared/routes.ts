import { z } from 'zod';
import { 
    insertMeetingSchema,
    insertClientSchema,
    insertPolicySchema,
    meetings, 
    clients,
    actionItems, 
    topics, 
    meetingSummaries, 
    transcripts,
    policies
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
  clients: {
    list: {
      method: 'GET' as const,
      path: '/api/clients',
      responses: {
        200: z.array(z.custom<typeof clients.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/clients/:id',
      responses: {
        200: z.custom<typeof clients.$inferSelect & { meetings: (typeof meetings.$inferSelect)[] }>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/clients',
      input: insertClientSchema,
      responses: {
        201: z.custom<typeof clients.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/clients/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
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
        responses: {
            200: z.object({ message: z.string() }),
            400: errorSchemas.validation,
            404: errorSchemas.notFound
        }
    },
    process: {
        method: 'POST' as const,
        path: '/api/meetings/:id/process',
        responses: {
            200: z.object({ message: z.string(), status: z.string() }),
            404: errorSchemas.notFound
        }
    },
    updateClient: {
      method: 'PATCH' as const,
      path: '/api/meetings/:id/client',
      input: z.object({ clientId: z.number().nullable() }),
      responses: {
        200: z.custom<typeof meetings.$inferSelect>(),
        404: errorSchemas.notFound,
        400: errorSchemas.validation,
      },
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
  policies: {
    listByClient: {
      method: 'GET' as const,
      path: '/api/clients/:clientId/policies',
      responses: {
        200: z.array(z.custom<typeof policies.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/clients/:clientId/policies',
      input: insertPolicySchema.omit({ clientId: true }),
      responses: {
        201: z.custom<typeof policies.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/policies/:id',
      responses: {
        200: z.custom<typeof policies.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/policies/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
    meetingPolicies: {
      method: 'GET' as const,
      path: '/api/meetings/:id/policies',
      responses: {
        200: z.array(z.custom<typeof policies.$inferSelect>()),
      },
    },
    setMeetingPolicies: {
      method: 'PUT' as const,
      path: '/api/meetings/:id/policies',
      input: z.object({ policyIds: z.array(z.number()) }),
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
  },
  actionItems: {
    listByClient: {
      method: 'GET' as const,
      path: '/api/clients/:clientId/action-items',
      responses: {
        200: z.array(z.custom<typeof actionItems.$inferSelect & { meetingTitle: string; meetingDate: string }>()),
      },
    },
    updateStatus: {
      method: 'PATCH' as const,
      path: '/api/action-items/:id/status',
      input: z.object({ status: z.enum(["pending", "completed"]) }),
      responses: {
        200: z.custom<typeof actionItems.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/meetings/:id/action-items',
      input: z.object({ content: z.string().min(1), assignee: z.string().optional() }),
      responses: {
        201: z.custom<typeof actionItems.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/action-items/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
};

export type CreateMeetingRequest = z.infer<typeof insertMeetingSchema>;

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
