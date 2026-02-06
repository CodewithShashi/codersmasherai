import { Button } from "@/components/ui/button";
import { 
  ListTodo, 
  BarChart3, 
  Users, 
  AlertTriangle, 
  Zap,
  Calendar
} from "lucide-react";

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void;
}

const suggestions = [
  {
    icon: ListTodo,
    label: "Create tasks",
    prompt: "Help me create tasks for a new feature development",
  },
  {
    icon: BarChart3,
    label: "Project summary",
    prompt: "Give me a summary of all my active projects",
  },
  {
    icon: Users,
    label: "Team workload",
    prompt: "Analyze my team's current workload distribution",
  },
  {
    icon: AlertTriangle,
    label: "Risk alerts",
    prompt: "What tasks are at risk of missing their deadlines?",
  },
  {
    icon: Zap,
    label: "Prioritize",
    prompt: "Help me prioritize my pending tasks",
  },
  {
    icon: Calendar,
    label: "Weekly summary",
    prompt: "Generate a weekly progress report",
  },
];

export function SuggestedPrompts({ onSelect }: SuggestedPromptsProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {suggestions.map((suggestion) => (
        <Button
          key={suggestion.label}
          variant="outline"
          size="sm"
          className="h-auto py-3 px-3 flex flex-col items-start gap-1.5 text-left hover:bg-primary/5 hover:border-primary/30 focus:bg-primary/10 focus:text-foreground active:text-foreground transition-colors"
          onClick={() => onSelect(suggestion.prompt)}
        >
          <suggestion.icon className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium text-foreground">{suggestion.label}</span>
        </Button>
      ))}
    </div>
  );
}
