import { db } from "./db";
import { sql } from "drizzle-orm";
import { storage } from "./storage";
import { processMeetingCore } from "./processMeeting";
import { PROMPT_DEFAULTS } from "./promptDefaults";
import { SYSTEM_SETTING_DEFAULTS } from "./llmRegistry";

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
    await db.execute(sql`
      INSERT INTO audio_language_options (code, label, normalize, sort_order, is_active)
      VALUES
        ('sq', 'Albanian', false, 100, true),
        ('ar', 'Arabic', false, 100, true),
        ('az', 'Azerbaijani', false, 100, true),
        ('eu', 'Basque', false, 100, true),
        ('be', 'Belarusian', false, 100, true),
        ('bn', 'Bengali', false, 100, true),
        ('bs', 'Bosnian', false, 100, true),
        ('bg', 'Bulgarian', false, 100, true),
        ('ca', 'Catalan', false, 100, true),
        ('zh', 'Chinese', false, 100, true),
        ('hr', 'Croatian', false, 100, true),
        ('cs', 'Czech', false, 100, true),
        ('da', 'Danish', false, 100, true),
        ('nl', 'Dutch', false, 100, true),
        ('et', 'Estonian', false, 100, true),
        ('fi', 'Finnish', false, 100, true),
        ('fr', 'French', false, 100, true),
        ('gl', 'Galician', false, 100, true),
        ('de', 'German', false, 100, true),
        ('el', 'Greek', false, 100, true),
        ('gu', 'Gujarati', false, 100, true),
        ('he', 'Hebrew', false, 100, true),
        ('hi', 'Hindi', false, 100, true),
        ('hu', 'Hungarian', false, 100, true),
        ('id', 'Indonesian', false, 100, true),
        ('it', 'Italian', false, 100, true),
        ('ja', 'Japanese', false, 100, true),
        ('kn', 'Kannada', false, 100, true),
        ('kk', 'Kazakh', false, 100, true),
        ('ko', 'Korean', false, 100, true),
        ('lv', 'Latvian', false, 100, true),
        ('lt', 'Lithuanian', false, 100, true),
        ('mk', 'Macedonian', false, 100, true),
        ('ms', 'Malay', false, 100, true),
        ('ml', 'Malayalam', false, 100, true),
        ('mr', 'Marathi', false, 100, true),
        ('no', 'Norwegian', false, 100, true),
        ('fa', 'Persian', false, 100, true),
        ('pl', 'Polish', false, 100, true),
        ('pt', 'Portuguese', false, 100, true),
        ('pa', 'Punjabi', false, 100, true),
        ('ro', 'Romanian', false, 100, true),
        ('ru', 'Russian', false, 100, true),
        ('sr', 'Serbian', false, 100, true),
        ('sk', 'Slovak', false, 100, true),
        ('sl', 'Slovenian', false, 100, true),
        ('es', 'Spanish', false, 100, true),
        ('sw', 'Swahili', false, 100, true),
        ('sv', 'Swedish', false, 100, true),
        ('tl', 'Tagalog', false, 100, true),
        ('ta', 'Tamil', false, 100, true),
        ('te', 'Telugu', false, 100, true),
        ('th', 'Thai', false, 100, true),
        ('tr', 'Turkish', false, 100, true),
        ('uk', 'Ukrainian', false, 100, true),
        ('ur', 'Urdu', false, 100, true),
        ('vi', 'Vietnamese', false, 100, true),
        ('cy', 'Welsh', false, 100, true)
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

export async function migrateTemplateAnalysisModel() {
  try {
    await db.execute(sql`
      ALTER TABLE templates ADD COLUMN IF NOT EXISTS analysis_model TEXT
    `);
    console.log("[migrations] templates.analysis_model column ready");
  } catch (err) {
    console.error("[migrations] Error migrating templates.analysis_model:", err);
  }
}

export async function migratePayfastItnEvents() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS payfast_itn_events (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        payfast_token TEXT,
        payment_status TEXT NOT NULL,
        raw_data TEXT,
        received_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_payfast_itn_events_user_id ON payfast_itn_events(user_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_payfast_itn_events_status ON payfast_itn_events(payment_status)
    `);
    console.log("[migrations] payfast_itn_events table ready");
  } catch (err) {
    console.error("[migrations] Error migrating payfast_itn_events:", err);
  }
}

export async function migrateSubscriptionPaymentFailedAt() {
  try {
    await db.execute(sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_payment_failed_at TIMESTAMP
    `);
    console.log("[migrations] users.subscription_payment_failed_at column ready");
  } catch (err) {
    console.error("[migrations] Error migrating users.subscription_payment_failed_at:", err);
  }
}

export async function migratePayfastAuditLog() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS payfast_audit_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        attempted_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        attempted_at TIMESTAMP NOT NULL DEFAULT NOW(),
        result TEXT NOT NULL CHECK (result IN ('ok', 'error')),
        detail TEXT
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_payfast_audit_log_user_id ON payfast_audit_log(user_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_payfast_audit_log_attempted_at ON payfast_audit_log(attempted_at)
    `);
    // Add CHECK constraint to existing tables that were created before the constraint was added
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE payfast_audit_log ADD CONSTRAINT check_result_values CHECK (result IN ('ok', 'error'));
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    console.log("[migrations] payfast_audit_log table ready");
  } catch (err) {
    console.error("[migrations] Error migrating payfast_audit_log:", err);
  }
}

export async function migrateSiteImages() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS site_images (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL,
        section TEXT NOT NULL,
        description TEXT NOT NULL,
        required_width INTEGER NOT NULL,
        required_height INTEGER NOT NULL,
        url TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    type SlotDef = { key: string; label: string; section: string; description: string; w: number; h: number; url: string | null };
    const slots: SlotDef[] = [
      { key: "hero_background", label: "Hero Background", section: "Hero", description: "Faint texture shown at 20% opacity across the full hero banner", w: 1920, h: 1080, url: "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/6966282312b5b12ce0e89f07_fd0594781ebf9b9b5ea63a330706ec38_the_north_face-image.avif" },
      { key: "hero_main", label: "Hero Main Image", section: "Hero", description: "Primary product screenshot shown on the right side of the hero section", w: 1200, h: 800, url: null },
      { key: "feature_record_anywhere", label: "Feature: Record Anywhere", section: "Features", description: "Image strip inside the 'Record Anywhere' feature card", w: 600, h: 260, url: null },
      { key: "feature_upload_audio", label: "Feature: Upload Audio", section: "Features", description: "Image strip inside the 'Upload Audio' feature card", w: 600, h: 260, url: null },
      { key: "feature_ai_transcription", label: "Feature: AI Transcription", section: "Features", description: "Image strip inside the 'AI Transcription' feature card", w: 600, h: 260, url: "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/6847ec356628c2a227d91171_649d1e05c93495e5f993b68c762e2973_sealand.avif" },
      { key: "feature_smart_summaries", label: "Feature: Smart Summaries", section: "Features", description: "Image strip inside the 'Smart Summaries' feature card", w: 600, h: 260, url: "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/6847f81ccf587c065ecf0f99_viro.avif" },
      { key: "analysis_transcription", label: "Analysis: AI Transcription", section: "Analysis", description: "Screenshot shown in the AI Transcription analysis tab", w: 1200, h: 800, url: "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/67b6a54863fef312ee10a657_07d1f6af50b652880869efea31757511_Apple_Pay-mockup.avif" },
      { key: "analysis_summaries", label: "Analysis: Intelligent Summaries", section: "Analysis", description: "Screenshot shown in the Intelligent Summaries analysis tab", w: 1200, h: 800, url: "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/67acb7a335d39e9be1abb2e0_361c6e22b14d270e7f01a39591c74511_express-card.avif" },
      { key: "analysis_action_items", label: "Analysis: Action Items", section: "Analysis", description: "Screenshot shown in the Action Items analysis tab", w: 1200, h: 800, url: "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/697cb2897c7218d5bea66cec_express-stitch_bnpl.avif" },
      { key: "analysis_topics", label: "Analysis: Topic Analysis", section: "Analysis", description: "Screenshot shown in the Topic Analysis analysis tab", w: 1200, h: 800, url: "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/67b6a88e59792c71771123cc_d23ab24d70c0df2739760b4a37afae34_Capitec_pay.avif" },
      { key: "how_it_works_1", label: "How It Works: Step 1", section: "How It Works", description: "Card image for Step 1 — Record or Upload", w: 800, h: 390, url: "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/69663b84fc504f0df1534ed6_branded-checkout.avif" },
      { key: "how_it_works_2", label: "How It Works: Step 2", section: "How It Works", description: "Card image for Step 2 — AI Processes", w: 800, h: 390, url: "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/696e302cb8add1529a839450_express-checkout.avif" },
      { key: "how_it_works_3", label: "How It Works: Step 3", section: "How It Works", description: "Card image for Step 3 — Review & Act", w: 800, h: 390, url: "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/69a05952570b7e2e468fe3c1_rest-mockup.avif" },
      { key: "mobile_section", label: "Mobile & Offline Illustration", section: "Mobile", description: "Illustration on the left side of the Mobile & Offline section", w: 1200, h: 800, url: "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/69a032b28b63023b38615aad_subscriptions-mockup.avif" },
      { key: "security_section", label: "Security & Privacy Illustration", section: "Security", description: "Illustration on the right side of the Security & Privacy section", w: 1200, h: 800, url: "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/68484eb295961514ce7dd0d8_express-security-and-privacy-2.avif" },
    ];

    for (const s of slots) {
      const urlVal = s.url ? `'${s.url.replace(/'/g, "''")}'` : "NULL";
      await db.execute(sql.raw(
        `INSERT INTO site_images (key, label, section, description, required_width, required_height, url)
         VALUES ('${s.key}', '${s.label.replace(/'/g, "''")}', '${s.section.replace(/'/g, "''")}', '${s.description.replace(/'/g, "''")}', ${s.w}, ${s.h}, ${urlVal})
         ON CONFLICT (key) DO NOTHING`
      ));
    }

    console.log("[migrations] site_images table ready");
  } catch (err) {
    console.error("[migrations] Error migrating site_images:", err);
  }
}

export async function migrateSystemSettings() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS system_settings (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL,
        description TEXT,
        value TEXT NOT NULL,
        default_value TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    for (const [key, def] of Object.entries(SYSTEM_SETTING_DEFAULTS)) {
      const escaped = def.value.replace(/'/g, "''");
      const labelEscaped = def.label.replace(/'/g, "''");
      const descEscaped = (def.description || "").replace(/'/g, "''");
      await db.execute(sql.raw(
        `INSERT INTO system_settings (key, label, description, value, default_value)
         VALUES ('${key}', '${labelEscaped}', '${descEscaped}', '${escaped}', '${escaped}')
         ON CONFLICT (key) DO NOTHING`
      ));
    }

    console.log("[migrations] system_settings table ready");
  } catch (err) {
    console.error("[migrations] Error migrating system_settings:", err);
  }
}
