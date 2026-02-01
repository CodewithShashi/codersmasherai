import { useState, useEffect } from "react";
import { supabase, Profile } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Eye, Trash2, UserPlus } from "lucide-react";

interface ProjectClient {
  id: string;
  project_id: string;
  user_id: string;
  created_at: string;
  profile?: Profile;
}

interface ClientManagementProps {
  projectId: string;
  projectName: string;
}

export function ClientManagement({ projectId, projectName }: ClientManagementProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [clients, setClients] = useState<ProjectClient[]>([]);
  const [availableClients, setAvailableClients] = useState<Profile[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchClients = async () => {
    // Fetch existing project clients
    const { data: clientsData } = await supabase
      .from("project_clients")
      .select("*")
      .eq("project_id", projectId);

    // Fetch all profiles
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("*")
      .order("full_name");

    // Fetch users with client role
    const { data: clientRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "client");

    const clientUserIds = new Set(clientRoles?.map((r) => r.user_id) || []);
    const existingClientIds = new Set(clientsData?.map((c) => c.user_id) || []);

    // Map clients with profiles
    const clientsWithProfiles = (clientsData || []).map((client) => ({
      ...client,
      profile: profilesData?.find((p) => p.id === client.user_id),
    }));
    setClients(clientsWithProfiles);

    // Filter available clients (users with client role not yet added to project)
    const available = (profilesData || []).filter(
      (p) => clientUserIds.has(p.id) && !existingClientIds.has(p.id)
    );
    setAvailableClients(available);
  };

  useEffect(() => {
    if (isOpen) {
      fetchClients();
    }
  }, [isOpen, projectId]);

  const handleAddClient = async () => {
    if (!selectedClient) return;
    setLoading(true);

    try {
      const { error } = await supabase.from("project_clients").insert({
        project_id: projectId,
        user_id: selectedClient,
      });

      if (error) throw error;

      toast({
        title: "Client added",
        description: "Client can now view this project.",
      });

      setSelectedClient("");
      fetchClients();
    } catch (error: any) {
      toast({
        title: "Error adding client",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveClient = async (clientId: string) => {
    try {
      const { error } = await supabase
        .from("project_clients")
        .delete()
        .eq("id", clientId);

      if (error) throw error;

      toast({
        title: "Client removed",
        description: "Client can no longer view this project.",
      });

      fetchClients();
    } catch (error: any) {
      toast({
        title: "Error removing client",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye className="h-4 w-4 mr-2" />
          Client Access
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Client Access</DialogTitle>
          <DialogDescription>
            Manage which clients can view progress on "{projectName}" (read-only access).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current clients */}
          <div className="space-y-2">
            <Label>Clients with Access</Label>
            {clients.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No clients have access to this project yet.
              </p>
            ) : (
              <div className="space-y-2">
                {clients.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={client.profile?.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {getInitials(
                            client.profile?.full_name ?? null,
                            client.profile?.email ?? ""
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">
                          {client.profile?.full_name || client.profile?.email}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {client.profile?.email}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleRemoveClient(client.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add client */}
          {availableClients.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <Label>Add Client</Label>
              <div className="flex gap-2">
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableClients.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.full_name || profile.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAddClient} disabled={!selectedClient || loading}>
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {availableClients.length === 0 && clients.length > 0 && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              All clients have been added to this project.
            </p>
          )}

          <div className="bg-muted/50 rounded-lg p-3 mt-4">
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5">
                <Eye className="h-3 w-3 mr-1" />
                Read-only
              </Badge>
              <p className="text-xs text-muted-foreground">
                Clients can view project progress and tasks but cannot make any changes.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
