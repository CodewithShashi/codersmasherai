import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an AI Project Assistant for a Project Management System. You help users manage projects, tasks, and team productivity.

Your capabilities:
1. **Task Management**: Create tasks, suggest priorities, assign team members, set deadlines
2. **Project Insights**: Analyze project progress, identify risks, provide summaries
3. **Smart Recommendations**: Suggest task prioritization, workload balancing, timeline optimization
4. **Team Analytics**: Analyze team workload and productivity

When asked to perform actions, you must respond with a structured JSON action in your response when appropriate:
- To create a task: Include {"action": "create_task", "data": {"title": "...", "description": "...", "priority": "low|medium|high|urgent", "project_id": "..."}}
- To update a task: Include {"action": "update_task", "data": {"task_id": "...", "status": "todo|in_progress|done"}}

Current project context will be provided. Be helpful, concise, and action-oriented.
Always format your responses in a clear, readable way using markdown when helpful.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, projectId, action } = await req.json();
    
    // Handle specific actions
    if (action === "get_context") {
      const context = await getProjectContext(supabase, user.id, projectId);
      return new Response(JSON.stringify({ context }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context for AI
    let contextMessage = "";
    
    if (projectId) {
      const context = await getProjectContext(supabase, user.id, projectId);
      contextMessage = `\n\nCurrent Project Context:\n${JSON.stringify(context, null, 2)}`;
    } else {
      // Get general workspace context
      const context = await getWorkspaceContext(supabase, user.id);
      contextMessage = `\n\nWorkspace Context:\n${JSON.stringify(context, null, 2)}`;
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT + contextMessage },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add more credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("AI assistant error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function getProjectContext(supabase: any, userId: string, projectId: string) {
  // Get project details
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  // Get tasks for this project
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*, profiles:assigned_to(full_name, email)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  // Get team members
  const { data: members } = await supabase
    .from("project_members")
    .select("*, profiles:user_id(id, full_name, email)")
    .eq("project_id", projectId);

  // Calculate stats
  const taskStats = {
    total: tasks?.length || 0,
    todo: tasks?.filter((t: any) => t.status === "todo").length || 0,
    inProgress: tasks?.filter((t: any) => t.status === "in_progress").length || 0,
    done: tasks?.filter((t: any) => t.status === "done").length || 0,
    overdue: tasks?.filter((t: any) => t.due_date && new Date(t.due_date) < new Date() && t.status !== "done").length || 0,
  };

  // Get workload per member
  const workload: Record<string, number> = {};
  tasks?.forEach((task: any) => {
    if (task.assigned_to) {
      workload[task.assigned_to] = (workload[task.assigned_to] || 0) + 1;
    }
  });

  return {
    project: project ? {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      startDate: project.start_date,
      endDate: project.end_date,
    } : null,
    taskStats,
    recentTasks: tasks?.slice(0, 10).map((t: any) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.due_date,
      assignee: t.profiles?.full_name || "Unassigned",
    })),
    teamMembers: members?.map((m: any) => ({
      id: m.profiles?.id,
      name: m.profiles?.full_name || m.profiles?.email,
      taskCount: workload[m.profiles?.id] || 0,
    })),
    workloadDistribution: workload,
  };
}

async function getWorkspaceContext(supabase: any, userId: string) {
  // Get all projects user has access to
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status")
    .limit(10);

  // Get user's assigned tasks
  const { data: myTasks } = await supabase
    .from("tasks")
    .select("id, title, status, priority, due_date, project_id")
    .eq("assigned_to", userId)
    .neq("status", "done")
    .order("due_date", { ascending: true })
    .limit(10);

  // Get all team members
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .limit(20);

  return {
    projects: projects?.map((p: any) => ({
      id: p.id,
      name: p.name,
      status: p.status,
    })),
    myPendingTasks: myTasks?.map((t: any) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.due_date,
    })),
    teamMembers: profiles?.map((p: any) => ({
      id: p.id,
      name: p.full_name || p.email,
    })),
  };
}
