import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { Task, Project } from "@/lib/supabase";

interface ProjectProgressChartsProps {
  tasks: Task[];
  project?: Project;
}

const STATUS_COLORS = {
  todo: "hsl(var(--muted-foreground))",
  in_progress: "hsl(var(--primary))",
  done: "hsl(var(--success))",
};

const PRIORITY_COLORS = {
  low: "hsl(var(--success))",
  medium: "hsl(142 76% 36%)",
  high: "hsl(var(--destructive))",
  urgent: "hsl(271 81% 56%)",
};

export function ProjectProgressCharts({ tasks, project }: ProjectProgressChartsProps) {
  // Status distribution
  const statusData = [
    { name: "To Do", value: tasks.filter((t) => t.status === "todo").length, color: "#6b7280" },
    { name: "In Progress", value: tasks.filter((t) => t.status === "in_progress").length, color: "#f97316" },
    { name: "Done", value: tasks.filter((t) => t.status === "done").length, color: "#22c55e" },
  ].filter((d) => d.value > 0);

  // Priority distribution
  const priorityData = [
    { name: "Low", value: tasks.filter((t) => t.priority === "low").length, color: "#22c55e" },
    { name: "Medium", value: tasks.filter((t) => t.priority === "medium").length, color: "#f59e0b" },
    { name: "High", value: tasks.filter((t) => t.priority === "high").length, color: "#ef4444" },
    { name: "Urgent", value: tasks.filter((t) => t.priority === "urgent").length, color: "#8b5cf6" },
  ].filter((d) => d.value > 0);

  // Completion percentage
  const completedTasks = tasks.filter((t) => t.status === "done").length;
  const totalTasks = tasks.length;
  const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border rounded-lg shadow-lg px-3 py-2">
          <p className="text-sm font-medium">{payload[0].name}</p>
          <p className="text-sm text-muted-foreground">
            {payload[0].value} task{payload[0].value !== 1 ? "s" : ""}
          </p>
        </div>
      );
    }
    return null;
  };

  if (totalTasks === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No tasks to display charts.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {/* Completion Progress */}
      <Card>
        <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-2">
          <CardTitle className="text-sm font-medium">Completion</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <div className="flex flex-col items-center">
            <div className="relative w-32 h-32">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { value: completedTasks, color: "#22c55e" },
                      { value: totalTasks - completedTasks, color: "#e5e7eb" },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={50}
                    startAngle={90}
                    endAngle={-270}
                    dataKey="value"
                    stroke="none"
                  >
                    {[
                      { value: completedTasks, color: "#22c55e" },
                      { value: totalTasks - completedTasks, color: "#e5e7eb" },
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold">{completionPercent}%</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {completedTasks} of {totalTasks} tasks
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Status Distribution */}
      <Card>
        <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-2">
          <CardTitle className="text-sm font-medium">By Status</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <div className="h-28 sm:h-32">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={25}
                  outerRadius={45}
                  dataKey="value"
                  stroke="none"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {statusData.map((entry) => (
              <div key={entry.name} className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-xs text-muted-foreground">
                  {entry.name} ({entry.value})
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Priority Distribution */}
      <Card>
        <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-2">
          <CardTitle className="text-sm font-medium">By Priority</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <div className="h-28 sm:h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  width={50}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {priorityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
