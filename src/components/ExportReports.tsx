import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileText, FileSpreadsheet, Table } from "lucide-react";
import { exportToPDF, exportToCSV, exportToExcel } from "@/lib/exportUtils";
import { Project, Task, Profile } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface ExportReportsProps {
  project: Project;
  tasks: (Task & { assignee?: Profile })[];
}

export function ExportReports({ project, tasks }: ExportReportsProps) {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: "pdf" | "csv" | "excel") => {
    setExporting(true);
    try {
      const exportData = { project, tasks };

      switch (format) {
        case "pdf":
          exportToPDF(exportData);
          break;
        case "csv":
          exportToCSV(exportData);
          break;
        case "excel":
          exportToExcel(exportData);
          break;
      }

      toast({
        title: "Export complete",
        description: `Report exported as ${format.toUpperCase()}.`,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "There was an error exporting the report.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={exporting} className="text-xs sm:text-sm">
          <Download className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Export</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("pdf")}>
          <FileText className="h-4 w-4 mr-2" />
          Export as PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("csv")}>
          <Table className="h-4 w-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("excel")}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export as Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
