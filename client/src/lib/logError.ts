export function reportError(message: string, context: string): void {
  try {
    const payload = {
      message,
      context,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };
    fetch("/api/client-errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    }).catch(() => {});
  } catch {
  }
}
