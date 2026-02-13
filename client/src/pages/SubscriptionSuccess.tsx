import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useEffect } from "react";

export default function SubscriptionSuccess() {
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] });
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
          <CardTitle data-testid="text-subscription-success">Subscription activated!</CardTitle>
          <CardDescription>
            Your ScribeAI subscription is now active. You have full access to all AI-powered features.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Link href="/">
            <Button data-testid="link-go-to-dashboard">Go to Dashboard</Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
