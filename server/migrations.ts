import { db } from "./db";
import { sql } from "drizzle-orm";
import { storage } from "./storage";

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
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
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

export async function migrateTemplateTenants() {
  try {
    await storage.migrateTemplateTenants();
    console.log("[migrations] Template-tenant junction migration complete");
  } catch (err) {
    console.error("[migrations] Error migrating template tenants:", err);
  }
}
