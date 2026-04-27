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
import { Settings as SettingsIcon, Pencil, X } from "lucide-react";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
});

type ProfileValues = z.infer<typeof profileSchema>;

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: ProfileValues) => {
      const res = await apiRequest("PATCH", "/api/auth/profile", values);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setEditing(false);
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

  function startEditing() {
    form.reset({
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
    });
    setEditing(true);
  }

  function cancelEditing() {
    form.reset();
    setEditing(false);
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
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Profile</CardTitle>
              {!editing && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-muted-foreground"
                  onClick={startEditing}
                  data-testid="button-edit-profile"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editing ? (
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit((v) => updateMutation.mutate(v))}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
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
                      control={form.control}
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
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <p className="text-sm font-medium mt-0.5" data-testid="text-profile-email">
                      {user?.email}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Email cannot be changed here. Contact support if you need to update it.
                    </p>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={updateMutation.isPending}
                      data-testid="button-save-profile"
                    >
                      {updateMutation.isPending ? "Saving…" : "Save changes"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={cancelEditing}
                      disabled={updateMutation.isPending}
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
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <p className="text-sm font-medium mt-0.5" data-testid="text-profile-email">
                    {user?.email}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
