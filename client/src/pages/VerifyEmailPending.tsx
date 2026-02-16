import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, RefreshCw, LogOut } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function VerifyEmailPending() {
  const { user } = useAuth();
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  async function handleResend() {
    setIsSending(true);
    try {
      const res = await apiRequest("POST", "/api/auth/resend-verification");
      const data = await res.json();
      toast({ title: "Email sent", description: data.message || "Verification email sent. Please check your inbox." });
    } catch (err: any) {
      let description = "Failed to send verification email. Please try again.";
      try {
        const parsed = JSON.parse(err.message.split(": ").slice(1).join(": "));
        description = parsed.message || description;
      } catch {}
      toast({ title: "Error", description, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  }

  async function handleLogout() {
    await apiRequest("POST", "/api/auth/logout");
    queryClient.setQueryData(["/api/auth/me"], null);
    window.location.href = "/login";
  }

  async function handleCheckStatus() {
    await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }} data-testid="text-verify-title">
            ScribeAI
          </h1>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-2">
              <Mail className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle data-testid="text-verify-heading">Check your email</CardTitle>
            <CardDescription>
              We've sent a verification link to <span className="font-medium text-foreground">{user?.email}</span>. Please click the link in the email to activate your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground space-y-3">
            <p>The link will expire in 24 hours.</p>
            <p>Don't see it? Check your spam folder.</p>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button onClick={handleResend} variant="outline" className="w-full" disabled={isSending} data-testid="button-resend-verification">
              <RefreshCw className={`h-4 w-4 mr-2 ${isSending ? "animate-spin" : ""}`} />
              {isSending ? "Sending..." : "Resend Verification Email"}
            </Button>
            <Button onClick={handleCheckStatus} variant="default" className="w-full" data-testid="button-check-verification">
              I've Verified My Email
            </Button>
            <Button onClick={handleLogout} variant="ghost" className="w-full text-muted-foreground" data-testid="button-logout-verify">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
