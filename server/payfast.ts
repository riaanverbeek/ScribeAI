import crypto from "crypto";

const PAYFAST_SANDBOX = false;
const PAYFAST_HOST = PAYFAST_SANDBOX ? "sandbox.payfast.co.za" : "www.payfast.co.za";
const PAYFAST_API_HOST = PAYFAST_SANDBOX ? "api.sandbox.payfast.co.za" : "api.payfast.co.za";

function getBaseUrl(): string {
  if (process.env.REPLIT_DEPLOYMENT && process.env.REPLIT_DOMAINS) {
    const domain = process.env.REPLIT_DOMAINS.split(",")[0];
    return `https://${domain}`;
  }
  if (process.env.APP_BASE_URL) {
    return process.env.APP_BASE_URL;
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  }
  return "http://localhost:5000";
}

function phpUrlEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, "%21")
    .replace(/\*/g, "%2A")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/~/g, "%7E")
    .replace(/%20/g, "+");
}

function generateSignature(data: Record<string, string>, passphrase?: string): string {
  const keys = Object.keys(data).filter((k) => k !== "signature");
  const parts: string[] = [];
  for (const key of keys) {
    const raw = data[key];
    if (raw === undefined || raw === null) continue;
    const trimmed = String(raw).trim();
    if (trimmed === "") continue;
    parts.push(`${key}=${phpUrlEncode(trimmed)}`);
  }
  let pfOutput = parts.join("&");
  if (passphrase && passphrase.trim() !== "") {
    pfOutput += `&passphrase=${phpUrlEncode(passphrase.trim())}`;
  }
  return crypto.createHash("md5").update(pfOutput).digest("hex");
}

export function generatePayfastSubscriptionUrl(params: {
  email: string;
  firstName: string;
  lastName: string;
  userId: number;
}): string {
  const merchantId = (process.env.PAYFAST_MERCHANT_ID || "").trim();
  const merchantKey = (process.env.PAYFAST_MERCHANT_KEY || "").trim();
  const passphrase = (process.env.PAYFAST_PASSPHRASE || "").trim();
  const baseUrl = getBaseUrl();

  const data: Record<string, string> = {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: `${baseUrl}/subscription/success`,
    cancel_url: `${baseUrl}/subscription/cancel`,
    notify_url: `${baseUrl}/api/payfast/notify`,
    name_first: (params.firstName || "").trim(),
    name_last: (params.lastName || "").trim(),
    email_address: (params.email || "").trim(),
    amount: "199.00",
    item_name: "ScribeAI Monthly Subscription",
    subscription_type: "1",
    frequency: "3",
    cycles: "0",
    custom_str1: String(params.userId),
  };

  const signature = generateSignature(data, passphrase || undefined);
  data.signature = signature;

  const queryString = Object.entries(data)
    .filter(([, val]) => val !== undefined && val !== null && String(val).trim() !== "")
    .map(([key, val]) => `${key}=${phpUrlEncode(String(val).trim())}`)
    .join("&");

  return `https://${PAYFAST_HOST}/eng/process?${queryString}`;
}

export function validatePayfastSignature(data: Record<string, string>): boolean {
  const passphrase = (process.env.PAYFAST_PASSPHRASE || "").trim();
  const receivedSignature = data.signature;
  const calculatedSignature = generateSignature(data, passphrase || undefined);
  return receivedSignature === calculatedSignature;
}

export async function cancelPayfastSubscription(token: string): Promise<boolean> {
  const merchantId = (process.env.PAYFAST_MERCHANT_ID || "").trim();
  const passphrase = (process.env.PAYFAST_PASSPHRASE || "").trim();

  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "+02:00");
  const signatureData: Record<string, string> = {
    "merchant-id": merchantId,
    "version": "v1",
    "timestamp": timestamp,
  };
  const sortedKeys = Object.keys(signatureData).sort();
  const parts = sortedKeys.map((key) => `${key}=${phpUrlEncode(signatureData[key])}`);
  let signatureString = parts.join("&");
  if (passphrase) {
    signatureString += `&passphrase=${phpUrlEncode(passphrase)}`;
  }
  const signature = crypto.createHash("md5").update(signatureString).digest("hex");

  try {
    const response = await fetch(`https://${PAYFAST_API_HOST}/subscriptions/${token}/cancel`, {
      method: "PUT",
      headers: {
        "merchant-id": merchantId,
        "version": "v1",
        "timestamp": timestamp,
        "signature": signature,
      },
    });
    return response.ok;
  } catch (error) {
    console.error("PayFast cancel error:", error);
    return false;
  }
}
