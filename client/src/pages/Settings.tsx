import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings as SettingsIcon, Mic, Loader2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [defaultAudioLanguage, setDefaultAudioLanguage] = useState(user?.defaultAudioLanguage ?? "af");

  useEffect(() => {
    if (user?.defaultAudioLanguage) {
      setDefaultAudioLanguage(user.defaultAudioLanguage);
    }
  }, [user?.defaultAudioLanguage]);

  const preferencesMutation = useMutation({
    mutationFn: async (data: { defaultAudioLanguage: string }) => {
      const res = await apiRequest("PATCH", "/api/users/me/preferences", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Preferences saved" });
    },
    onError: () => {
      toast({ title: "Failed to save", description: "Please try again.", variant: "destructive" });
    },
  });

  const handleLanguageChange = (value: string) => {
    setDefaultAudioLanguage(value);
    preferencesMutation.mutate({ defaultAudioLanguage: value });
  };

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
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">First Name</Label>
                <p className="text-sm font-medium" data-testid="text-profile-firstname">{user?.firstName}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Last Name</Label>
                <p className="text-sm font-medium" data-testid="text-profile-lastname">{user?.lastName}</p>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Email</Label>
              <p className="text-sm font-medium" data-testid="text-profile-email">{user?.email}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mic className="w-4 h-4" />
              Recording Defaults
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Default Audio Language</Label>
              <p className="text-xs text-muted-foreground mb-2">
                This language will be pre-selected when you create new sessions.
              </p>
              <div className="flex items-center gap-2">
                <Select value={defaultAudioLanguage} onValueChange={handleLanguageChange} data-testid="select-default-audio-language">
                  <SelectTrigger className="w-full max-w-xs" data-testid="trigger-default-audio-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="af" data-testid="option-af">Afrikaans / English (ZA)</SelectItem>
                    <SelectItem value="en" data-testid="option-en">English only</SelectItem>
                    <SelectItem value="auto" data-testid="option-auto">Auto-detect</SelectItem>
                  </SelectContent>
                </Select>
                {preferencesMutation.isPending && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                {preferencesMutation.isSuccess && !preferencesMutation.isPending && <Check className="w-4 h-4 text-green-500" />}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
