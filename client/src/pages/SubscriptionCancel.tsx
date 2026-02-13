import { Link } from "wouter";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

export default function SubscriptionCancel() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <XCircle className="h-12 w-12 text-muted-foreground" />
          </div>
          <CardTitle data-testid="text-subscription-cancelled">Payment cancelled</CardTitle>
          <CardDescription>
            Your payment was not processed. You can subscribe anytime from the subscription page.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Link href="/subscription">
            <Button variant="outline" data-testid="link-back-to-subscription">Back to Subscription</Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
