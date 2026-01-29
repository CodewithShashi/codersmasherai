import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, Task, Project } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  CheckSquare,
  Calendar,
  FolderKanban,
  Loader2,
} from "lucide-react";
import { format, isToday, isTomorrow, isPast, formatDistanceToNow } from "date-fns";

interface TaskWithProject extends Task {
  project?: Project;
}

export default function Tasks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<TaskWithProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  useEffect(() => {
    if (user) {
      fetchTasks();
    }
  }, [user]);

  const fetchTasks = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, project:projects(*)")
        .eq("assigned_to", user.id)
        .order("due_date", { ascending: true, nullsFirst: false });

      if (error) throw error;
      setTasks((data as TaskWithProject[]) ?? []);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleComplete = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === "done" ? "todo" : "done";

    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: newStatus })
        .eq("id", taskId);

      if (error) throw error;

      setTasks(
        tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus as any } : t))
      );

      toast({
        title: newStatus === "done" ? "Task completed" : "Task reopened",
        description:
          newStatus === "done"
            ? "Great job! Task marked as complete."
            : "Task has been reopened.",
      });
    } catch (error: any) {
      toast({
        title: "Error updating task",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = task.title
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && task.status !== "done") ||
      task.status === statusFilter;
    const matchesPriority =
      priorityFilter === "all" || task.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <Badge className="priority-high">High</Badge>;
      case "medium":
        return <Badge className="priority-medium">Medium</Badge>;
      case "low":
        return <Badge className="priority-low">Low</Badge>;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "todo":
        return <Badge variant="outline" className="status-todo">To Do</Badge>;
      case "in_progress":
        return <Badge variant="outline" className="status-in-progress">In Progress</Badge>;
      case "done":
        return <Badge variant="outline" className="status-done">Done</Badge>;
      default:
        return null;
    }
  };

  const getDueDateInfo = (dueDate: string | null) => {
    if (!dueDate) return null;

    const date = new Date(dueDate);
    const isPastDue = isPast(date) && !isToday(date);

    let label = format(date, "MMM d, yyyy");
    if (isToday(date)) {
      label = "Today";
    } else if (isTomorrow(date)) {
      label = "Tomorrow";
    } else if (isPastDue) {
      label = `Overdue (${formatDistanceToNow(date, { addSuffix: true })})`;
    }

    return {
      label,
      isPastDue,
    };
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="page-header">
          <div className="h-8 w-32 bg-muted animate-pulse rounded" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">My Tasks</h1>
        <p className="page-description">Tasks assigned to you across all projects</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tasks</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="todo">To Do</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tasks List */}
      {filteredTasks.length === 0 ? (
        <Card className="card-elevated">
          <CardContent className="py-12">
            <div className="empty-state">
              <CheckSquare className="empty-state-icon" />
              <p className="empty-state-title">
                {searchQuery || statusFilter !== "all" || priorityFilter !== "all"
                  ? "No tasks found"
                  : "No tasks assigned to you"}
              </p>
              <p className="empty-state-description">
                {searchQuery || statusFilter !== "all" || priorityFilter !== "all"
                  ? "Try adjusting your search or filters."
                  : "Tasks will appear here when they're assigned to you."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => {
            const dueDateInfo = getDueDateInfo(task.due_date);
            const isCompleted = task.status === "done";

            return (
              <Card
                key={task.id}
                className={`card-interactive ${isCompleted ? "opacity-60" : ""}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={isCompleted}
                      onCheckedChange={() =>
                        handleToggleComplete(task.id, task.status)
                      }
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3
                            className={`font-medium ${
                              isCompleted ? "line-through text-muted-foreground" : ""
                            }`}
                          >
                            {task.title}
                          </h3>
                          {task.description && (
                            <p className="text-sm text-muted-foreground truncate mt-0.5">
                              {task.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {getPriorityBadge(task.priority)}
                          {getStatusBadge(task.status)}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                        {task.project && (
                          <Link
                            to={`/projects/${task.project.id}`}
                            className="flex items-center gap-1 hover:text-foreground transition-colors"
                          >
                            <FolderKanban className="h-3.5 w-3.5" />
                            {task.project.name}
                          </Link>
                        )}
                        {dueDateInfo && (
                          <div
                            className={`flex items-center gap-1 ${
                              dueDateInfo.isPastDue && !isCompleted
                                ? "text-destructive"
                                : ""
                            }`}
                          >
                            <Calendar className="h-3.5 w-3.5" />
                            {dueDateInfo.label}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
