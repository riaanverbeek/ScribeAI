import { db } from "./db";
import { sql } from "drizzle-orm";
import { storage } from "./storage";
import { processMeetingCore } from "./processMeeting";
import { PROMPT_DEFAULTS } from "./promptDefaults";

export async function backfillTenantIds() {
  try {
    const existingResult = await db.execute(sql`SELECT id FROM tenants WHERE slug = 'default' LIMIT 1`);
    const existingRows = (existingResult as any).rows ?? existingResult;
    if (!existingRows || existingRows.length === 0) {
      await db.execute(sql`INSERT INTO tenants (name, slug, tagline, is_active) VALUES ('ScribeAI', 'default', 'Session transcription & analysis', true) ON CONFLICT (slug) DO NOTHING`);
      console.log("[migrations] Created default tenant");
    }

    const tenantResult = await db.execute(sql`SELECT id FROM tenants WHERE slug = 'default' LIMIT 1`);
    const tenantRows = (tenantResult as any).rows ?? tenantResult;
    if (!tenantRows || tenantRows.length === 0) {
      console.error("[migrations] Could not find or create default tenant");
      return;
    }
    const tenantId = tenantRows[0].id;

    const tables = ['users', 'clients', 'meetings', 'templates', 'roles'];
    for (const table of tables) {
      const result = await db.execute(sql.raw(`UPDATE ${table} SET tenant_id = ${tenantId} WHERE tenant_id IS NULL`));
      const count = (result as any)?.rowCount ?? 0;
      if (count > 0) {
        console.log(`[migrations] Backfilled ${count} rows in ${table} with tenantId=${tenantId}`);
      }
    }

    console.log("[migrations] Tenant backfill complete");
  } catch (err) {
    console.error("[migrations] Error backfilling tenant IDs:", err);
  }
}

export async function cleanupStaleUploads() {
  try {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const result = await db.execute(
      sql.raw(`UPDATE meetings SET status = 'failed' WHERE status = 'uploading' AND created_at < '${cutoff}'`)
    );
    const count = (result as any)?.rowCount ?? 0;
    if (count > 0) {
      console.log(`[migrations] Cleaned up ${count} stale uploading meeting(s)`);
    }
  } catch (err) {
    console.error("[migrations] Error cleaning up stale uploads:", err);
  }
}

export async function retryStaleProcessing() {
  try {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const claimResult = await db.execute(
      sql.raw(`UPDATE meetings SET status = 'retry_pending' WHERE status = 'processing' AND created_at < '${cutoff}' RETURNING id, title, audio_url`)
    );
    const rows = (claimResult as any).rows ?? claimResult;
    if (!rows || rows.length === 0) return;

    console.log(`[retry] Claimed ${rows.length} meeting(s) stuck in processing for retry...`);

    for (const row of rows) {
      const meetingId = row.id;
      const title = row.title || `Meeting ${meetingId}`;
      const hasAudio = !!row.audio_url;
      const transcript = await storage.getTranscript(meetingId);

      if (!hasAudio && !transcript) {
        await db.execute(sql.raw(`UPDATE meetings SET status = 'failed' WHERE id = ${meetingId}`));
        console.log(`[retry] Meeting "${title}" (${meetingId}) has no audio or transcript — marked as failed`);
        continue;
      }

      console.log(`[retry] Retrying meeting "${title}" (${meetingId})...`);
      processMeetingCore(meetingId)
        .then(() => console.log(`[retry] Meeting "${title}" (${meetingId}) completed successfully`))
        .catch(async (err) => {
          console.error(`[retry] Meeting "${title}" (${meetingId}) retry failed:`, err);
          try {
            await db.execute(sql.raw(`UPDATE meetings SET status = 'failed' WHERE id = ${meetingId}`));
          } catch (updateErr) {
            console.error(`[retry] Failed to mark meeting ${meetingId} as failed:`, updateErr);
          }
        });
    }
  } catch (err) {
    console.error("[retry] Error retrying stale processing:", err);
  }
}

export async function migrateTemplateTenants() {
  try {
    await storage.migrateTemplateTenants();
    console.log("[migrations] Template-tenant junction migration complete");
  } catch (err) {
    console.error("[migrations] Error migrating template tenants:", err);
  }
}

export async function migrateAudioLanguageOptions() {
  try {
    await db.execute(sql`DROP TABLE IF EXISTS language_options`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS audio_language_options (
        id SERIAL PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL,
        normalize BOOLEAN NOT NULL DEFAULT false,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      ALTER TABLE audio_language_options
      ADD COLUMN IF NOT EXISTS normalization_prompt TEXT
    `);
    await db.execute(sql`
      INSERT INTO audio_language_options (code, label, normalize, sort_order, is_active)
      VALUES
        ('auto', 'Auto-detect', false, 0, true),
        ('af', 'Afrikaans / English (ZA)', true, 10, true),
        ('en', 'English only', false, 20, true)
      ON CONFLICT (code) DO NOTHING
    `);
    console.log("[migrations] audio_language_options table ready");
  } catch (err) {
    console.error("[migrations] Error migrating audio_language_options:", err);
  }
}

export async function migratePromptSettings() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS prompt_settings (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL,
        description TEXT,
        value TEXT NOT NULL,
        default_value TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Remove legacy language-specific keys that were replaced by unified keys
    const legacyKeys = ["normalization.af", "normalization.generic", "analysis.summary_format.en", "analysis.summary_format.af"];
    for (const legacyKey of legacyKeys) {
      await db.execute(sql.raw(`DELETE FROM prompt_settings WHERE key = '${legacyKey}'`));
    }

    // Seed current canonical defaults (INSERT only if not already present)
    for (const [key, def] of Object.entries(PROMPT_DEFAULTS)) {
      const escaped = def.value.replace(/'/g, "''");
      const labelEscaped = def.label.replace(/'/g, "''");
      const descEscaped = (def.description || "").replace(/'/g, "''");
      await db.execute(sql.raw(
        `INSERT INTO prompt_settings (key, label, description, value, default_value)
         VALUES ('${key}', '${labelEscaped}', '${descEscaped}', '${escaped}', '${escaped}')
         ON CONFLICT (key) DO NOTHING`
      ));
    }

    console.log("[migrations] prompt_settings table ready");
  } catch (err) {
    console.error("[migrations] Error migrating prompt_settings:", err);
  }
}
