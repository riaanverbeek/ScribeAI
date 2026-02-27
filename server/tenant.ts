import type { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { tenants } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { Tenant } from "@shared/schema";

declare global {
  namespace Express {
    interface Request {
      tenant?: Tenant;
    }
  }
}

const tenantCache = new Map<string, { tenant: Tenant; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

async function getTenantByDomain(domain: string): Promise<Tenant | undefined> {
  const cached = tenantCache.get(domain);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.tenant;
  }

  const [tenant] = await db.select().from(tenants).where(eq(tenants.domain, domain));
  if (tenant) {
    tenantCache.set(domain, { tenant, expiresAt: Date.now() + CACHE_TTL_MS });
  }
  return tenant;
}

async function getDefaultTenant(): Promise<Tenant | undefined> {
  const cached = tenantCache.get("__default__");
  if (cached && cached.expiresAt > Date.now()) {
    return cached.tenant;
  }

  const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, "default"));
  if (tenant) {
    tenantCache.set("__default__", { tenant, expiresAt: Date.now() + CACHE_TTL_MS });
  }
  return tenant;
}

export function invalidateTenantCache() {
  tenantCache.clear();
}

export async function resolveTenant(req: Request, _res: Response, next: NextFunction) {
  try {
    const host = req.hostname?.toLowerCase();

    if (host) {
      const tenant = await getTenantByDomain(host);
      if (tenant && tenant.isActive) {
        req.tenant = tenant;
        return next();
      }
    }

    const defaultTenant = await getDefaultTenant();
    if (defaultTenant) {
      req.tenant = defaultTenant;
    }

    next();
  } catch (err) {
    console.error("Tenant resolution error:", err);
    const defaultTenant = await getDefaultTenant();
    if (defaultTenant) {
      req.tenant = defaultTenant;
    }
    next();
  }
}
