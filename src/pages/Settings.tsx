import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Shield } from "lucide-react";

export default function Settings() {
  const { profile, role, user } = useAuth();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name ?? "");

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error updating profile",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  const getRoleLabel = () => {
    switch (role) {
      case "admin":
        return "Administrator";
      case "project_manager":
        return "Project Manager";
      default:
        return "Team Member";
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-description">Manage your account settings</p>
      </div>

      {/* Profile Card */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
          <CardDescription>Update your personal information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateProfile} className="space-y-6">
            <div className="flex items-center gap-6">
              <Avatar className="h-20 w-20">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-xl">
                  {getInitials(profile?.full_name ?? null, profile?.email ?? "")}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-medium">{profile?.full_name || "Unnamed User"}</h3>
                <p className="text-sm text-muted-foreground">{profile?.email}</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={profile?.email ?? ""}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed
                </p>
              </div>
            </div>

            <Button type="submit" disabled={isUpdating} variant="gradient">
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Role Card */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Role & Permissions
          </CardTitle>
          <CardDescription>Your current role and access level</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div>
              <p className="font-medium">{getRoleLabel()}</p>
              <p className="text-sm text-muted-foreground">
                {role === "admin" && "Full access to all features and settings"}
                {role === "project_manager" &&
                  "Can create and manage projects, assign tasks"}
                {role === "team_member" &&
                  "Can view assigned projects and work on tasks"}
              </p>
            </div>
            <div
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                role === "admin"
                  ? "bg-primary/10 text-primary"
                  : role === "project_manager"
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {getRoleLabel()}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Contact an administrator to change your role.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
