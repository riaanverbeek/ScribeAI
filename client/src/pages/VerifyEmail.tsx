import { useEffect, useState } from "react";
import { useSearch, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function VerifyEmail() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const token = params.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token found.");
      return;
    }

    fetch(`/api/auth/verify?token=${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setStatus("success");
          setMessage(data.message);
        } else {
          setStatus("error");
          setMessage(data.message || "Verification failed.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Something went wrong. Please try again.");
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {status === "loading" && (
            <>
              <div className="flex justify-center mb-4">
                <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
              </div>
              <CardTitle data-testid="text-verify-status">Verifying your email...</CardTitle>
              <CardDescription>Please wait while we confirm your account.</CardDescription>
            </>
          )}
          {status === "success" && (
            <>
              <div className="flex justify-center mb-4">
                <CheckCircle className="h-12 w-12 text-green-600" />
              </div>
              <CardTitle data-testid="text-verify-status">Email verified!</CardTitle>
              <CardDescription>{message}</CardDescription>
            </>
          )}
          {status === "error" && (
            <>
              <div className="flex justify-center mb-4">
                <XCircle className="h-12 w-12 text-destructive" />
              </div>
              <CardTitle data-testid="text-verify-status">Verification failed</CardTitle>
              <CardDescription>{message}</CardDescription>
            </>
          )}
        </CardHeader>
        {status !== "loading" && (
          <CardFooter className="justify-center">
            <Link href="/login">
              <Button data-testid="link-go-to-login">Go to Sign In</Button>
            </Link>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
