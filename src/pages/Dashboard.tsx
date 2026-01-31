import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, Project, Task, ActivityLog, Profile } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  FolderKanban,
  CheckSquare,
  Clock,
  TrendingUp,
  Plus,
  ArrowRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface DashboardStats {
  totalProjects: number;
  activeTasks: number;
  completedTasks: number;
  myTasks: number;
}

export default function Dashboard() {
  const { user, profile, canCreateProjects } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalProjects: 0,
    activeTasks: 0,
    completedTasks: 0,
    myTasks: 0,
  });
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [recentActivity, setRecentActivity] = useState<(ActivityLog & { profile?: Profile })[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      // Fetch projects count
      const { count: projectCount } = await supabase
        .from("projects")
        .select("*", { count: "exact", head: true });

      // Fetch task stats
      const { data: allTasks } = await supabase
        .from("tasks")
        .select("status, assigned_to");

      const activeTasks = allTasks?.filter((t) => t.status !== "done").length ?? 0;
      const completedTasks = allTasks?.filter((t) => t.status === "done").length ?? 0;
      const myTasks = allTasks?.filter((t) => t.assigned_to === user.id && t.status !== "done").length ?? 0;

      setStats({
        totalProjects: projectCount ?? 0,
        activeTasks,
        completedTasks,
        myTasks,
      });

      // Fetch recent projects
      const { data: projects } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(4);

      setRecentProjects((projects as Project[]) ?? []);

      // Fetch recent activity with profiles
      const { data: activity } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      // Fetch profiles for activity logs
      if (activity && activity.length > 0) {
        const userIds = [...new Set(activity.map(a => a.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("*")
          .in("id", userIds);

        const activityWithProfiles = activity.map(a => ({
          ...a,
          profile: profiles?.find(p => p.id === a.user_id) as Profile | undefined
        }));
        setRecentActivity(activityWithProfiles as (ActivityLog & { profile?: Profile })[]);
      } else {
        setRecentActivity([]);
      }

      // Fetch upcoming tasks
      const { data: tasks } = await supabase
        .from("tasks")
        .select("*")
        .eq("assigned_to", user.id)
        .neq("status", "done")
        .order("due_date", { ascending: true })
        .limit(5);

      setUpcomingTasks((tasks as Task[]) ?? []);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="project-active">Active</Badge>;
      case "on_hold":
        return <Badge className="project-on-hold">On Hold</Badge>;
      case "completed":
        return <Badge className="project-completed">Completed</Badge>;
      default:
        return null;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <Badge className="priority-urgent">Urgent</Badge>;
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

  const getActivityIcon = (action: string) => {
    if (action.includes("created")) return "🆕";
    if (action.includes("updated")) return "✏️";
    if (action.includes("completed")) return "✅";
    if (action.includes("deleted")) return "🗑️";
    if (action.includes("comment")) return "💬";
    return "📌";
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="page-header">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-5 w-64 bg-muted animate-pulse rounded mt-2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">
          Welcome back, {profile?.full_name?.split(" ")[0] || "there"}!
        </h1>
        <p className="page-description">
          Here's what's happening with your projects today.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="card-interactive">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-value">{stats.totalProjects}</p>
                <p className="stat-label">Total Projects</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <FolderKanban className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-interactive">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-value">{stats.activeTasks}</p>
                <p className="stat-label">Active Tasks</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-interactive">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-value">{stats.completedTasks}</p>
                <p className="stat-label">Completed Tasks</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckSquare className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-interactive">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-value">{stats.myTasks}</p>
                <p className="stat-label">My Active Tasks</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Projects */}
        <Card className="card-elevated lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-medium">Recent Projects</CardTitle>
            <div className="flex gap-2">
              {canCreateProjects && (
                <Button asChild size="sm">
                  <Link to="/projects/new">
                    <Plus className="h-4 w-4 mr-1" />
                    New
                  </Link>
                </Button>
              )}
              <Button asChild variant="ghost" size="sm">
                <Link to="/projects">
                  View all
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentProjects.length === 0 ? (
              <div className="empty-state py-8">
                <FolderKanban className="empty-state-icon" />
                <p className="empty-state-title">No projects yet</p>
                <p className="empty-state-description">
                  {canCreateProjects
                    ? "Create your first project to get started."
                    : "You'll see projects here once you're added to one."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {recentProjects.map((project) => (
                  <Link
                    key={project.id}
                    to={`/projects/${project.id}`}
                    className="block p-4 rounded-lg border border-border hover:border-primary/20 hover:shadow-elevated transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-foreground truncate">
                        {project.name}
                      </h3>
                      {getStatusBadge(project.status)}
                    </div>
                    {project.description && (
                      <p className="text-sm text-muted-foreground truncate-2">
                        {project.description}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="empty-state py-8">
                <Clock className="empty-state-icon" />
                <p className="empty-state-title">No activity yet</p>
                <p className="empty-state-description">
                  Activity will appear here as you work.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="activity-item">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={activity.profile?.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {getInitials(
                          activity.profile?.full_name ?? null,
                          activity.profile?.email ?? ""
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">
                          {activity.profile?.full_name || activity.profile?.email}
                        </span>{" "}
                        <span className="text-muted-foreground">{activity.action}</span>
                        {activity.entity_name && (
                          <span className="font-medium"> {activity.entity_name}</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(activity.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    <span className="text-lg">{getActivityIcon(activity.action)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Tasks */}
      {upcomingTasks.length > 0 && (
        <Card className="card-elevated">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-medium">My Upcoming Tasks</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/tasks">
                View all
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcomingTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        task.priority === "urgent"
                          ? "bg-purple-500"
                          : task.priority === "high"
                          ? "bg-red-500"
                          : task.priority === "medium"
                          ? "bg-amber-500"
                          : "bg-green-500"
                      }`}
                    />
                    <span className="text-sm font-medium truncate">{task.title}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {getPriorityBadge(task.priority)}
                    {task.due_date && (
                      <span className="text-xs text-muted-foreground">
                        Due {formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
