import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { Project, Task, Profile } from "@/lib/supabase";

interface ExportData {
  project: Project;
  tasks: (Task & { assignee?: Profile })[];
}

export const exportToPDF = ({ project, tasks }: ExportData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(20);
  doc.setTextColor(40, 40, 40);
  doc.text(project.name, pageWidth / 2, 20, { align: "center" });

  // Project info
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  const statusText = `Status: ${project.status.replace("_", " ").toUpperCase()}`;
  doc.text(statusText, pageWidth / 2, 28, { align: "center" });

  if (project.description) {
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    const descriptionLines = doc.splitTextToSize(project.description, pageWidth - 40);
    doc.text(descriptionLines, 20, 38);
  }

  // Summary stats
  const todoCount = tasks.filter((t) => t.status === "todo").length;
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;
  const doneCount = tasks.filter((t) => t.status === "done").length;

  doc.setFontSize(12);
  doc.setTextColor(40, 40, 40);
  doc.text("Project Summary", 20, 55);

  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`Total Tasks: ${tasks.length}`, 20, 63);
  doc.text(`To Do: ${todoCount} | In Progress: ${inProgressCount} | Done: ${doneCount}`, 20, 70);
  doc.text(`Generated: ${format(new Date(), "PPP 'at' p")}`, 20, 77);

  // Tasks table
  const tableData = tasks.map((task) => [
    task.title,
    task.status.replace("_", " "),
    task.priority,
    task.assignee?.full_name || task.assignee?.email || "Unassigned",
    task.due_date ? format(new Date(task.due_date), "MMM d, yyyy") : "-",
  ]);

  autoTable(doc, {
    startY: 85,
    head: [["Task", "Status", "Priority", "Assignee", "Due Date"]],
    body: tableData,
    headStyles: {
      fillColor: [239, 100, 53],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
    },
  });

  doc.save(`${project.name.replace(/\s+/g, "_")}_Report.pdf`);
};

export const exportToCSV = ({ project, tasks }: ExportData) => {
  const headers = ["Title", "Description", "Status", "Priority", "Assignee", "Due Date", "Created At"];
  
  const rows = tasks.map((task) => [
    task.title,
    task.description || "",
    task.status.replace("_", " "),
    task.priority,
    task.assignee?.full_name || task.assignee?.email || "Unassigned",
    task.due_date ? format(new Date(task.due_date), "yyyy-MM-dd") : "",
    format(new Date(task.created_at), "yyyy-MM-dd"),
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${project.name.replace(/\s+/g, "_")}_Tasks.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

export const exportToExcel = ({ project, tasks }: ExportData) => {
  // Project info sheet data
  const projectInfo = [
    ["Project Name", project.name],
    ["Status", project.status.replace("_", " ")],
    ["Description", project.description || ""],
    ["Start Date", project.start_date ? format(new Date(project.start_date), "yyyy-MM-dd") : ""],
    ["End Date", project.end_date ? format(new Date(project.end_date), "yyyy-MM-dd") : ""],
    ["Generated", format(new Date(), "yyyy-MM-dd HH:mm")],
    [],
    ["Summary"],
    ["Total Tasks", tasks.length],
    ["To Do", tasks.filter((t) => t.status === "todo").length],
    ["In Progress", tasks.filter((t) => t.status === "in_progress").length],
    ["Done", tasks.filter((t) => t.status === "done").length],
  ];

  // Tasks sheet data
  const taskHeaders = ["Title", "Description", "Status", "Priority", "Assignee", "Due Date", "Created At"];
  const taskRows = tasks.map((task) => [
    task.title,
    task.description || "",
    task.status.replace("_", " "),
    task.priority,
    task.assignee?.full_name || task.assignee?.email || "Unassigned",
    task.due_date ? format(new Date(task.due_date), "yyyy-MM-dd") : "",
    format(new Date(task.created_at), "yyyy-MM-dd"),
  ]);

  const workbook = XLSX.utils.book_new();

  // Project info sheet
  const infoSheet = XLSX.utils.aoa_to_sheet(projectInfo);
  XLSX.utils.book_append_sheet(workbook, infoSheet, "Project Info");

  // Tasks sheet
  const tasksSheet = XLSX.utils.aoa_to_sheet([taskHeaders, ...taskRows]);
  XLSX.utils.book_append_sheet(workbook, tasksSheet, "Tasks");

  XLSX.writeFile(workbook, `${project.name.replace(/\s+/g, "_")}_Report.xlsx`);
};
