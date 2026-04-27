import { ReactNode } from "react";
import { Link } from "wouter";
import { Navigation } from "./Navigation";
import { useSubscriptionStatus } from "@/hooks/use-auth";
import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";

interface LayoutProps {
  children: ReactNode;
}

function PaymentFailedBanner() {
  const { paymentFailedAt } = useSubscriptionStatus();
  const [dismissed, setDismissed] = useState(false);

  if (!paymentFailedAt || dismissed) return null;

  return (
    <div
      className="flex items-center gap-3 bg-destructive/10 border-b border-destructive/30 px-4 py-2.5 text-destructive"
      data-testid="banner-payment-failed"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <p className="flex-1 text-sm font-medium">
        Your last payment failed.{" "}
        <Link
          href="/subscription"
          className="underline underline-offset-2 font-semibold hover:opacity-80"
          data-testid="link-payment-failed-subscription"
        >
          Update your payment method
        </Link>{" "}
        to keep your access.
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-sm opacity-70 hover:opacity-100"
        aria-label="Dismiss"
        data-testid="button-dismiss-payment-banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen w-full max-w-full bg-background overflow-hidden">
      {/* Sidebar Navigation */}
      <Navigation />

      {/* Main Content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <PaymentFailedBanner />
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden relative custom-scrollbar pb-24 md:pb-0">
          {children}
        </main>
      </div>
    </div>
  );
}
