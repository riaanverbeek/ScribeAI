import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { TenantProvider } from "@/contexts/TenantContext";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import NewMeeting from "@/pages/NewMeeting";
import MeetingDetail from "@/pages/MeetingDetail";
import Clients from "@/pages/Clients";
import ClientDetail from "@/pages/ClientDetail";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Subscription from "@/pages/Subscription";
import SubscriptionSuccess from "@/pages/SubscriptionSuccess";
import SubscriptionCancel from "@/pages/SubscriptionCancel";
import Templates from "@/pages/Templates";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import SuperuserAdmin from "@/pages/SuperuserAdmin";
import Settings from "@/pages/Settings";
import QuickRecord from "@/pages/QuickRecord";
import VerifyEmail from "@/pages/VerifyEmail";
import VerifyEmailPending from "@/pages/VerifyEmailPending";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  if (user && !user.isVerified) {
    return <VerifyEmailPending />;
  }

  return <>{children}</>;
}

function SuperuserRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  if (!user?.isSuperuser) {
    return <Redirect to="/" />;
  }

  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Redirect to="/" />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login">
        <PublicOnlyRoute><Login /></PublicOnlyRoute>
      </Route>
      <Route path="/register">
        <PublicOnlyRoute><Register /></PublicOnlyRoute>
      </Route>
      <Route path="/forgot-password">
        <PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute>
      </Route>
      <Route path="/reset-password">
        <PublicOnlyRoute><ResetPassword /></PublicOnlyRoute>
      </Route>
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/subscription/success">
        <ProtectedRoute><SubscriptionSuccess /></ProtectedRoute>
      </Route>
      <Route path="/subscription/cancel">
        <ProtectedRoute><SubscriptionCancel /></ProtectedRoute>
      </Route>

      <Route path="/">
        <ProtectedRoute>
          <Layout><Dashboard /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/new">
        <ProtectedRoute>
          <Layout><NewMeeting /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/quick-record">
        <ProtectedRoute>
          <Layout><QuickRecord /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/clients">
        <ProtectedRoute>
          <Layout><Clients /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/client/:id">
        <ProtectedRoute>
          <Layout><ClientDetail /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/meeting/:id">
        <ProtectedRoute>
          <Layout><MeetingDetail /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/subscription">
        <ProtectedRoute>
          <Layout><Subscription /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/templates">
        <ProtectedRoute>
          <Layout><Templates /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings">
        <ProtectedRoute>
          <Layout><Settings /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/superuser">
        <SuperuserRoute>
          <Layout><SuperuserAdmin /></Layout>
        </SuperuserRoute>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TenantProvider>
          <Toaster />
          <Router />
        </TenantProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
