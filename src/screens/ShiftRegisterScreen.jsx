import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Utility helpers for issue age and shifts affected calculation
function calculateIssueAge(createdAt) {
  if (!createdAt) return "N/A";
  const diffMs = Date.now() - new Date(createdAt).getTime();
  if (diffMs < 0) return "Just now";
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  const remMins = diffMins % 60;
  if (diffHours < 24) return `${diffHours}h ${remMins > 0 ? `${remMins}m` : ""}`.trim();
  const diffDays = Math.floor(diffHours / 24);
  const remHours = diffHours % 24;
  return `${diffDays}d ${remHours > 0 ? `${remHours}h` : ""}`.trim();
}

function calculateShiftsAffected(issue) {
  if (!issue.created_at) return 1;
  const diffHours = (Date.now() - new Date(issue.created_at).getTime()) / (1000 * 3600);
  const shiftCount = Math.max(1, Math.ceil(diffHours / 8));
  return issue.carry_forward ? Math.max(2, shiftCount) : shiftCount;
}

export default function ShiftRegisterScreen({
  activeScreen,
  currentAgent,
  sirState,
}) {
  const {
    issues = [],
    shifts = [],
    escalationTargets = [],
    loading,
    activeShiftName,
    handleSelectActiveShift,
    getCurrentActiveShift,
    handleCreateIssue,
    handleUpdateIssue,
    handleDeleteIssue,
  } = sirState || {};

  const currentShiftName = activeShiftName || getCurrentActiveShift();

  // Search, filter, and tab states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All"); // "All", "Ongoing", "Monitoring", "Resolved"
  const [shiftFilter, setShiftFilter] = useState("All"); // "All" or specific shift name
  const [carryForwardOnly, setCarryForwardOnly] = useState(false);
  const [viewMode, setViewMode] = useState("table"); // "table" or "cards"
  const [archiveCollapsed, setArchiveCollapsed] = useState(false);
  const [selectedDateFilter, setSelectedDateFilter] = useState("All");
  const [selectedArchiveMonth, setSelectedArchiveMonth] = useState("All");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editIssueId, setEditIssueId] = useState(null);
  const [timelineModalIssue, setTimelineModalIssue] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);

  // Form Fields
  const [title, setTitle] = useState("");
  const [selectedShiftForIssue, setSelectedShiftForIssue] = useState("");
  const [timeNoticed, setTimeNoticed] = useState("");
  const [description, setDescription] = useState("");
  const [actionsTaken, setActionsTaken] = useState("");
  const [customerResponse, setCustomerResponse] = useState("");
  const [status, setStatus] = useState("Ongoing");
  const [escalatedToSelect, setEscalatedToSelect] = useState("None");
  const [escalatedToCustom, setEscalatedToCustom] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [carryForward, setCarryForward] = useState(false);
  const [nextShiftInstructions, setNextShiftInstructions] = useState("");

  // Export Period & Format State
  const [exportPeriod, setExportPeriod] = useState("current_week"); // "current_week", "previous_week", "this_month", "custom"
  const [customStartDate, setCustomStartDate] = useState(new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [exportFormat, setExportFormat] = useState("excel"); // "excel", "pdf", "csv"

  const resetForm = () => {
    setEditIssueId(null);
    setTitle("");
    setSelectedShiftForIssue(currentShiftName);
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setTimeNoticed(timeStr);
    setDescription("");
    setActionsTaken("");
    setCustomerResponse("");
    setStatus("Ongoing");
    setEscalatedToSelect(escalationTargets[0]?.name || "None");
    setEscalatedToCustom("");
    setAdditionalNotes("");
    setCarryForward(false);
    setNextShiftInstructions("");
  };

  const handleOpenRecordModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleOpenEditModal = (issue) => {
    setEditIssueId(issue.id);
    setTitle(issue.title || "");
    setSelectedShiftForIssue(issue.shift_name || currentShiftName);
    setTimeNoticed(issue.time_noticed || "");
    setDescription(issue.description || "");
    setActionsTaken(issue.actions_taken || "");
    setCustomerResponse(issue.customer_response || "");
    setStatus(issue.status || "Ongoing");

    const targetNames = (escalationTargets || []).map((t) => t.name);
    if (targetNames.includes(issue.escalated_to)) {
      setEscalatedToSelect(issue.escalated_to);
      setEscalatedToCustom("");
    } else if (!issue.escalated_to || issue.escalated_to === "None") {
      setEscalatedToSelect("None");
      setEscalatedToCustom("");
    } else {
      setEscalatedToSelect("Other");
      setEscalatedToCustom(issue.escalated_to);
    }

    setAdditionalNotes(issue.additional_notes || "");
    setCarryForward(Boolean(issue.carry_forward));
    setNextShiftInstructions(issue.next_shift_instructions || "");
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !actionsTaken.trim()) return;

    const finalEscalatedTo =
      escalatedToSelect === "Other"
        ? escalatedToCustom.trim() || "Other"
        : escalatedToSelect;

    const payload = {
      title: title.trim(),
      shift_name: selectedShiftForIssue || currentShiftName,
      time_noticed: timeNoticed.trim() || "00:00",
      description: description.trim(),
      actions_taken: actionsTaken.trim(),
      customer_response: customerResponse.trim() || null,
      status,
      escalated_to: finalEscalatedTo,
      additional_notes: additionalNotes.trim() || null,
      carry_forward: carryForward,
      next_shift_instructions: carryForward ? nextShiftInstructions.trim() || null : null,
    };

    if (editIssueId) {
      await handleUpdateIssue(editIssueId, payload);
    } else {
      await handleCreateIssue(payload);
    }

    setShowModal(false);
    resetForm();
  };

  const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const getWeekRangeForDay = (weekStartDayName = "Monday", offsetWeeks = 0) => {
    const now = new Date();
    const targetStartIdx = WEEKDAYS.findIndex((d) => d.toLowerCase() === (weekStartDayName || "Monday").toLowerCase());
    const startIdx = targetStartIdx !== -1 ? targetStartIdx : 1; // Default Monday

    const currentDayIdx = now.getDay();
    let diff = currentDayIdx - startIdx;
    if (diff < 0) diff += 7;

    const start = new Date(now);
    start.setDate(now.getDate() - diff - (offsetWeeks * 7));
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  };

  const configuredWeekStart = localStorage.getItem("REA_COMPANY_WEEK_START") || "Monday";

  // Helper to filter issues for export according to selected period
  const getIssuesForPeriod = () => {
    const now = new Date();
    let start = new Date(0);
    let end = new Date(2100, 0, 1);

    if (exportPeriod === "current_week") {
      const range = getWeekRangeForDay(configuredWeekStart, 0);
      start = range.start;
      end = range.end;
    } else if (exportPeriod === "previous_week") {
      const range = getWeekRangeForDay(configuredWeekStart, 1);
      start = range.start;
      end = range.end;
    } else if (exportPeriod === "this_month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (exportPeriod === "custom") {
      if (customStartDate) start = new Date(`${customStartDate}T00:00:00`);
      if (customEndDate) end = new Date(`${customEndDate}T23:59:59`);
    }

    return (issues || []).filter((i) => {
      const t = i.created_at ? new Date(i.created_at).getTime() : Date.now();
      return t >= start.getTime() && t <= end.getTime();
    });
  };

  // --- EXPORT HANDLERS ---
  const handleRunExport = () => {
    const periodIssues = getIssuesForPeriod();
    if (exportFormat === "excel") {
      exportExcelWorkbook(periodIssues);
    } else if (exportFormat === "pdf") {
      exportManagementPdf(periodIssues);
    } else {
      exportCsvFile(periodIssues);
    }
  };

  const exportExcelWorkbook = (periodIssues) => {
    try {
      const now = new Date();
      const currentMonthName = now.toLocaleString("default", { month: "long" });
      const currentYear = now.getFullYear();

      const totalCount = periodIssues.length;
      const resolvedCount = periodIssues.filter((i) => i.status === "Resolved").length;
      const ongoingCount = periodIssues.filter((i) => i.status === "Ongoing").length;
      const monitoringCount = periodIssues.filter((i) => i.status === "Monitoring").length;
      const persistentCount = periodIssues.filter((i) => calculateShiftsAffected(i) >= 2 || i.carry_forward).length;
      const escalatedCount = periodIssues.filter((i) => i.escalated_to && i.escalated_to !== "None").length;

      // Sheet 1 --- Summary
      const summaryData = [
        ["SHIFT ISSUE REGISTER (SIR) - MANAGEMENT EXECUTIVE SUMMARY"],
        [""],
        ["Export Generated:", `${now.toLocaleDateString()} at ${now.toLocaleTimeString()}`],
        ["Reporting Period:", exportPeriod.toUpperCase().replace("_", " ")],
        [""],
        ["KPI Metric", "Count", "Share"],
        ["Total Shift Issues", totalCount, "100%"],
        ["Resolved", resolvedCount, `${totalCount ? Math.round((resolvedCount / totalCount) * 100) : 0}%`],
        ["Ongoing (Active)", ongoingCount, `${totalCount ? Math.round((ongoingCount / totalCount) * 100) : 0}%`],
        ["Monitoring", monitoringCount, `${totalCount ? Math.round((monitoringCount / totalCount) * 100) : 0}%`],
        ["Persistent / Carried Issues", persistentCount, `${totalCount ? Math.round((persistentCount / totalCount) * 100) : 0}%`],
        ["Escalated to Senior Teams", escalatedCount, `${totalCount ? Math.round((escalatedCount / totalCount) * 100) : 0}%`],
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

      // Sheet 2 --- Issue Register
      const registerRows = periodIssues.map((item) => ({
        "Reference No": item.reference_no || `#SIR-${item.id}`,
        "Title": item.title,
        "Status": item.status,
        "Shift": item.shift_name || "N/A",
        "Time Noticed": item.time_noticed,
        "Issue Age": calculateIssueAge(item.created_at),
        "Shifts Affected": calculateShiftsAffected(item),
        "Description": item.description,
        "Actions Taken": item.actions_taken,
        "Customer Response": item.customer_response || "",
        "Escalated To": item.escalated_to || "None",
        "Carried Forward": item.carry_forward ? "Yes" : "No",
        "Next Shift Instructions": item.next_shift_instructions || "",
        "Logged By Agent": `${item.logged_by_name || "Agent"} (${item.logged_by_initials || "AG"})`,
        "Created Date": item.created_at ? new Date(item.created_at).toLocaleString() : "",
      }));
      const registerSheet = XLSX.utils.json_to_sheet(registerRows);

      // Sheet 3 --- Recurring Issues
      const recurringMap = {};
      periodIssues.forEach((item) => {
        const title = (item.title || "General Issue").trim();
        const key = title.charAt(0).toUpperCase() + title.slice(1);
        recurringMap[key] = (recurringMap[key] || 0) + 1;
      });
      const recurringData = [
        ["Issue Pattern Title", "Occurrences Count"],
        ...Object.entries(recurringMap).map(([title, count]) => [title, count]),
      ];
      const recurringSheet = XLSX.utils.aoa_to_sheet(recurringData);

      // Sheet 4 --- Outstanding Issues
      const outstandingRows = periodIssues
        .filter((i) => i.status !== "Resolved")
        .map((item) => ({
          "Reference No": item.reference_no || `#SIR-${item.id}`,
          "Title": item.title,
          "Status": item.status,
          "Shift": item.shift_name || "N/A",
          "Issue Age": calculateIssueAge(item.created_at),
          "Shifts Affected": calculateShiftsAffected(item),
          "Next Shift Instructions": item.next_shift_instructions || "",
          "Escalated To": item.escalated_to || "None",
        }));
      const outstandingSheet = XLSX.utils.json_to_sheet(outstandingRows);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, summarySheet, "Executive Summary");
      XLSX.utils.book_append_sheet(wb, registerSheet, "Issue Register");
      XLSX.utils.book_append_sheet(wb, recurringSheet, "Recurring Patterns");
      XLSX.utils.book_append_sheet(wb, outstandingSheet, "Outstanding Issues");

      XLSX.writeFile(wb, `SIR_Management_Workbook_${exportPeriod}_${currentMonthName}_${currentYear}.xlsx`);
      setShowExportModal(false);
    } catch (e) {
      console.error("Error exporting Excel workbook:", e);
      alert("Failed to export Excel workbook. Please try again.");
    }
  };

  const exportManagementPdf = (periodIssues) => {
    try {
      const doc = new jsPDF();
      const now = new Date();
      const currentMonthName = now.toLocaleString("default", { month: "long" });
      const currentYear = now.getFullYear();

      const totalCount = periodIssues.length;
      const resolvedCount = periodIssues.filter((i) => i.status === "Resolved").length;
      const ongoingCount = periodIssues.filter((i) => i.status === "Ongoing").length;
      const monitoringCount = periodIssues.filter((i) => i.status === "Monitoring").length;
      const escalatedCount = periodIssues.filter((i) => i.escalated_to && i.escalated_to !== "None").length;

      doc.setFillColor(15, 155, 0);
      doc.rect(0, 0, 210, 22, "F");

      const savedLogo = localStorage.getItem("REA_COMPANY_LOGO") || "";
      let textX = 14;

      if (savedLogo) {
        try {
          doc.addImage(savedLogo, "PNG", 10, 2.5, 17, 17);
          textX = 32;
        } catch (e) {
          textX = 14;
        }
      }

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(savedLogo ? 11 : 13);
      doc.text("SHIFT ISSUE REGISTER (SIR) - MANAGEMENT REPORT", textX, 14);

      doc.setTextColor(50, 50, 50);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Reporting Period: ${exportPeriod.toUpperCase().replace("_", " ")}`, 14, 30);
      doc.text(`Generated On: ${now.toLocaleDateString()} at ${now.toLocaleTimeString()}`, 14, 36);

      autoTable(doc, {
        startY: 42,
        head: [["KPI Metric", "Count", "Percentage Share"]],
        body: [
          ["Total Shift Issues Recorded", totalCount.toString(), "100%"],
          ["Resolved Issues", resolvedCount.toString(), `${totalCount ? Math.round((resolvedCount / totalCount) * 100) : 0}%`],
          ["Ongoing Issues (Active)", ongoingCount.toString(), `${totalCount ? Math.round((ongoingCount / totalCount) * 100) : 0}%`],
          ["Monitoring Status", monitoringCount.toString(), `${totalCount ? Math.round((monitoringCount / totalCount) * 100) : 0}%`],
          ["Escalated to Senior Teams", escalatedCount.toString(), `${totalCount ? Math.round((escalatedCount / totalCount) * 100) : 0}%`],
        ],
        headStyles: { fillStyle: "F", fillColor: [30, 30, 45], textColor: [76, 211, 76], fontStyle: "bold" },
        styles: { fontSize: 9 },
      });

      // Executive Outstanding Issues Table
      const outstandingData = periodIssues
        .filter((i) => i.status !== "Resolved")
        .slice(0, 15)
        .map((i) => [
          i.reference_no || `#SIR-${i.id}`,
          i.title,
          i.shift_name || "N/A",
          calculateIssueAge(i.created_at),
          i.status,
          i.escalated_to || "None",
        ]);

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 8,
        head: [["ID", "Issue Title", "Shift", "Age", "Status", "Escalated To"]],
        body: outstandingData.length > 0 ? outstandingData : [["-", "No active outstanding issues", "-", "-", "-", "-"]],
        headStyles: { fillStyle: "F", fillColor: [30, 30, 45], textColor: [76, 211, 76], fontStyle: "bold" },
        styles: { fontSize: 8 },
      });

      const finalY = doc.lastAutoTable.finalY + 12;
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text("Confidential Operational Report — Response Escalation Assistant (REA)", 14, finalY);

      doc.save(`SIR_Management_Report_${exportPeriod}_${currentMonthName}_${currentYear}.pdf`);
      setShowExportModal(false);
    } catch (e) {
      console.error("Error generating PDF Management Report:", e);
      alert("Failed to export PDF Management Report. Please try again.");
    }
  };

  const exportCsvFile = (periodIssues) => {
    try {
      const headers = [
        "Reference No",
        "Title",
        "Status",
        "Shift",
        "Time Noticed",
        "Issue Age",
        "Shifts Affected",
        "Description",
        "Actions Taken",
        "Customer Response",
        "Escalated To",
        "Carried Forward",
        "Logged By",
        "Created Date",
      ];

      const rows = periodIssues.map((i) => [
        `"${(i.reference_no || `#SIR-${i.id}`).replace(/"/g, '""')}"`,
        `"${(i.title || "").replace(/"/g, '""')}"`,
        `"${(i.status || "").replace(/"/g, '""')}"`,
        `"${(i.shift_name || "").replace(/"/g, '""')}"`,
        `"${(i.time_noticed || "").replace(/"/g, '""')}"`,
        `"${calculateIssueAge(i.created_at)}"`,
        `"${calculateShiftsAffected(i)}"`,
        `"${(i.description || "").replace(/"/g, '""')}"`,
        `"${(i.actions_taken || "").replace(/"/g, '""')}"`,
        `"${(i.customer_response || "").replace(/"/g, '""')}"`,
        `"${(i.escalated_to || "None").replace(/"/g, '""')}"`,
        `"${i.carry_forward ? "Yes" : "No"}"`,
        `"${(i.logged_by_name || "Agent").replace(/"/g, '""')}"`,
        `"${i.created_at ? new Date(i.created_at).toLocaleString() : ""}"`,
      ]);

      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `SIR_Issue_Register_${exportPeriod}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setShowExportModal(false);
    } catch (e) {
      console.error("Error exporting CSV:", e);
      alert("Failed to export CSV. Please try again.");
    }
  };

  const getShiftIcon = (name = "") => {
    const lower = name.toLowerCase();
    if (lower.includes("morning")) return "☀️";
    if (lower.includes("afternoon") || lower.includes("day")) return "🌆";
    if (lower.includes("night") || lower.includes("graveyard")) return "🌙";
    return "⏰";
  };

  // Metric Counts
  const metrics = useMemo(() => {
    const total = issues.length;
    const ongoing = issues.filter((i) => i.status === "Ongoing").length;
    const monitoring = issues.filter((i) => i.status === "Monitoring").length;
    const carried = issues.filter((i) => i.carry_forward && i.status !== "Resolved").length;
    const resolved = issues.filter((i) => i.status === "Resolved").length;

    return {
      total,
      ongoing,
      monitoring,
      carried,
      resolved,
      ongoingPct: total ? Math.round((ongoing / total) * 100) : 0,
      monitoringPct: total ? Math.round((monitoring / total) * 100) : 0,
      carriedPct: total ? Math.round((carried / total) * 100) : 0,
      resolvedPct: total ? Math.round((resolved / total) * 100) : 0,
    };
  }, [issues]);

  // Operational Attention List (Needs Attention centerpiece)
  const needsAttentionList = useMemo(() => {
    return (issues || []).filter((i) => {
      if (i.status === "Resolved") return false;
      const isPersistent = calculateShiftsAffected(i) >= 2;
      return i.status === "Ongoing" || i.carry_forward || isPersistent || i.status === "Monitoring";
    });
  }, [issues]);

  // Current Shift Active Issues List
  const thisShiftIssuesList = useMemo(() => {
    return (issues || []).filter((i) => i.shift_name === currentShiftName);
  }, [issues, currentShiftName]);

  // Recurring Issue Patterns Analysis
  const recurringPatterns = useMemo(() => {
    const map = {};
    (issues || []).forEach((item) => {
      const title = (item.title || "General Issue").trim();
      const key = title.charAt(0).toUpperCase() + title.slice(1);
      map[key] = (map[key] || 0) + 1;
    });

    const maxCount = Math.max(1, ...Object.values(map));

    return Object.entries(map)
      .map(([title, count]) => ({
        title,
        count,
        pct: Math.round((count / maxCount) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [issues]);

  // Filtered issues calculation for Archive Table / Cards
  const filteredIssues = useMemo(() => {
    return (issues || []).filter((item) => {
      if (statusFilter !== "All" && item.status !== statusFilter) return false;
      if (shiftFilter !== "All" && item.shift_name !== shiftFilter) return false;
      if (carryForwardOnly && !item.carry_forward) return false;

      if (selectedDateFilter !== "All") {
        const itemDate = item.created_at ? new Date(item.created_at).toISOString().slice(0, 10) : "";
        if (itemDate !== selectedDateFilter) return false;
      }

      if (selectedArchiveMonth !== "All") {
        const itemDateObj = item.created_at ? new Date(item.created_at) : new Date();
        const monthKey = `${itemDateObj.getFullYear()}-${String(itemDateObj.getMonth() + 1).padStart(2, "0")}`;
        if (monthKey !== selectedArchiveMonth) return false;
      }

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const refMatch = (item.reference_no || "").toLowerCase().includes(query);
        const titleMatch = (item.title || "").toLowerCase().includes(query);
        const descMatch = (item.description || "").toLowerCase().includes(query);
        const escMatch = (item.escalated_to || "").toLowerCase().includes(query);
        const shiftMatch = (item.shift_name || "").toLowerCase().includes(query);
        const agentMatch = (item.logged_by_name || "").toLowerCase().includes(query);
        return refMatch || titleMatch || descMatch || escMatch || shiftMatch || agentMatch;
      }
      return true;
    });
  }, [issues, statusFilter, shiftFilter, carryForwardOnly, selectedDateFilter, selectedArchiveMonth, searchTerm]);

  if (activeScreen !== "shift_register") return null;

  return (
    <section className="max-w-7xl mx-auto space-y-8 animate-fadeIn pb-16">
      {/* OPERATIONAL DASHBOARD HEADER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-6" style={{ borderColor: "var(--panel-border)" }}>
        <div>
          <div className="flex items-center gap-3">
            <img src="/clipboard.png" alt="Register" className="h-8 w-8 object-contain shrink-0" />
            <h2 className="text-3xl font-extrabold tracking-tight" style={{ color: "var(--app-text)" }}>
              Shift Issue Register (SIR)
            </h2>
          </div>
          <p className="text-sm mt-1.5 font-medium" style={{ color: "var(--text-muted)" }}>
            Operational Intelligence Dashboard & Multi-Shift Issue Archive for Team Operations.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Active Shift Selector Pill */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-2xl border backdrop-blur text-xs font-bold" style={{ borderColor: "var(--field-border)", backgroundColor: "var(--panel-bg)", color: "var(--app-text)" }}>
            <span className="text-base">{getShiftIcon(currentShiftName)}</span>
            <select
              value={currentShiftName}
              onChange={(e) => handleSelectActiveShift(e.target.value)}
              className="bg-transparent font-bold focus:outline-none cursor-pointer"
              style={{ color: "var(--app-text)" }}
            >
              {(shifts || []).map((s) => (
                <option key={s.id || s.name} value={s.name} className="bg-[var(--app-bg)] text-[var(--app-text)] font-semibold">
                  {s.name} ({s.start_time} - {s.end_time})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setShowExportModal(true)}
            className="px-4 py-2.5 rounded-2xl border text-xs font-extrabold backdrop-blur shadow-sm transition hover:scale-[1.02] active:scale-95 flex items-center gap-2"
            style={{ borderColor: "var(--badge-border)", color: "var(--neutral-text)", backgroundColor: "var(--neutral-bg)" }}
          >
            <span className="text-sm">📥</span>
            <span>Export & Reports</span>
          </button>

          <button
            onClick={handleOpenRecordModal}
            className="px-5 py-2.5 rounded-2xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] text-xs font-extrabold shadow-lg transition hover:scale-[1.02] active:scale-95 flex items-center gap-2"
          >
            <span className="text-base font-black">+</span>
            <span>Record Issue</span>
          </button>
        </div>
      </div>

      {/* ROW 1: SITUATION SUMMARY METRIC CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Ongoing */}
        <div className="rounded-3xl border p-4 shadow-sm backdrop-blur transition hover:border-red-500/50" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-red-400">🔴 Ongoing</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-red-500/10 text-red-400">{metrics.ongoingPct}%</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-black" style={{ color: "var(--app-text)" }}>{metrics.ongoing}</span>
            <span className="text-xs text-[var(--text-muted)] font-medium">Unresolved</span>
          </div>
        </div>

        {/* Monitoring */}
        <div className="rounded-3xl border p-4 shadow-sm backdrop-blur transition hover:border-orange-500/50" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">🟠 Monitoring</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-amber-500/10 text-amber-400">{metrics.monitoringPct}%</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-black" style={{ color: "var(--app-text)" }}>{metrics.monitoring}</span>
            <span className="text-xs text-[var(--text-muted)] font-medium">Under Observation</span>
          </div>
        </div>

        {/* Carried Forward */}
        <div className="rounded-3xl border p-4 shadow-sm backdrop-blur transition hover:border-blue-500/50" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400">↪ Carried Forward</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-blue-500/10 text-blue-400">{metrics.carriedPct}%</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-black" style={{ color: "var(--app-text)" }}>{metrics.carried}</span>
            <span className="text-xs text-[var(--text-muted)] font-medium">From Shifts</span>
          </div>
        </div>

        {/* Resolved */}
        <div className="rounded-3xl border p-4 shadow-sm backdrop-blur transition hover:border-emerald-500/50" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#4cd34c]">🟢 Resolved</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-[#4cd34c]/10 text-[#4cd34c]">{metrics.resolvedPct}%</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-black" style={{ color: "var(--app-text)" }}>{metrics.resolved}</span>
            <span className="text-xs text-[var(--text-muted)] font-medium">Closed</span>
          </div>
        </div>
      </div>

      {/* ROW 2: ⚠ NEEDS ATTENTION (OPERATIONAL CENTERPIECE WITH LIVE PULSE DOT) */}
      <div className="rounded-3xl border p-6 shadow-md backdrop-blur space-y-4 relative overflow-hidden" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}>
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--field-border)" }}>
          <div className="flex items-center gap-3">
            {/* Live Pulsing Red Dot Indicator */}
            <span className="relative flex h-3.5 w-3.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]"></span>
            </span>
            <h3 className="text-lg font-black tracking-tight text-red-400 flex items-center gap-2">
              <span>NEEDS ATTENTION</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-red-500/20 text-red-400 border border-red-500/30 font-mono shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                {needsAttentionList.length}
              </span>
            </h3>
          </div>
          <span className="text-xs font-medium text-[var(--text-muted)] hidden sm:inline">
            Auto-surfaced active, carried, & persistent incidents requiring immediate operational focus
          </span>
        </div>

        {needsAttentionList.length === 0 ? (
          <div className="p-8 text-center border-2 border-dashed rounded-2xl" style={{ borderColor: "var(--field-border)" }}>
            <span className="text-3xl block mb-2">🎉</span>
            <p className="text-sm font-bold text-[#4cd34c]">All clear! No open or unresolved issues requiring attention.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {needsAttentionList.map((issue) => {
              const age = calculateIssueAge(issue.created_at);
              const shiftsAffected = calculateShiftsAffected(issue);
              const isPersistent = shiftsAffected >= 2;

              return (
                <div
                  key={issue.id}
                  className="rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-[#4cd34c] flex flex-col justify-between space-y-3 relative group overflow-hidden"
                  style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)" }}
                >
                  {issue.status === "Ongoing" && (
                    <span className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-amber-500 to-red-500 animate-pulse" />
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md font-mono bg-[var(--panel-bg)] text-[var(--text-muted)]">
                        {issue.reference_no || `#SIR-${issue.id}`}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {issue.status === "Ongoing" ? (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.3)]">🔴 Ongoing</span>
                        ) : (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">🟠 Monitoring</span>
                        )}
                        {issue.carry_forward && (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">↪ Carried</span>
                        )}
                      </div>
                    </div>

                    <h4 className="text-sm font-black line-clamp-1 group-hover:text-[#4cd34c] transition-colors" style={{ color: "var(--app-text)" }}>
                      {issue.title}
                    </h4>

                    <p className="text-xs mt-1 line-clamp-2" style={{ color: "var(--text-muted)" }}>
                      {issue.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t space-y-2" style={{ borderColor: "var(--panel-border)" }}>
                    <div className="flex items-center justify-between text-[11px] font-semibold">
                      <span className="text-amber-400 flex items-center gap-1">
                        ⏱️ Age: <strong>{age}</strong>
                      </span>
                      {isPersistent && (
                        <span className="text-red-400 font-extrabold flex items-center gap-1">
                          🔥 {shiftsAffected} shifts affected
                        </span>
                      )}
                    </div>

                    {issue.next_shift_instructions && (
                      <div className="text-[11px] p-2 rounded-xl border bg-[var(--app-bg)] text-amber-300 font-mono italic">
                        <strong>Instructions:</strong> {issue.next_shift_instructions}
                      </div>
                    )}

                    <button
                      onClick={() => setTimelineModalIssue(issue)}
                      className="w-full py-1.5 rounded-xl border text-xs font-bold text-[#4cd34c] hover:bg-[#4cd34c]/10 transition-all active:scale-95 flex items-center justify-center gap-1"
                      style={{ borderColor: "var(--badge-border)" }}
                    >
                      <span>View Issue Story</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ROW 3: 📌 THIS SHIFT & 📈 RECURRING ISSUES (2-COLUMN GRID) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* THIS SHIFT ISSUES */}
        <div className="rounded-3xl border p-5 shadow-md backdrop-blur space-y-4" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}>
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--field-border)" }}>
            <div className="flex items-center gap-2">
              <span className="text-lg">📌</span>
              <h3 className="text-base font-black tracking-tight" style={{ color: "var(--app-text)" }}>
                THIS SHIFT ({currentShiftName})
              </h3>
            </div>
            <span className="text-xs font-bold text-[#4cd34c]">{thisShiftIssuesList.length} Issue(s)</span>
          </div>

          {thisShiftIssuesList.length === 0 ? (
            <div className="p-6 text-center text-xs text-[var(--text-muted)] border border-dashed rounded-2xl" style={{ borderColor: "var(--field-border)" }}>
              No issues recorded during {currentShiftName} yet.
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {thisShiftIssuesList.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border p-3 flex items-center justify-between transition hover:border-[#4cd34c]"
                  style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)" }}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black" style={{ color: "var(--app-text)" }}>{item.title}</span>
                      <span className="text-[10px] font-mono opacity-80" style={{ color: "var(--text-muted)" }}>{item.time_noticed}</span>
                    </div>
                    <p className="text-xs line-clamp-1" style={{ color: "var(--text-muted)" }}>{item.actions_taken}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.status === "Resolved" ? "bg-emerald-500/20 text-emerald-400" : item.status === "Monitoring" ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-400"}`}>
                      {item.status}
                    </span>
                    <button
                      onClick={() => setTimelineModalIssue(item)}
                      className="px-2 py-1 rounded-lg border text-[11px] font-bold text-[#4cd34c] hover:bg-[#4cd34c]/20"
                      style={{ borderColor: "var(--badge-border)" }}
                    >
                      Story
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RECURRING ISSUE PATTERNS */}
        <div className="rounded-3xl border p-5 shadow-md backdrop-blur space-y-4" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}>
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--field-border)" }}>
            <div className="flex items-center gap-2">
              <span className="text-lg">📈</span>
              <h3 className="text-base font-black tracking-tight" style={{ color: "var(--app-text)" }}>
                RECURRING ISSUE PATTERNS
              </h3>
            </div>
            <span className="text-xs font-medium text-[var(--text-muted)]">Frequency Trends</span>
          </div>

          {recurringPatterns.length === 0 ? (
            <div className="p-6 text-center text-xs text-[var(--text-muted)] border border-dashed rounded-2xl" style={{ borderColor: "var(--field-border)" }}>
              No issue patterns recorded yet.
            </div>
          ) : (
            <div className="space-y-3.5 max-h-80 overflow-y-auto pr-1">
              {recurringPatterns.map((pat) => (
                <div key={pat.title} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span style={{ color: "var(--app-text)" }}>{pat.title}</span>
                    <span className="text-amber-400 font-extrabold">{pat.count} occurrence(s)</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full overflow-hidden bg-[var(--field-bg)] border" style={{ borderColor: "var(--field-border)" }}>
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#4cd34c_0%,#0f9b00_100%)] transition-all duration-500"
                      style={{ width: `${pat.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ROW 4: 📁 ISSUE HISTORY & ARCHIVE (COLLAPSIBLE MANAGEMENT TABLE GRID) */}
      <div className="rounded-3xl border p-6 shadow-md backdrop-blur space-y-5 transition-all duration-300" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4" style={{ borderColor: "var(--field-border)" }}>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📁</span>
              <h3 className="text-lg font-black tracking-tight" style={{ color: "var(--app-text)" }}>
                ISSUE HISTORY & ARCHIVE ({filteredIssues.length})
              </h3>
            </div>
            <p className="text-xs font-medium mt-0.5" style={{ color: "var(--text-muted)" }}>
              Search, filter, and inspect detailed historical records across shifts and reporting periods.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {!archiveCollapsed && (
              /* View Mode Toggle */
              <div className="flex items-center p-1 rounded-2xl border backdrop-blur animate-fadeIn" style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)" }}>
                <button
                  onClick={() => setViewMode("table")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${viewMode === "table" ? "bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007]" : "text-[var(--text-muted)]"}`}
                >
                  📋 Table View
                </button>
                <button
                  onClick={() => setViewMode("cards")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${viewMode === "cards" ? "bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007]" : "text-[var(--text-muted)]"}`}
                >
                  🎴 Cards View
                </button>
              </div>
            )}

            {/* Collapse / Expand Toggle Button */}
            <button
              onClick={() => setArchiveCollapsed(!archiveCollapsed)}
              className="px-3.5 py-2 rounded-2xl border text-xs font-bold backdrop-blur transition hover:scale-105 active:scale-95 flex items-center gap-1.5"
              style={{ borderColor: "var(--badge-border)", backgroundColor: "var(--neutral-bg)", color: "var(--app-text)" }}
            >
              <span>{archiveCollapsed ? "Expand Archive" : "Collapse Archive"}</span>
              <span className="text-sm font-black">{archiveCollapsed ? "▼" : "▲"}</span>
            </button>
          </div>
        </div>

        {archiveCollapsed ? (
          /* COLLAPSED ARCHIVE BANNER */
          <div className="p-8 text-center border-2 border-dashed rounded-2xl space-y-3 animate-fadeIn" style={{ borderColor: "var(--field-border)" }}>
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl">📁</span>
              <span className="text-sm font-extrabold" style={{ color: "var(--app-text)" }}>
                Historical Issue Archive ({filteredIssues.length} records) is currently collapsed
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
              Focusing on active shift operations. Click expand to search, filter, or export historical records.
            </p>
            <button
              onClick={() => setArchiveCollapsed(false)}
              className="px-6 py-2.5 rounded-2xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] text-xs font-extrabold shadow-lg transition hover:scale-105 active:scale-95 inline-flex items-center gap-2"
            >
              <span>Expand Historical Archive</span>
              <span>▼</span>
            </button>
          </div>
        ) : (
          /* EXPANDED ARCHIVE CONTENT */
          <div className="space-y-5 animate-fadeIn">
            {/* SEARCH & FILTERS BAR */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search Input */}
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search ID, title, shift, agent..."
                  className="w-full rounded-xl border p-2.5 text-xs font-medium focus:outline-none focus:border-[#4cd34c]"
                  style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-xl border p-2.5 text-xs font-bold focus:outline-none focus:border-[#4cd34c]"
                style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
              >
                <option value="All">Status: All Records</option>
                <option value="Ongoing">Status: 🔴 Ongoing Only</option>
                <option value="Monitoring">Status: 🟠 Monitoring Only</option>
                <option value="Resolved">Status: 🟢 Resolved Only</option>
              </select>

              {/* Shift Filter */}
              <select
                value={shiftFilter}
                onChange={(e) => setShiftFilter(e.target.value)}
                className="w-full rounded-xl border p-2.5 text-xs font-bold focus:outline-none focus:border-[#4cd34c]"
                style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
              >
                <option value="All">Shift: All Shifts</option>
                {(shifts || []).map((s) => (
                  <option key={s.id || s.name} value={s.name}>Shift: {s.name}</option>
                ))}
              </select>

              {/* Carry Forward Toggle */}
              <button
                onClick={() => setCarryForwardOnly(!carryForwardOnly)}
                className={`w-full py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${carryForwardOnly ? "bg-blue-500/20 text-blue-400 border-blue-500/50" : ""}`}
                style={!carryForwardOnly ? { borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" } : {}}
              >
                <span>↪</span>
                <span>{carryForwardOnly ? "Showing Carried Only" : "Show Carried Only"}</span>
              </button>
            </div>

            {/* ARCHIVE CONTENT TABLE / CARDS */}
            {filteredIssues.length === 0 ? (
              <div className="p-12 text-center border-2 border-dashed rounded-2xl space-y-2" style={{ borderColor: "var(--field-border)" }}>
                <span className="text-3xl block">🔍</span>
                <p className="text-sm font-bold" style={{ color: "var(--app-text)" }}>No matching issues found.</p>
                <p className="text-xs text-[var(--text-muted)]">Try adjusting your search terms or filter criteria.</p>
              </div>
            ) : viewMode === "table" ? (
              /* MANAGEMENT DENSE TABLE VIEW */
              <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--field-border)" }}>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b bg-[var(--field-bg)] text-[var(--text-muted)] uppercase tracking-wider font-extrabold" style={{ borderColor: "var(--field-border)" }}>
                      <th className="p-3 font-bold">ID</th>
                      <th className="p-3 font-bold">Issue Title</th>
                      <th className="p-3 font-bold">Shift</th>
                      <th className="p-3 font-bold">Time Noticed</th>
                      <th className="p-3 font-bold">Issue Age</th>
                      <th className="p-3 font-bold">Status</th>
                      <th className="p-3 font-bold text-center">Shifts</th>
                      <th className="p-3 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: "var(--panel-border)" }}>
                    {filteredIssues.map((issue) => {
                      const age = calculateIssueAge(issue.created_at);
                      const shiftsAffected = calculateShiftsAffected(issue);

                      return (
                        <tr key={issue.id} className="hover:bg-[#4cd34c]/5 transition">
                          <td className="p-3 font-mono font-bold text-[var(--text-muted)]">
                            {issue.reference_no || `#SIR-${issue.id}`}
                          </td>
                          <td className="p-3 font-bold text-[var(--app-text)] max-w-xs truncate">
                            {issue.title}
                            {issue.carry_forward && (
                              <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-extrabold">
                                ↪ Carried
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-[var(--text-muted)] font-medium">
                            {getShiftIcon(issue.shift_name)} {issue.shift_name || "General"}
                          </td>
                          <td className="p-3 font-mono text-[var(--text-muted)]">
                            {issue.time_noticed}
                          </td>
                          <td className="p-3 font-mono font-extrabold text-amber-400">
                            {age}
                          </td>
                          <td className="p-3">
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${issue.status === "Resolved" ? "bg-emerald-500/20 text-emerald-400" : issue.status === "Monitoring" ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.2)]"}`}>
                              {issue.status}
                            </span>
                          </td>
                          <td className="p-3 text-center font-extrabold text-red-400 font-mono">
                            {shiftsAffected}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setTimelineModalIssue(issue)}
                                className="px-2.5 py-1 rounded-lg border text-[11px] font-bold text-[#4cd34c] hover:bg-[#4cd34c]/20 transition active:scale-95"
                                style={{ borderColor: "var(--badge-border)" }}
                              >
                                View Story
                              </button>
                              <button
                                onClick={() => handleOpenEditModal(issue)}
                                className="px-2 py-1 rounded-lg border text-[11px] font-bold text-[var(--app-text)] hover:opacity-80 transition active:scale-95"
                                style={{ borderColor: "var(--field-border)" }}
                              >
                                Edit
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* CARDS VIEW */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredIssues.map((issue) => (
                  <div key={issue.id} className="rounded-2xl border p-4 space-y-3 transition-all hover:border-[#4cd34c]" style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)" }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold opacity-75">{issue.reference_no || `#SIR-${issue.id}`}</span>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${issue.status === "Resolved" ? "bg-emerald-500/20 text-emerald-400" : issue.status === "Monitoring" ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-400"}`}>
                        {issue.status}
                      </span>
                    </div>
                    <h4 className="text-sm font-black">{issue.title}</h4>
                    <p className="text-xs line-clamp-2 text-[var(--text-muted)]">{issue.description}</p>
                    <div className="pt-2 border-t flex items-center justify-between text-xs" style={{ borderColor: "var(--panel-border)" }}>
                      <span className="font-mono text-amber-400">⏱️ {calculateIssueAge(issue.created_at)}</span>
                      <button
                        onClick={() => setTimelineModalIssue(issue)}
                        className="px-3 py-1 rounded-xl border font-bold text-[#4cd34c] hover:bg-[#4cd34c]/10 transition active:scale-95"
                        style={{ borderColor: "var(--badge-border)" }}
                      >
                        View Story →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: INTERACTIVE ISSUE STORY / TIMELINE DRAWER */}
      {timelineModalIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl rounded-3xl border shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)", color: "var(--app-text)" }}>
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--field-border)" }}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-extrabold px-2 py-0.5 rounded-md bg-[var(--field-bg)] text-[var(--text-muted)]">
                    {timelineModalIssue.reference_no || `#SIR-${timelineModalIssue.id}`}
                  </span>
                  <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${timelineModalIssue.status === "Resolved" ? "bg-emerald-500/20 text-emerald-400" : timelineModalIssue.status === "Monitoring" ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-400"}`}>
                    {timelineModalIssue.status}
                  </span>
                </div>
                <h3 className="text-xl font-black mt-1">{timelineModalIssue.title}</h3>
              </div>

              <button
                onClick={() => setTimelineModalIssue(null)}
                className="p-2 rounded-xl text-lg font-bold hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            {/* ISSUE STORY TIMELINE */}
            <div className="space-y-6 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-[#4cd34c] before:to-amber-500">
              {/* Step 1: Issue First Noticed */}
              <div className="relative pl-8 space-y-1">
                <div className="absolute left-1.5 top-1.5 w-3 h-3 rounded-full bg-[#4cd34c] ring-4 ring-[#4cd34c]/20" />
                <span className="text-[11px] font-bold text-[#4cd34c] uppercase font-mono">
                  {timelineModalIssue.time_noticed} — {timelineModalIssue.shift_name || "General Shift"}
                </span>
                <p className="text-sm font-bold">Issue First Recorded</p>
                <p className="text-xs text-[var(--text-muted)]">
                  Logged by {timelineModalIssue.logged_by_name || "Agent"} ({timelineModalIssue.logged_by_initials || "AG"})
                </p>
              </div>

              {/* Step 2: Problem Description */}
              <div className="relative pl-8 space-y-1">
                <div className="absolute left-1.5 top-1.5 w-3 h-3 rounded-full bg-blue-400 ring-4 ring-blue-400/20" />
                <span className="text-[11px] font-bold text-blue-400 uppercase font-mono">Problem Description</span>
                <div className="p-3 rounded-2xl border text-xs font-medium leading-relaxed" style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)" }}>
                  {timelineModalIssue.description}
                </div>
              </div>

              {/* Step 3: Technical Actions Taken */}
              <div className="relative pl-8 space-y-1">
                <div className="absolute left-1.5 top-1.5 w-3 h-3 rounded-full bg-amber-400 ring-4 ring-amber-400/20" />
                <span className="text-[11px] font-bold text-amber-400 uppercase font-mono">Technical Actions Taken</span>
                <div className="p-3 rounded-2xl border text-xs font-medium leading-relaxed" style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)" }}>
                  {timelineModalIssue.actions_taken}
                </div>
              </div>

              {/* Step 4: Customer Given Response */}
              {timelineModalIssue.customer_response && (
                <div className="relative pl-8 space-y-1">
                  <div className="absolute left-1.5 top-1.5 w-3 h-3 rounded-full bg-purple-400 ring-4 ring-purple-400/20" />
                  <span className="text-[11px] font-bold text-purple-400 uppercase font-mono">Customer Communication</span>
                  <div className="p-3 rounded-2xl border text-xs font-medium leading-relaxed" style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)" }}>
                    {timelineModalIssue.customer_response}
                  </div>
                </div>
              )}

              {/* Step 5: Escalation (if any) */}
              {timelineModalIssue.escalated_to && timelineModalIssue.escalated_to !== "None" && (
                <div className="relative pl-8 space-y-1">
                  <div className="absolute left-1.5 top-1.5 w-3 h-3 rounded-full bg-red-400 ring-4 ring-red-400/20" />
                  <span className="text-[11px] font-bold text-red-400 uppercase font-mono">Escalation Status</span>
                  <p className="text-xs font-bold">Escalated to: {timelineModalIssue.escalated_to}</p>
                </div>
              )}

              {/* Step 6: Shift Carry Forward Instructions */}
              {timelineModalIssue.carry_forward && (
                <div className="relative pl-8 space-y-1">
                  <div className="absolute left-1.5 top-1.5 w-3 h-3 rounded-full bg-amber-500 ring-4 ring-amber-500/20" />
                  <span className="text-[11px] font-bold text-amber-500 uppercase font-mono">↪ Shift Carry Forward Instructions</span>
                  <div className="p-3 rounded-2xl border text-xs font-bold text-amber-300 font-mono" style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)" }}>
                    {timelineModalIssue.next_shift_instructions || "Maintain active monitoring for next shift."}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 pt-3 border-t" style={{ borderColor: "var(--panel-border)" }}>
              <button
                onClick={() => setTimelineModalIssue(null)}
                className="px-5 py-2.5 rounded-xl border text-xs font-bold"
                style={{ borderColor: "var(--badge-border)" }}
              >
                Close Story
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: REPORTING PERIOD & MULTI-FORMAT EXPORT MODAL */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-3xl border shadow-2xl p-6 space-y-6" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)", color: "var(--app-text)" }}>
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--field-border)" }}>
              <div>
                <h3 className="text-lg font-black">EXPORT SHIFT ISSUES & REPORTING</h3>
                <p className="text-xs text-[var(--text-muted)] font-medium">Select organizational reporting period & export format</p>
              </div>
              <button onClick={() => setShowExportModal(false)} className="p-1 rounded-lg text-lg font-bold hover:bg-white/10">✕</button>
            </div>

            {/* Reporting Period Options */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider block text-[#4cd34c]">1. Select Reporting Period</label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition hover:border-[#4cd34c]" style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)" }}>
                  <input
                    type="radio"
                    name="period"
                    value="current_week"
                    checked={exportPeriod === "current_week"}
                    onChange={(e) => setExportPeriod(e.target.value)}
                    className="accent-[#4cd34c]"
                  />
                  <div>
                    <span className="text-xs font-bold block">Current Reporting Week ({configuredWeekStart} Start)</span>
                    <span className="text-[10px] text-[#4cd34c] font-mono font-bold">
                      {getWeekRangeForDay(configuredWeekStart, 0).start.getDate()} {getWeekRangeForDay(configuredWeekStart, 0).start.toLocaleString("default", { month: "short" })} – {getWeekRangeForDay(configuredWeekStart, 0).end.getDate()} {getWeekRangeForDay(configuredWeekStart, 0).end.toLocaleString("default", { month: "short" })} {getWeekRangeForDay(configuredWeekStart, 0).end.getFullYear()}
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition hover:border-[#4cd34c]" style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)" }}>
                  <input
                    type="radio"
                    name="period"
                    value="previous_week"
                    checked={exportPeriod === "previous_week"}
                    onChange={(e) => setExportPeriod(e.target.value)}
                    className="accent-[#4cd34c]"
                  />
                  <div>
                    <span className="text-xs font-bold block">Previous Reporting Week ({configuredWeekStart} Start)</span>
                    <span className="text-[10px] text-[#4cd34c] font-mono font-bold">
                      {getWeekRangeForDay(configuredWeekStart, 1).start.getDate()} {getWeekRangeForDay(configuredWeekStart, 1).start.toLocaleString("default", { month: "short" })} – {getWeekRangeForDay(configuredWeekStart, 1).end.getDate()} {getWeekRangeForDay(configuredWeekStart, 1).end.toLocaleString("default", { month: "short" })} {getWeekRangeForDay(configuredWeekStart, 1).end.getFullYear()}
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition hover:border-[#4cd34c]" style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)" }}>
                  <input
                    type="radio"
                    name="period"
                    value="this_month"
                    checked={exportPeriod === "this_month"}
                    onChange={(e) => setExportPeriod(e.target.value)}
                    className="accent-[#4cd34c]"
                  />
                  <div>
                    <span className="text-xs font-bold block">This Month</span>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">Current active month records</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition hover:border-[#4cd34c]" style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)" }}>
                  <input
                    type="radio"
                    name="period"
                    value="custom"
                    checked={exportPeriod === "custom"}
                    onChange={(e) => setExportPeriod(e.target.value)}
                    className="accent-[#4cd34c]"
                  />
                  <span className="text-xs font-bold">Custom Date Range</span>
                </label>

                {exportPeriod === "custom" && (
                  <div className="grid grid-cols-2 gap-3 pl-7 pt-1 animate-fadeIn">
                    <div>
                      <label className="text-[10px] font-bold block text-[var(--text-muted)]">From Date</label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-full p-2 rounded-xl border text-xs font-bold focus:outline-none"
                        style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold block text-[var(--text-muted)]">To Date</label>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full p-2 rounded-xl border text-xs font-bold focus:outline-none"
                        style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Export Format Options */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider block text-[#4cd34c]">2. Select Export Format</label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setExportFormat("excel")}
                  className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1 ${exportFormat === "excel" ? "bg-[#4cd34c]/20 border-[#4cd34c] text-[#4cd34c]" : "hover:border-[#4cd34c]"}`}
                  style={exportFormat !== "excel" ? { borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)" } : {}}
                >
                  <span className="text-lg">📊</span>
                  <span className="text-xs font-black">Excel (.xlsx)</span>
                  <span className="text-[9px] opacity-75 font-medium">Multi-Sheet</span>
                </button>

                <button
                  onClick={() => setExportFormat("pdf")}
                  className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1 ${exportFormat === "pdf" ? "bg-[#4cd34c]/20 border-[#4cd34c] text-[#4cd34c]" : "hover:border-[#4cd34c]"}`}
                  style={exportFormat !== "pdf" ? { borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)" } : {}}
                >
                  <span className="text-lg">📄</span>
                  <span className="text-xs font-black">PDF Report</span>
                  <span className="text-[9px] opacity-75 font-medium">Executive</span>
                </button>

                <button
                  onClick={() => setExportFormat("csv")}
                  className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1 ${exportFormat === "csv" ? "bg-[#4cd34c]/20 border-[#4cd34c] text-[#4cd34c]" : "hover:border-[#4cd34c]"}`}
                  style={exportFormat !== "csv" ? { borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)" } : {}}
                >
                  <span className="text-lg">🗃</span>
                  <span className="text-xs font-black">Raw CSV</span>
                  <span className="text-[9px] opacity-75 font-medium">Data Dump</span>
                </button>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-3 pt-3 border-t" style={{ borderColor: "var(--panel-border)" }}>
              <button onClick={() => setShowExportModal(false)} className="px-4 py-2.5 rounded-xl border text-xs font-bold" style={{ borderColor: "var(--badge-border)" }}>
                Cancel
              </button>
              <button
                onClick={handleRunExport}
                className="px-6 py-2.5 rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] text-xs font-extrabold shadow-lg transition hover:scale-105"
              >
                Export Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: RECORD / EDIT SHIFT ISSUE FORM */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl rounded-3xl border shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)", color: "var(--app-text)" }}>
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--field-border)" }}>
              <div>
                <h3 className="text-lg font-black">{editIssueId ? "Edit Shift Issue" : "Record New Shift Issue"}</h3>
                <p className="text-xs text-[var(--text-muted)] font-medium">Enter details for operational visibility & handovers</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg text-lg font-bold hover:bg-white/10">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold mb-1 block" style={{ color: "var(--text-muted)" }}>
                    Issue Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Payment Gateway Timeouts"
                    className="w-full rounded-xl border p-2.5 text-xs font-bold focus:outline-none focus:border-[#4cd34c]"
                    style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold mb-1 block" style={{ color: "var(--text-muted)" }}>
                    Shift Name
                  </label>
                  <select
                    value={selectedShiftForIssue}
                    onChange={(e) => setSelectedShiftForIssue(e.target.value)}
                    className="w-full rounded-xl border p-2.5 text-xs font-bold focus:outline-none focus:border-[#4cd34c]"
                    style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                  >
                    {(shifts || []).map((s) => (
                      <option key={s.id || s.name} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold mb-1 block" style={{ color: "var(--text-muted)" }}>
                    Time Noticed *
                  </label>
                  <input
                    type="text"
                    required
                    value={timeNoticed}
                    onChange={(e) => setTimeNoticed(e.target.value)}
                    placeholder="HH:MM (e.g. 14:35)"
                    className="w-full rounded-xl border p-2.5 text-xs font-bold focus:outline-none focus:border-[#4cd34c]"
                    style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold mb-1 block" style={{ color: "var(--text-muted)" }}>
                    Status *
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-xl border p-2.5 text-xs font-bold focus:outline-none focus:border-[#4cd34c]"
                    style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                  >
                    <option value="Ongoing">🔴 Ongoing</option>
                    <option value="Monitoring">🟠 Monitoring</option>
                    <option value="Resolved">🟢 Resolved</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold mb-1 block" style={{ color: "var(--text-muted)" }}>
                    Escalated To
                  </label>
                  <select
                    value={escalatedToSelect}
                    onChange={(e) => setEscalatedToSelect(e.target.value)}
                    className="w-full rounded-xl border p-2.5 text-xs font-bold focus:outline-none focus:border-[#4cd34c]"
                    style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                  >
                    <option value="None">None</option>
                    {(escalationTargets || []).map((t) => (
                      <option key={t.id || t.name} value={t.name}>{t.name}</option>
                    ))}
                    <option value="Other">Other / Custom</option>
                  </select>
                </div>
              </div>

              {escalatedToSelect === "Other" && (
                <div>
                  <label className="text-xs font-bold mb-1 block text-[#4cd34c]">
                    Custom Escalation Destination
                  </label>
                  <input
                    type="text"
                    value={escalatedToCustom}
                    onChange={(e) => setEscalatedToCustom(e.target.value)}
                    placeholder="e.g. Senior Network Architect"
                    className="w-full rounded-xl border p-2.5 text-xs font-bold focus:outline-none focus:border-[#4cd34c]"
                    style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-bold mb-1 block" style={{ color: "var(--text-muted)" }}>
                  Issue Description *
                </label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the nature of the issue..."
                  className="w-full rounded-xl border p-2.5 text-xs font-medium focus:outline-none focus:border-[#4cd34c]"
                  style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                />
              </div>

              <div>
                <label className="text-xs font-bold mb-1 block" style={{ color: "var(--text-muted)" }}>
                  Actions Taken *
                </label>
                <textarea
                  required
                  rows={3}
                  value={actionsTaken}
                  onChange={(e) => setActionsTaken(e.target.value)}
                  placeholder="Technical steps taken by team..."
                  className="w-full rounded-xl border p-2.5 text-xs font-medium focus:outline-none focus:border-[#4cd34c]"
                  style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                />
              </div>

              <div>
                <label className="text-xs font-bold mb-1 block" style={{ color: "var(--text-muted)" }}>
                  Customer Response Provided (Optional)
                </label>
                <input
                  type="text"
                  value={customerResponse}
                  onChange={(e) => setCustomerResponse(e.target.value)}
                  placeholder="Standard response given to customers..."
                  className="w-full rounded-xl border p-2.5 text-xs font-medium focus:outline-none focus:border-[#4cd34c]"
                  style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                />
              </div>

              <div className="p-3.5 rounded-2xl border space-y-3" style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)" }}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={carryForward}
                    onChange={(e) => setCarryForward(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 accent-[#4cd34c]"
                  />
                  <span className="text-xs font-bold text-[#f1c84b]">
                    ↪ Carry Forward to Next Shift
                  </span>
                </label>

                {carryForward && (
                  <div className="pt-2 animate-fadeIn">
                    <label className="text-xs font-bold mb-1 block text-[#f1c84b]">
                      What should the next shift know/do? *
                    </label>
                    <textarea
                      required={carryForward}
                      rows={3}
                      value={nextShiftInstructions}
                      onChange={(e) => setNextShiftInstructions(e.target.value)}
                      placeholder="e.g. Check NOC update at 08:30 AM. Follow up with vendor if link stays down..."
                      className="w-full rounded-xl border p-2.5 text-xs font-medium focus:outline-none focus:border-[#f1c84b]"
                      style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold mb-1 block" style={{ color: "var(--text-muted)" }}>
                  Additional Notes (Optional)
                </label>
                <input
                  type="text"
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  placeholder="Any extra reference numbers, tickets, or observations..."
                  className="w-full rounded-xl border p-2.5 text-xs font-medium focus:outline-none focus:border-[#4cd34c]"
                  style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t" style={{ borderColor: "var(--panel-border)" }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border text-xs font-bold hover:opacity-80 transition"
                  style={{ borderColor: "var(--badge-border)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] text-xs font-extrabold shadow-md transition hover:scale-105"
                >
                  {editIssueId ? "Save Changes" : "Save Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
