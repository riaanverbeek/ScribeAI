import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Pencil, X, KeyRound, AtSign } from "lucide-react";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your new password"),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type ProfileValues = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [editingProfile, setEditingProfile] = useState(false);

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
    },
  });

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (values: ProfileValues) => {
      const res = await apiRequest("PATCH", "/api/auth/profile", values);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setEditingProfile(false);
      toast({ title: "Profile updated" });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to update profile",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (values: PasswordValues) => {
      const res = await apiRequest("POST", "/api/auth/change-password", {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message ?? "Failed to change password");
      }
      return res.json();
    },
    onSuccess: () => {
      passwordForm.reset();
      toast({ title: "Password changed successfully" });
    },
    onError: (err: any) => {
      toast({
        title: "Password change failed",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  function startEditingProfile() {
    profileForm.reset({
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
    });
    setEditingProfile(true);
  }

  function cancelEditingProfile() {
    profileForm.reset();
    setEditingProfile(false);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <SettingsIcon className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-settings-heading">Settings</h1>
        </div>
        <p className="text-sm text-muted-foreground">Manage your account preferences.</p>
      </div>

      <div className="space-y-6">

        {/* ── Profile card ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Profile</CardTitle>
              {!editingProfile && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-muted-foreground"
                  onClick={startEditingProfile}
                  data-testid="button-edit-profile"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editingProfile ? (
              <Form {...profileForm}>
                <form
                  onSubmit={profileForm.handleSubmit((v) => updateProfileMutation.mutate(v))}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={profileForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-first-name" autoFocus />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-last-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Username</Label>
                    <p className="text-sm font-medium mt-0.5" data-testid="text-profile-email">
                      {user?.email}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      This is your login email. Contact support to change it.
                    </p>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={updateProfileMutation.isPending}
                      data-testid="button-save-profile"
                    >
                      {updateProfileMutation.isPending ? "Saving…" : "Save changes"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={cancelEditingProfile}
                      disabled={updateProfileMutation.isPending}
                      data-testid="button-cancel-edit-profile"
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">First Name</Label>
                    <p className="text-sm font-medium mt-0.5" data-testid="text-profile-firstname">
                      {user?.firstName}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Last Name</Label>
                    <p className="text-sm font-medium mt-0.5" data-testid="text-profile-lastname">
                      {user?.lastName}
                    </p>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <AtSign className="w-3 h-3" />
                    Username
                  </Label>
                  <p className="text-sm font-medium mt-0.5" data-testid="text-profile-email">
                    {user?.email}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Used to log in to the app</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Change Password card ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base">Change Password</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...passwordForm}>
              <form
                onSubmit={passwordForm.handleSubmit((v) => changePasswordMutation.mutate(v))}
                className="space-y-4"
              >
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          autoComplete="current-password"
                          data-testid="input-current-password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          autoComplete="new-password"
                          data-testid="input-new-password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          autoComplete="new-password"
                          data-testid="input-confirm-password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={changePasswordMutation.isPending}
                  data-testid="button-change-password"
                >
                  {changePasswordMutation.isPending ? "Updating…" : "Update password"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
