import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();

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
      </div>
    </div>
  );
}
