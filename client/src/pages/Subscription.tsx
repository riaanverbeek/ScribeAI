import { useMutation } from "@tanstack/react-query";
import { useAuth, useSubscriptionStatus } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, CheckCircle, Clock, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export default function Subscription() {
  const { user } = useAuth();
  const { status, trialEndsAt, currentPeriodEnd, cancelledAt, paymentFailedAt, hasFullAccess, isLoading, provider } = useSubscriptionStatus();
  const { toast } = useToast();

  const payfastCheckoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/payfast/checkout");
      return res.json();
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: () => {
      toast({ title: "Failed to start PayFast checkout", variant: "destructive" });
    },
  });

  const cancelMutation = useMutation<{ message: string }, Error>({
    mutationFn: async () => {
      // We use fetch directly (instead of apiRequest) so we can read the JSON
      // body on a 5xx response and surface the server's clear cancellation
      // failure message — apiRequest stringifies non-2xx bodies into the
      // Error.message which is brittle to parse.
      const endpoint = provider === "stripe" ? "/api/stripe/cancel" : "/api/payfast/cancel";
      const res = await fetch(endpoint, { method: "POST", credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        throw new Error(
          data.message || "Couldn't cancel — please try again or contact support.",
        );
      }
      return { message: data.message ?? "" };
    },
    onSuccess: (data) => {
      toast({ title: "Subscription cancelled", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (error) => {
      toast({
        title: "Couldn't cancel subscription",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle }> = {
    lifetime: { label: "Lifetime Access", variant: "default", icon: CheckCircle },
    trialing: { label: "Free Trial", variant: "secondary", icon: Clock },
    active: { label: "Active", variant: "default", icon: CheckCircle },
    cancelled: { label: "Cancelled", variant: "outline", icon: XCircle },
    expired: { label: "Expired", variant: "destructive", icon: XCircle },
    none: { label: "No Subscription", variant: "outline", icon: XCircle },
  };

  const config = statusConfig[status] || statusConfig.none;
  const StatusIcon = config.icon;

  const showSubscribeButtons = status === "expired" || status === "none" || status === "trialing";
  const isCheckingOut = payfastCheckoutMutation.isPending;
  const hasPaymentFailure = !!paymentFailedAt;
  // PayFast doesn't expose a customer-facing "update card" portal, so the
  // recovery path is to start a new subscription checkout. The ITN handler
  // clears subscriptionPaymentFailedAt on the next COMPLETE event, which
  // automatically removes this CTA and the global banner.
  const canSelfServeRecovery = hasPaymentFailure && (provider === "payfast" || provider === "none");

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }} data-testid="text-subscription-title">
          Subscription
        </h1>
        <p className="text-muted-foreground mt-1">Manage your ScribeAI subscription</p>
      </div>

      {hasPaymentFailure && (
        <Card className="border-destructive/40 bg-destructive/5" data-testid="card-payment-failed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Payment failed
            </CardTitle>
            <CardDescription data-testid="text-payment-failed-description">
              We couldn't process your last payment on {format(new Date(paymentFailedAt), "MMMM d, yyyy")}.
              {canSelfServeRecovery
                ? " Update your payment method below to keep your access. The warning will disappear automatically once your next payment succeeds."
                : " Please contact support so we can help you update your payment method."}
            </CardDescription>
          </CardHeader>
          {canSelfServeRecovery && (
            <CardFooter>
              <Button
                className="w-full"
                onClick={() => payfastCheckoutMutation.mutate()}
                disabled={isCheckingOut}
                data-testid="button-update-payment-method"
              >
                {isCheckingOut ? "Redirecting to PayFast..." : "Update payment method"}
              </Button>
            </CardFooter>
          )}
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Your Plan
            </CardTitle>
            <Badge variant={config.variant} data-testid="badge-subscription-status">
              <StatusIcon className="h-3 w-3 mr-1" />
              {config.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "trialing" && trialEndsAt && (
            <div className="rounded-md bg-secondary p-4" data-testid="text-trial-info">
              <p className="text-sm font-medium">You have full access to all features until {format(new Date(trialEndsAt), "MMMM d, yyyy")}</p>
              <p className="text-sm text-muted-foreground mt-1">
                After your trial ends, you'll still be able to record and upload sessions, but AI analysis, client management, and exports will require a subscription.
              </p>
            </div>
          )}

          {status === "lifetime" && (
            <div className="rounded-md bg-secondary p-4" data-testid="text-lifetime-info">
              <p className="text-sm font-medium">You have lifetime access to all features</p>
              <p className="text-sm text-muted-foreground mt-1">Your account has been granted permanent full access. No subscription payments are required.</p>
            </div>
          )}

          {status === "active" && currentPeriodEnd && (
            <div className="rounded-md bg-secondary p-4" data-testid="text-active-info">
              <p className="text-sm font-medium">Next billing date: {format(new Date(currentPeriodEnd), "MMMM d, yyyy")}</p>
              <p className="text-sm text-muted-foreground mt-1">
                R199/month via {provider === "stripe" ? "Stripe" : "PayFast"} — You have full access to all features.
              </p>
            </div>
          )}

          {status === "cancelled" && currentPeriodEnd && (
            <div className="rounded-md bg-secondary p-4" data-testid="text-cancelled-info">
              <p className="text-sm font-medium">Your subscription is cancelled</p>
              <p className="text-sm text-muted-foreground mt-1">
                You'll retain access until {format(new Date(currentPeriodEnd), "MMMM d, yyyy")}. After that, AI features will be restricted.
              </p>
            </div>
          )}

          {(status === "expired" || status === "none") && (
            <div className="rounded-md bg-secondary p-4" data-testid="text-expired-info">
              <p className="text-sm font-medium">Subscribe to unlock AI features</p>
              <p className="text-sm text-muted-foreground mt-1">
                Get AI-powered transcription, session summaries, action items, topic analysis, and client management for R199/month.
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Always free (no subscription needed):</h3>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600 shrink-0" /> Record and upload session audio</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600 shrink-0" /> Upload or paste transcripts</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600 shrink-0" /> View and manage your sessions</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Included with subscription (R199/month):</h3>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600 shrink-0" /> AI speech-to-text transcription (Afrikaans & English)</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600 shrink-0" /> Executive session summaries</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600 shrink-0" /> Action item extraction</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600 shrink-0" /> Topic analysis with relevance scores</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600 shrink-0" /> Client management</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600 shrink-0" /> Word document export</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600 shrink-0" /> Custom AI summary templates</li>
              </ul>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          {showSubscribeButtons && (
            <Button
              className="w-full"
              onClick={() => payfastCheckoutMutation.mutate()}
              disabled={isCheckingOut}
              data-testid="button-subscribe-payfast"
            >
              {payfastCheckoutMutation.isPending ? "Redirecting..." : "Subscribe with PayFast — R199/month"}
            </Button>
          )}
          {status === "active" && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              data-testid="button-cancel-subscription"
            >
              {cancelMutation.isPending ? "Cancelling..." : "Cancel Subscription"}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
