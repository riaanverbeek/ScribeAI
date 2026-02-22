import crypto from "crypto";

const PAYFAST_SANDBOX = false;
const PAYFAST_HOST = PAYFAST_SANDBOX ? "sandbox.payfast.co.za" : "www.payfast.co.za";
const PAYFAST_API_HOST = PAYFAST_SANDBOX ? "api.sandbox.payfast.co.za" : "api.payfast.co.za";

function getBaseUrl(): string {
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  }
  return 'http://localhost:5000';
}

function generateSignature(data: Record<string, string>, passphrase?: string): string {
  const sortedKeys = Object.keys(data).filter(k => k !== 'signature');
  let pfOutput = sortedKeys.map(key => `${key}=${encodeURIComponent(data[key]).replace(/%20/g, "+")}`).join("&");
  if (passphrase) {
    pfOutput += `&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, "+")}`;
  }
  return crypto.createHash("md5").update(pfOutput).digest("hex");
}

export function generatePayfastSubscriptionUrl(params: {
  email: string;
  firstName: string;
  lastName: string;
  userId: number;
}): string {
  const merchantId = process.env.PAYFAST_MERCHANT_ID!;
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY!;
  const passphrase = process.env.PAYFAST_PASSPHRASE || "";
  const baseUrl = getBaseUrl();

  const data: Record<string, string> = {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: `${baseUrl}/subscription/success`,
    cancel_url: `${baseUrl}/subscription/cancel`,
    notify_url: `${baseUrl}/api/payfast/notify`,
    name_first: params.firstName,
    name_last: params.lastName,
    email_address: params.email,
    amount: "199.00",
    item_name: "ScribeAI Monthly Subscription",
    subscription_type: "1",
    frequency: "3",
    cycles: "0",
    custom_str1: String(params.userId),
  };

  const signature = generateSignature(data, passphrase);
  data.signature = signature;

  const queryString = Object.entries(data)
    .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
    .join("&");

  return `https://${PAYFAST_HOST}/eng/process?${queryString}`;
}

export function validatePayfastSignature(data: Record<string, string>): boolean {
  const passphrase = process.env.PAYFAST_PASSPHRASE || "";
  const receivedSignature = data.signature;
  const calculatedSignature = generateSignature(data, passphrase);
  return receivedSignature === calculatedSignature;
}

export async function cancelPayfastSubscription(token: string): Promise<boolean> {
  const merchantId = process.env.PAYFAST_MERCHANT_ID!;
  const passphrase = process.env.PAYFAST_PASSPHRASE || "";

  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "+02:00");
  const signatureData: Record<string, string> = {
    merchant_id: merchantId,
    passphrase: passphrase,
    timestamp: timestamp,
    version: "v1",
  };
  const signatureString = Object.entries(signatureData)
    .map(([key, val]) => `${key}=${encodeURIComponent(val).replace(/%20/g, "+")}`)
    .join("&");
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
