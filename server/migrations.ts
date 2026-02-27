import { db } from "./db";
import { sql } from "drizzle-orm";

export async function backfillTenantIds() {
  try {
    const [existing] = await db.execute(sql`SELECT id FROM tenants WHERE slug = 'default' LIMIT 1`);
    if (!existing) {
      await db.execute(sql`INSERT INTO tenants (name, slug, tagline, is_active) VALUES ('ScribeAI', 'default', 'Session transcription & analysis', true) ON CONFLICT (slug) DO NOTHING`);
      console.log("[migrations] Created default tenant");
    }

    const [defaultTenant] = await db.execute(sql`SELECT id FROM tenants WHERE slug = 'default' LIMIT 1`);
    if (!defaultTenant) {
      console.error("[migrations] Could not find or create default tenant");
      return;
    }
    const tenantId = (defaultTenant as any).id;

    const tables = ['users', 'clients', 'meetings', 'templates', 'roles'];
    for (const table of tables) {
      const result = await db.execute(sql.raw(`UPDATE ${table} SET tenant_id = ${tenantId} WHERE tenant_id IS NULL`));
      const count = (result as any)?.rowCount ?? (result as any)?.length ?? 0;
      if (count > 0) {
        console.log(`[migrations] Backfilled ${count} rows in ${table} with tenantId=${tenantId}`);
      }
    }
  } catch (err) {
    console.error("[migrations] Error backfilling tenant IDs:", err);
  }
}
