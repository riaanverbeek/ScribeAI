import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import type { SafeUser } from "@shared/schema";

type AuthResponse = { user: SafeUser } | null;

export function useAuth() {
  const { data, isLoading } = useQuery<AuthResponse>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const user = data?.user ?? null;
  const isAuthenticated = !!user;

  return { user, isLoading, isAuthenticated };
}

export function useLogin() {
  return useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", data);
      return res.json();
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: async (data: { email: string; password: string; firstName: string; lastName: string }) => {
      const res = await apiRequest("POST", "/api/auth/register", data);
      return res.json();
    },
  });
}

export function useLogout() {
  const [, setLocation] = useLocation();
  return useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.clear();
      setLocation("/");
    },
  });
}

export function useSubscriptionStatus() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["/api/subscription/status"],
    queryFn: async () => {
      const res = await fetch("/api/subscription/status", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user,
    staleTime: 1000 * 60,
  });

  return {
    status: data?.status ?? user?.subscriptionStatus ?? "none",
    trialEndsAt: data?.trialEndsAt ?? user?.trialEndsAt,
    currentPeriodEnd: data?.currentPeriodEnd,
    cancelledAt: data?.cancelledAt,
    paymentFailedAt: data?.paymentFailedAt ?? null,
    hasFullAccess: data?.hasFullAccess ?? false,
    provider: data?.provider ?? "none" as "payfast" | "stripe" | "none",
    isLoading,
  };
}
