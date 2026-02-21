import { useMutation } from "@tanstack/react-query";
import { useAuth, useSubscriptionStatus } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, CheckCircle, Clock, XCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function Subscription() {
  const { user } = useAuth();
  const { status, trialEndsAt, currentPeriodEnd, cancelledAt, hasFullAccess, isLoading } = useSubscriptionStatus();
  const { toast } = useToast();

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/payfast/checkout");
      return res.json();
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: () => {
      toast({ title: "Failed to start checkout", variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/payfast/cancel");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Subscription cancelled", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: () => {
      toast({ title: "Failed to cancel", variant: "destructive" });
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
    trialing: { label: "Free Trial", variant: "secondary", icon: Clock },
    active: { label: "Active", variant: "default", icon: CheckCircle },
    cancelled: { label: "Cancelled", variant: "outline", icon: XCircle },
    expired: { label: "Expired", variant: "destructive", icon: XCircle },
    none: { label: "No Subscription", variant: "outline", icon: XCircle },
  };

  const config = statusConfig[status] || statusConfig.none;
  const StatusIcon = config.icon;

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }} data-testid="text-subscription-title">
          Subscription
        </h1>
        <p className="text-muted-foreground mt-1">Manage your ScribeAI subscription</p>
      </div>

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
                After your trial ends, you'll still be able to record and upload meetings, but AI analysis, client management, and exports will require a subscription.
              </p>
            </div>
          )}

          {status === "active" && currentPeriodEnd && (
            <div className="rounded-md bg-secondary p-4" data-testid="text-active-info">
              <p className="text-sm font-medium">Next billing date: {format(new Date(currentPeriodEnd), "MMMM d, yyyy")}</p>
              <p className="text-sm text-muted-foreground mt-1">R199/month — You have full access to all features.</p>
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
                Get AI-powered transcription, meeting summaries, action items, topic analysis, and client management for R199/month.
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Always free (no subscription needed):</h3>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600 shrink-0" /> Record and upload meeting audio</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600 shrink-0" /> Upload or paste transcripts</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600 shrink-0" /> View and manage your meetings</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Included with subscription (R199/month):</h3>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600 shrink-0" /> AI speech-to-text transcription (Afrikaans & English)</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600 shrink-0" /> Executive meeting summaries</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600 shrink-0" /> Action item extraction</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600 shrink-0" /> Topic analysis with relevance scores</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600 shrink-0" /> Client & policy management</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600 shrink-0" /> Word document export</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600 shrink-0" /> Custom AI summary templates</li>
              </ul>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          {(status === "expired" || status === "none" || status === "trialing") && (
            <Button
              className="w-full"
              onClick={() => checkoutMutation.mutate()}
              disabled={checkoutMutation.isPending}
              data-testid="button-subscribe"
            >
              {checkoutMutation.isPending ? "Redirecting..." : "Subscribe — R199/month"}
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
