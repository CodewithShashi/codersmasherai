import { useEffect, useState, useTransition } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, Profile, UserRole, AppRole } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Users, Shield, UserCog, User } from "lucide-react";

interface TeamMember {
  profile: Profile;
  role: UserRole;
}

export default function Team() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  const fetchTeamMembers = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name");

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");

      if (rolesError) throw rolesError;

      const teamMembers: TeamMember[] = (profiles as Profile[]).map((profile) => {
        const role = (roles as UserRole[]).find((r) => r.user_id === profile.id);
        return {
          profile,
          role: role ?? { id: "", user_id: profile.id, role: "team_member", created_at: "" },
        };
      });

      setMembers(teamMembers);
    } catch (error) {
      console.error("Error fetching team members:", error);
    } finally {
      setLoading(false);
    }
  };

  const [isPending, startTransition] = useTransition();

  const handleRoleChange = (userId: string, newRole: AppRole) => {
    if (!isAdmin) return;

    // Optimistically update UI first to prevent INP issues
    setMembers(
      members.map((m) =>
        m.profile.id === userId ? { ...m, role: { ...m.role, role: newRole } } : m
      )
    );

    // Then perform the async database update
    startTransition(() => {
      (async () => {
        try {
          const { data: existingRole } = await supabase
            .from("user_roles")
            .select("*")
            .eq("user_id", userId)
            .single();

          if (existingRole) {
            const { error } = await supabase
              .from("user_roles")
              .update({ role: newRole })
              .eq("user_id", userId);

            if (error) throw error;
          } else {
            const { error } = await supabase
              .from("user_roles")
              .insert({ user_id: userId, role: newRole });

            if (error) throw error;
          }

          toast({
            title: "Role updated",
            description: "Team member's role has been updated.",
          });
        } catch (error: any) {
          // Revert on error
          fetchTeamMembers();
          toast({
            title: "Error updating role",
            description: error.message,
            variant: "destructive",
          });
        }
      })();
    });
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  const getRoleIcon = (role: AppRole) => {
    switch (role) {
      case "admin":
        return <Shield className="h-4 w-4" />;
      case "project_manager":
        return <UserCog className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getRoleBadge = (role: AppRole) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-primary/10 text-primary">Admin</Badge>;
      case "project_manager":
        return (
          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            Project Manager
          </Badge>
        );
      default:
        return <Badge variant="outline">Team Member</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="page-header">
          <div className="h-8 w-40 bg-muted animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Team Members</h1>
        <p className="page-description">
          Manage your team and their roles ({members.length} members)
        </p>
      </div>

      {/* Role Legend */}
      <Card className="card-elevated">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Role Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Shield className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-sm">Admin</p>
                <p className="text-xs text-muted-foreground">
                  Full access to all projects, tasks, and team management
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <UserCog className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Project Manager</p>
                <p className="text-xs text-muted-foreground">
                  Can create and manage projects, assign tasks
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-sm">Team Member</p>
                <p className="text-xs text-muted-foreground">
                  Can view assigned projects and work on tasks
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team Members Grid */}
      {members.length === 0 ? (
        <Card className="card-elevated">
          <CardContent className="py-12">
            <div className="empty-state">
              <Users className="empty-state-icon" />
              <p className="empty-state-title">No team members yet</p>
              <p className="empty-state-description">
                Team members will appear here as they sign up.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((member) => (
            <Card key={member.profile.id} className="card-interactive">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={member.profile.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {getInitials(member.profile.full_name, member.profile.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">
                      {member.profile.full_name || "Unnamed User"}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {member.profile.email}
                    </p>
                    <div className="mt-2">
                      {isAdmin && member.profile.id !== user?.id ? (
                        <Select
                          value={member.role.role}
                          onValueChange={(value: AppRole) =>
                            handleRoleChange(member.profile.id, value)
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="project_manager">
                              Project Manager
                            </SelectItem>
                            <SelectItem value="team_member">Team Member</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex items-center gap-2">
                          {getRoleBadge(member.role.role)}
                          {member.profile.id === user?.id && (
                            <span className="text-xs text-muted-foreground">(You)</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
