import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, Project, Task, Profile, ProjectMember, logActivity } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Plus,
  Loader2,
  Users,
  CalendarDays,
  MoreHorizontal,
  Trash2,
  GripVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";

type TaskStatus = "todo" | "in_progress" | "done";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<(Task & { assignee?: Profile })[]>([]);
  const [members, setMembers] = useState<(ProjectMember & { profile?: Profile })[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium" as const,
    due_date: "",
    assigned_to: "",
  });

  const [selectedMember, setSelectedMember] = useState("");

  useEffect(() => {
    if (id) {
      fetchProjectData();
    }
  }, [id]);

  const fetchProjectData = async () => {
    if (!id) return;

    try {
      // Fetch project
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .single();

      if (projectError) throw projectError;
      setProject(projectData as Project);

      // Fetch tasks
      const { data: tasksData } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false });

      // Fetch project members
      const { data: membersData } = await supabase
        .from("project_members")
        .select("*")
        .eq("project_id", id);

      // Fetch all profiles for member info and adding members
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name");

      setAllProfiles((profilesData as Profile[]) ?? []);

      // Map tasks with assignee profiles
      const tasksWithAssignees = (tasksData ?? []).map((task: any) => ({
        ...task,
        assignee: profilesData?.find((p: Profile) => p.id === task.assigned_to)
      }));
      setTasks(tasksWithAssignees as (Task & { assignee?: Profile })[]);

      // Map members with profile info
      const membersWithProfiles = (membersData ?? []).map((member: any) => ({
        ...member,
        profile: profilesData?.find((p: Profile) => p.id === member.user_id)
      }));
      setMembers(membersWithProfiles as (ProjectMember & { profile?: Profile })[]);
    } catch (error) {
      console.error("Error fetching project:", error);
      navigate("/projects");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id || !newTask.title.trim()) return;

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          project_id: id,
          title: newTask.title.trim(),
          description: newTask.description.trim() || null,
          priority: newTask.priority,
          due_date: newTask.due_date || null,
          assigned_to: newTask.assigned_to || null,
          created_by: user.id,
          status: "todo",
        })
        .select("*")
        .single();

      if (error) throw error;

      await logActivity("created task", "task", data.id, data.title, id);

      const assignee = allProfiles.find(p => p.id === data.assigned_to);
      setTasks([{ ...data, assignee } as Task & { assignee?: Profile }, ...tasks]);
      setNewTask({
        title: "",
        description: "",
        priority: "medium",
        due_date: "",
        assigned_to: "",
      });
      setIsTaskDialogOpen(false);

      toast({
        title: "Task created",
        description: `${data.title} has been created.`,
      });
    } catch (error: any) {
      toast({
        title: "Error creating task",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: newStatus })
        .eq("id", taskId);

      if (error) throw error;

      setTasks(
        tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      );

      await logActivity(
        newStatus === "done" ? "completed task" : "updated task",
        "task",
        taskId,
        task.title,
        id
      );
    } catch (error: any) {
      toast({
        title: "Error updating task",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    try {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", taskId);

      if (error) throw error;

      setTasks(tasks.filter((t) => t.id !== taskId));

      toast({
        title: "Task deleted",
        description: `${task.title} has been deleted.`,
      });
    } catch (error: any) {
      toast({
        title: "Error deleting task",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAddMember = async () => {
    if (!selectedMember || !id) return;

    try {
      const { error } = await supabase
        .from("project_members")
        .insert({
          project_id: id,
          user_id: selectedMember,
        });

      if (error) throw error;

      const member = allProfiles.find((p) => p.id === selectedMember);
      await logActivity("added member", "project", id, member?.full_name ?? member?.email, id);

      fetchProjectData();
      setSelectedMember("");
      setIsMemberDialogOpen(false);

      toast({
        title: "Member added",
        description: "Team member has been added to the project.",
      });
    } catch (error: any) {
      toast({
        title: "Error adding member",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <Badge className="priority-high text-xs">High</Badge>;
      case "medium":
        return <Badge className="priority-medium text-xs">Medium</Badge>;
      case "low":
        return <Badge className="priority-low text-xs">Low</Badge>;
      default:
        return null;
    }
  };

  const tasksByStatus: Record<TaskStatus, (Task & { assignee?: Profile })[]> = {
    todo: tasks.filter((t) => t.status === "todo"),
    in_progress: tasks.filter((t) => t.status === "in_progress"),
    done: tasks.filter((t) => t.status === "done"),
  };

  const columnConfig: { key: TaskStatus; title: string; className: string }[] = [
    { key: "todo", title: "To Do", className: "status-todo" },
    { key: "in_progress", title: "In Progress", className: "status-in-progress" },
    { key: "done", title: "Done", className: "status-done" },
  ];

  const availableMembers = allProfiles.filter(
    (p) => !members.some((m) => m.user_id === p.id)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <Link
            to="/projects"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Projects
          </Link>
          <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
          {project.description && (
            <p className="text-muted-foreground mt-1">{project.description}</p>
          )}
        </div>

        <div className="flex gap-2">
          <Dialog open={isMemberDialogOpen} onOpenChange={setIsMemberDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Users className="h-4 w-4 mr-2" />
                Manage Team
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Project Team</DialogTitle>
                <DialogDescription>
                  Add or remove team members from this project.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Current Members</Label>
                  <div className="space-y-2">
                    {members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-muted"
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={member.profile?.avatar_url ?? undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {getInitials(
                                member.profile?.full_name ?? null,
                                member.profile?.email ?? ""
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">
                              {member.profile?.full_name || member.profile?.email}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {member.profile?.email}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {availableMembers.length > 0 && (
                  <div className="space-y-2">
                    <Label>Add Member</Label>
                    <div className="flex gap-2">
                      <Select value={selectedMember} onValueChange={setSelectedMember}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select a team member" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableMembers.map((profile) => (
                            <SelectItem key={profile.id} value={profile.id}>
                              {profile.full_name || profile.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={handleAddMember}
                        disabled={!selectedMember}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreateTask}>
                <DialogHeader>
                  <DialogTitle>Create New Task</DialogTitle>
                  <DialogDescription>
                    Add a new task to this project.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="task-title">Title</Label>
                    <Input
                      id="task-title"
                      value={newTask.title}
                      onChange={(e) =>
                        setNewTask({ ...newTask, title: e.target.value })
                      }
                      placeholder="Enter task title"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="task-description">Description</Label>
                    <Textarea
                      id="task-description"
                      value={newTask.description}
                      onChange={(e) =>
                        setNewTask({ ...newTask, description: e.target.value })
                      }
                      placeholder="Describe the task..."
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="task-priority">Priority</Label>
                      <Select
                        value={newTask.priority}
                        onValueChange={(value: any) =>
                          setNewTask({ ...newTask, priority: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="task-due">Due Date</Label>
                      <Input
                        id="task-due"
                        type="date"
                        value={newTask.due_date}
                        onChange={(e) =>
                          setNewTask({ ...newTask, due_date: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="task-assignee">Assign To</Label>
                    <Select
                      value={newTask.assigned_to}
                      onValueChange={(value) =>
                        setNewTask({ ...newTask, assigned_to: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select assignee" />
                      </SelectTrigger>
                      <SelectContent>
                        {members.map((member) => (
                          <SelectItem key={member.user_id} value={member.user_id}>
                            {member.profile?.full_name || member.profile?.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsTaskDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Task"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Project Info */}
      <div className="flex flex-wrap items-center gap-4">
        <Badge
          className={
            project.status === "active"
              ? "project-active"
              : project.status === "on_hold"
              ? "project-on-hold"
              : "project-completed"
          }
        >
          {project.status.replace("_", " ")}
        </Badge>
        {project.start_date && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            <span>
              {format(new Date(project.start_date), "MMM d, yyyy")}
              {project.end_date && (
                <> → {format(new Date(project.end_date), "MMM d, yyyy")}</>
              )}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <div className="avatar-stack">
            {members.slice(0, 3).map((member) => (
              <Avatar key={member.id} className="h-6 w-6 border-2 border-background">
                <AvatarImage src={member.profile?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {getInitials(
                    member.profile?.full_name ?? null,
                    member.profile?.email ?? ""
                  )}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          {members.length > 3 && (
            <span className="text-sm text-muted-foreground ml-1">
              +{members.length - 3} more
            </span>
          )}
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columnConfig.map((column) => (
          <div key={column.key} className="kanban-column">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={column.className}>
                  {column.title}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {tasksByStatus[column.key].length}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {tasksByStatus[column.key].length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No tasks
                </div>
              ) : (
                tasksByStatus[column.key].map((task) => (
                  <Card key={task.id} className="card-interactive">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-medium text-sm leading-tight">
                          {task.title}
                        </h4>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {column.key !== "todo" && (
                              <DropdownMenuItem
                                onClick={() => handleUpdateTaskStatus(task.id, "todo")}
                              >
                                Move to To Do
                              </DropdownMenuItem>
                            )}
                            {column.key !== "in_progress" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  handleUpdateTaskStatus(task.id, "in_progress")
                                }
                              >
                                Move to In Progress
                              </DropdownMenuItem>
                            )}
                            {column.key !== "done" && (
                              <DropdownMenuItem
                                onClick={() => handleUpdateTaskStatus(task.id, "done")}
                              >
                                Mark as Done
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDeleteTask(task.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {task.description && (
                        <p className="text-xs text-muted-foreground truncate-2 mb-3">
                          {task.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getPriorityBadge(task.priority)}
                          {task.due_date && (
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(task.due_date), "MMM d")}
                            </span>
                          )}
                        </div>
                        {task.assignee && (
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={task.assignee.avatar_url ?? undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {getInitials(
                                task.assignee.full_name,
                                task.assignee.email
                              )}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
