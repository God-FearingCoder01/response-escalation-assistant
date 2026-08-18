import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editIssueId, setEditIssueId] = useState(null);
  const [viewDetailIssue, setViewDetailIssue] = useState(null);
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

    // Check if escalated_to matches predefined options or is custom
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

  // --- EXPORT HANDLERS ---
  const handleExportExcel = () => {
    try {
      const now = new Date();
      const currentMonthName = now.toLocaleString("default", { month: "long" });
      const currentYear = now.getFullYear();

      // Determine reporting period from actual issue dates
      let startDateLabel = `1 ${currentMonthName}`;
      let endDateLabel = `${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()} ${currentMonthName} ${currentYear}`;

      if (issues && issues.length > 0) {
        const timestamps = issues
          .map((i) => (i.created_at ? new Date(i.created_at).getTime() : null))
          .filter(Boolean);
        if (timestamps.length > 0) {
          const minDate = new Date(Math.min(...timestamps));
          const maxDate = new Date(Math.max(...timestamps));
          startDateLabel = `${minDate.getDate()} ${minDate.toLocaleString("default", { month: "short" })}`;
          endDateLabel = `${maxDate.getDate()} ${maxDate.toLocaleString("default", { month: "short" })} ${maxDate.getFullYear()}`;
        }
      }
      const periodLabel = `${startDateLabel} – ${endDateLabel}`;

      const totalIssuesCount = issues.length;
      const resolvedCount = issues.filter((i) => i.status === "Resolved").length;
      const ongoingCount = issues.filter((i) => i.status === "Ongoing").length;
      const monitoringCount = issues.filter((i) => i.status === "Monitoring").length;
      const escalatedCount = issues.filter((i) => i.escalated_to && i.escalated_to !== "None").length;

      // Dynamic shift counts from actual platform data
      const shiftCounts = {};
      (shifts || []).forEach((s) => {
        shiftCounts[s.name] = 0;
      });
      (issues || []).forEach((i) => {
        const sName = i.shift_name || "General Shift";
        shiftCounts[sName] = (shiftCounts[sName] || 0) + 1;
      });

      // Sheet 1 --- Summary
      const summaryData = [
        ["SIR MANAGEMENT SUMMARY"],
        [""],
        ["Reporting period:", periodLabel],
        [""],
        ["Metric", "Count"],
        ["Total Issues", totalIssuesCount],
        ["Resolved", resolvedCount],
        ["Ongoing", ongoingCount],
        ["Monitoring", monitoringCount],
        ["Escalated", escalatedCount],
        [""],
        ["Shift Breakdown", "Count"],
        ...Object.entries(shiftCounts).map(([shiftName, count]) => [`${shiftName} Issues`, count]),
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

      // Sheet 2 --- Issue Register (All detail records)
      const registerRows = (issues || []).map((item) => ({
        "Reference No": item.reference_no || `#SIR-${item.id}`,
        "Title": item.title,
        "Status": item.status,
        "Shift": item.shift_name || "N/A",
        "Time Noticed": item.time_noticed,
        "Description": item.description,
        "Actions Taken": item.actions_taken,
        "Customer Given Response": item.customer_response || "",
        "Escalated To": item.escalated_to || "None",
        "Priority / Carry Forward": item.carry_forward ? "Yes" : "No",
        "Next Shift Instructions": item.next_shift_instructions || "",
        "Logged By Agent": `${item.logged_by_name || "Agent"} (${item.logged_by_initials || "AG"})`,
        "Created Date": item.created_at ? new Date(item.created_at).toLocaleString() : "",
      }));
      const registerSheet = XLSX.utils.json_to_sheet(registerRows);

      // Sheet 3 --- Issue Trends
      const trendsMap = {
        Payments: 0,
        Technical: 0,
        Network: 0,
        Accounts: 0,
        Other: 0,
      };

      (issues || []).forEach((item) => {
        const text = `${item.title} ${item.description} ${item.escalated_to}`.toLowerCase();
        if (text.includes("pay") || text.includes("ecocash") || text.includes("billing") || text.includes("deposit") || text.includes("withdraw") || text.includes("bank") || text.includes("money")) {
          trendsMap.Payments += 1;
        } else if (text.includes("tech") || text.includes("system") || text.includes("bug") || text.includes("error") || text.includes("login") || text.includes("app") || text.includes("portal")) {
          trendsMap.Technical += 1;
        } else if (text.includes("net") || text.includes("signal") || text.includes("connection") || text.includes("server") || text.includes("down") || text.includes("offline")) {
          trendsMap.Network += 1;
        } else if (text.includes("account") || text.includes("verify") || text.includes("pin") || text.includes("kyc") || text.includes("profile") || text.includes("password")) {
          trendsMap.Accounts += 1;
        } else {
          trendsMap.Other += 1;
        }
      });

      const trendsData = [
        ["Category", "Occurrences"],
        ...Object.entries(trendsMap).map(([category, occurrences]) => [category, occurrences]),
      ];
      const trendsSheet = XLSX.utils.aoa_to_sheet(trendsData);

      // Build & Download Workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");
      XLSX.utils.book_append_sheet(wb, registerSheet, "Issue Register");
      XLSX.utils.book_append_sheet(wb, trendsSheet, "Issue Trends");

      XLSX.writeFile(wb, `SIR_Excel_Workbook_${currentMonthName}_${currentYear}.xlsx`);
      setShowExportModal(false);
    } catch (e) {
      console.error("Error exporting Excel workbook:", e);
      alert("Failed to export Excel workbook. Please try again.");
    }
  };

  const handleExportManagementReport = () => {
    try {
      const doc = new jsPDF();
      const now = new Date();
      const currentMonthName = now.toLocaleString("default", { month: "long" });
      const currentYear = now.getFullYear();

      // Determine reporting period from actual issue dates
      let startDateLabel = `1 ${currentMonthName}`;
      let endDateLabel = `${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()} ${currentMonthName} ${currentYear}`;

      if (issues && issues.length > 0) {
        const timestamps = issues
          .map((i) => (i.created_at ? new Date(i.created_at).getTime() : null))
          .filter(Boolean);
        if (timestamps.length > 0) {
          const minDate = new Date(Math.min(...timestamps));
          const maxDate = new Date(Math.max(...timestamps));
          startDateLabel = `${minDate.getDate()} ${minDate.toLocaleString("default", { month: "short" })}`;
          endDateLabel = `${maxDate.getDate()} ${maxDate.toLocaleString("default", { month: "short" })} ${maxDate.getFullYear()}`;
        }
      }
      const periodLabel = `${startDateLabel} – ${endDateLabel}`;

      // Metrics calculations from actual platform data
      const totalCount = issues.length;
      const resolvedCount = issues.filter((i) => i.status === "Resolved").length;
      const ongoingCount = issues.filter((i) => i.status === "Ongoing").length;
      const monitoringCount = issues.filter((i) => i.status === "Monitoring").length;
      const escalatedCount = issues.filter((i) => i.escalated_to && i.escalated_to !== "None").length;

      // Dynamic shift counts from actual platform data
      const shiftCounts = {};
      (shifts || []).forEach((s) => {
        shiftCounts[s.name] = 0;
      });
      (issues || []).forEach((i) => {
        const sName = i.shift_name || "General Shift";
        shiftCounts[sName] = (shiftCounts[sName] || 0) + 1;
      });

      // Dynamic trends categorization from actual platform data
      const trendsMap = {
        "Payments & Financial": 0,
        "Technical & Systems": 0,
        "Network & Connectivity": 0,
        "Account & User Access": 0,
        "Other Support Queries": 0,
      };

      (issues || []).forEach((item) => {
        const text = `${item.title} ${item.description} ${item.escalated_to}`.toLowerCase();
        if (text.includes("pay") || text.includes("ecocash") || text.includes("billing") || text.includes("deposit") || text.includes("withdraw") || text.includes("bank") || text.includes("money")) {
          trendsMap["Payments & Financial"] += 1;
        } else if (text.includes("tech") || text.includes("system") || text.includes("bug") || text.includes("error") || text.includes("login") || text.includes("app") || text.includes("portal")) {
          trendsMap["Technical & Systems"] += 1;
        } else if (text.includes("net") || text.includes("signal") || text.includes("connection") || text.includes("server") || text.includes("down") || text.includes("offline")) {
          trendsMap["Network & Connectivity"] += 1;
        } else if (text.includes("account") || text.includes("verify") || text.includes("pin") || text.includes("kyc") || text.includes("profile") || text.includes("password")) {
          trendsMap["Account & User Access"] += 1;
        } else {
          trendsMap["Other Support Queries"] += 1;
        }
      });

      // PDF Formatting & Header Banner
      doc.setFillColor(15, 155, 0); // Theme Green Accent
      doc.rect(0, 0, 210, 22, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("SHIFT ISSUE REGISTER (SIR) - MANAGEMENT REPORT", 14, 14);

      // Meta Info Header
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Reporting Period: ${periodLabel}`, 14, 30);
      doc.text(`Generated On: ${now.toLocaleDateString()} at ${now.toLocaleTimeString()}`, 14, 36);

      // Table 1: Executive Metrics Summary
      autoTable(doc, {
        startY: 42,
        head: [["KPI Metric", "Actual Count", "Percentage Share"]],
        body: [
          ["Total Shift Issues Recorded", totalCount.toString(), "100%"],
          ["Resolved Issues", resolvedCount.toString(), `${totalCount ? Math.round((resolvedCount / totalCount) * 100) : 0}%`],
          ["Ongoing Issues", ongoingCount.toString(), `${totalCount ? Math.round((ongoingCount / totalCount) * 100) : 0}%`],
          ["Monitoring Status", monitoringCount.toString(), `${totalCount ? Math.round((monitoringCount / totalCount) * 100) : 0}%`],
          ["Escalated to Senior Teams", escalatedCount.toString(), `${totalCount ? Math.round((escalatedCount / totalCount) * 100) : 0}%`],
        ],
        headStyles: { fillStyle: "F", fillColor: [30, 30, 45], textColor: [76, 211, 76], fontStyle: "bold" },
        styles: { fontSize: 9 },
      });

      // Table 2: Shift Breakdown
      const shiftRows = Object.entries(shiftCounts).map(([shiftName, count]) => [
        shiftName,
        count.toString(),
        `${totalCount ? Math.round((count / totalCount) * 100) : 0}%`,
      ]);

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 8,
        head: [["Shift Name", "Total Recorded Issues", "Shift Share"]],
        body: shiftRows,
        headStyles: { fillStyle: "F", fillColor: [30, 30, 45], textColor: [76, 211, 76], fontStyle: "bold" },
        styles: { fontSize: 9 },
      });

      // Table 3: Issue Categories & Trends
      const trendRows = Object.entries(trendsMap).map(([category, count]) => [
        category,
        count.toString(),
        `${totalCount ? Math.round((count / totalCount) * 100) : 0}%`,
      ]);

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 8,
        head: [["Category / Topic Trend", "Occurrences", "Trend Share"]],
        body: trendRows,
        headStyles: { fillStyle: "F", fillColor: [30, 30, 45], textColor: [76, 211, 76], fontStyle: "bold" },
        styles: { fontSize: 9 },
      });

      // Footer notice
      const finalY = doc.lastAutoTable.finalY + 12;
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text("Confidential Management Report — Response Escalation Assistant (REA)", 14, finalY);

      // Save PDF file
      doc.save(`SIR_Management_Report_${currentMonthName}_${currentYear}.pdf`);
      setShowExportModal(false);
    } catch (e) {
      console.error("Error generating PDF Management Report:", e);
      alert("Failed to export PDF Management Report. Please try again.");
    }
  };

  const handleExportCSV = () => {
    try {
      const headers = [
        "Reference No",
        "Title",
        "Status",
        "Shift",
        "Time Noticed",
        "Description",
        "Actions Taken",
        "Customer Response",
        "Escalated To",
        "Priority / Carry Forward",
        "Logged By",
        "Created Date",
      ];

      const rows = (issues || []).map((i) => [
        `"${(i.reference_no || `#SIR-${i.id}`).replace(/"/g, '""')}"`,
        `"${(i.title || "").replace(/"/g, '""')}"`,
        `"${(i.status || "").replace(/"/g, '""')}"`,
        `"${(i.shift_name || "").replace(/"/g, '""')}"`,
        `"${(i.time_noticed || "").replace(/"/g, '""')}"`,
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
      link.setAttribute("download", `SIR_Issue_Register_Raw_Data_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setShowExportModal(false);
    } catch (e) {
      console.error("Error exporting CSV:", e);
      alert("Failed to export CSV. Please try again.");
    }
  };

  const [selectedDateFilter, setSelectedDateFilter] = useState("All");
  const [selectedArchiveMonth, setSelectedArchiveMonth] = useState("All");

  const getShiftIcon = (name = "") => {
    const lower = name.toLowerCase();
    if (lower.includes("morning")) return "☀️";
    if (lower.includes("afternoon") || lower.includes("day")) return "🌆";
    if (lower.includes("night") || lower.includes("graveyard")) return "🌙";
    return "⏰";
  };

  // Today's shift statistics with status breakdown
  const todayShiftStats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const map = {};

    (shifts || []).forEach((s) => {
      map[s.name] = {
        ...s,
        ongoing: 0,
        monitoring: 0,
        resolved: 0,
        total: 0,
      };
    });

    (issues || []).forEach((item) => {
      const itemDate = item.created_at ? new Date(item.created_at).toISOString().slice(0, 10) : todayStr;
      if (itemDate === todayStr) {
        const sName = item.shift_name || currentShiftName;
        if (!map[sName]) {
          map[sName] = { name: sName, start_time: "00:00", end_time: "23:59", ongoing: 0, monitoring: 0, resolved: 0, total: 0 };
        }
        map[sName].total += 1;
        if (item.status === "Ongoing") map[sName].ongoing += 1;
        else if (item.status === "Monitoring") map[sName].monitoring += 1;
        else if (item.status === "Resolved") map[sName].resolved += 1;
      }
    });

    return Object.values(map);
  }, [shifts, issues, currentShiftName]);

  // Recent Shifts by Date
  const recentShiftsList = useMemo(() => {
    const map = {};
    (issues || []).forEach((item) => {
      const dateObj = item.created_at ? new Date(item.created_at) : new Date();
      const dateKey = dateObj.toISOString().slice(0, 10);
      const label = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (!map[dateKey]) {
        map[dateKey] = { dateKey, label, count: 0 };
      }
      map[dateKey].count += 1;
    });
    return Object.values(map).sort((a, b) => b.dateKey.localeCompare(a.dateKey)).slice(0, 5);
  }, [issues]);

  // Monthly Archives
  const monthlyArchiveList = useMemo(() => {
    const map = {};
    (issues || []).forEach((item) => {
      const dateObj = item.created_at ? new Date(item.created_at) : new Date();
      const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
      const label = dateObj.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      if (!map[monthKey]) {
        map[monthKey] = { monthKey, label, count: 0 };
      }
      map[monthKey].count += 1;
    });
    return Object.values(map).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [issues]);

  // Filtered issues calculation
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

  // Priority Carry Forward Items
  const carryForwardItems = useMemo(() => {
    return (issues || []).filter((item) => item.carry_forward && item.status !== "Resolved");
  }, [issues]);

  if (activeScreen !== "shift_register") return null;

  return (
    <section className="max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* TOP HEADER & ACTION BAR */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-6" style={{ borderColor: "var(--panel-border)" }}>
        <div>
          <div className="flex items-center gap-3">
            <img src="/clipboard.png" alt="Register" className="h-8 w-8 object-contain shrink-0" />
            <h2 className="text-3xl font-extrabold tracking-tight" style={{ color: "var(--app-text)" }}>
              Shift Issue Register (SIR)
            </h2>
          </div>
          <p className="text-sm mt-1.5 font-medium" style={{ color: "var(--text-muted)" }}>
            Record any noteworthy shift issues (persistant & recurring), actions taken, and important information for incoming shifts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowExportModal(true)}
            className="px-4 py-3 rounded-2xl border text-xs font-extrabold backdrop-blur shadow-sm transition hover:scale-[1.02] active:scale-95 flex items-center gap-2"
            style={{ borderColor: "var(--badge-border)", color: "var(--neutral-text)", backgroundColor: "var(--neutral-bg)" }}
          >
            <span className="text-sm">📥</span>
            <span>Export Shift Issues</span>
          </button>

          <button
            onClick={handleOpenRecordModal}
            className="px-6 py-3 rounded-2xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] text-sm font-extrabold shadow-lg transition hover:scale-[1.02] active:scale-95 flex items-center gap-2"
          >
            <span className="text-lg font-black">+</span>
            <span>Record Issue</span>
          </button>
        </div>
      </div>

      {/* MAIN LAYOUT GRID (SIDEBAR + WORKSPACE) */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* LEFT SIDEBAR (TODAY, RECENT SHIFTS, ISSUE ARCHIVE) */}
        <aside className="w-full lg:w-80 shrink-0 space-y-6">
          {/* TODAY SHIFT CARDS */}
          <div className="rounded-3xl border p-5 shadow-md backdrop-blur space-y-3.5" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}>
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase font-extrabold tracking-wider" style={{ color: "var(--app-text)" }}>
                TODAY
              </h3>
              <span className="text-[10px] font-bold text-[#4cd34c] bg-[#4cd34c]/10 px-2 py-0.5 rounded-full border border-[#4cd34c]/30">
                Live Shifts
              </span>
            </div>

            <div className="space-y-3">
              {todayShiftStats.map((shift) => {
                const icon = getShiftIcon(shift.name);
                const isSelected = shiftFilter === shift.name;

                return (
                  <div
                    key={shift.name}
                    onClick={() => setShiftFilter(isSelected ? "All" : shift.name)}
                    className={`rounded-2xl border p-4 cursor-pointer transition-all hover:scale-[1.01] shadow-sm ${isSelected
                        ? "border-[#4cd34c] bg-[#4cd34c]/10 shadow-[#4cd34c]/10"
                        : "hover:border-[#4cd34c]/40"
                      }`}
                    style={{
                      borderColor: isSelected ? "#4cd34c" : "var(--field-border)",
                      backgroundColor: isSelected ? undefined : "var(--field-bg)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm flex items-center gap-2" style={{ color: "var(--app-text)" }}>
                        <span>{icon}</span>
                        <span>{shift.name}</span>
                      </span>
                      {isSelected && (
                        <span className="text-[10px] font-extrabold text-[#4cd34c] uppercase">Selected</span>
                      )}
                    </div>

                    <div className="text-xs font-medium mb-3 opacity-75" style={{ color: "var(--text-muted)" }}>
                      {shift.start_time} – {shift.end_time}
                    </div>

                    {/* Counters: Ongoing, Monitoring, Resolved */}
                    <div className="flex items-center gap-3 pt-2 border-t border-[var(--panel-border)] text-xs font-bold">
                      <span className="flex items-center gap-1 text-[#ff6b6b]" title="Ongoing Issues">
                        <span>🔴</span>
                        <span>{shift.ongoing}</span>
                      </span>
                      <span className="flex items-center gap-1 text-[#f1c84b]" title="Monitoring Issues">
                        <span>🟠</span>
                        <span>{shift.monitoring}</span>
                      </span>
                      <span className="flex items-center gap-1 text-[#4cd34c]" title="Resolved Issues">
                        <span>🟢</span>
                        <span>{shift.resolved}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RECENT SHIFTS SECTION */}
          <div className="rounded-3xl border p-5 shadow-md backdrop-blur space-y-3" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}>
            <h3 className="text-xs uppercase font-extrabold tracking-wider" style={{ color: "var(--app-text)" }}>
              RECENT SHIFTS
            </h3>

            <div className="space-y-1.5">
              {recentShiftsList.length > 0 ? (
                recentShiftsList.map((item) => {
                  const isSelected = selectedDateFilter === item.dateKey;
                  return (
                    <button
                      key={item.dateKey}
                      onClick={() => {
                        setSelectedDateFilter(isSelected ? "All" : item.dateKey);
                        setSelectedArchiveMonth("All");
                      }}
                      className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition ${isSelected
                          ? "bg-[#4cd34c] text-[#071007] font-bold"
                          : "hover:bg-[var(--neutral-bg)] text-[var(--app-text)]"
                        }`}
                    >
                      <span>{item.label}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isSelected ? "bg-[#071007]/20 text-[#071007]" : "bg-[var(--field-bg)] text-[var(--text-muted)] border border-[var(--field-border)]"
                        }`}>
                        {item.count} {item.count === 1 ? "issue" : "issues"}
                      </span>
                    </button>
                  );
                })
              ) : (
                <p className="text-xs italic p-2" style={{ color: "var(--text-muted)" }}>
                  No recent shift logs
                </p>
              )}
            </div>
          </div>

          {/* ISSUE ARCHIVE SECTION */}
          <div className="rounded-3xl border p-5 shadow-md backdrop-blur space-y-3" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}>
            <h3 className="text-xs uppercase font-extrabold tracking-wider flex items-center gap-1.5" style={{ color: "var(--app-text)" }}>
              <span>📁</span>
              <span>ISSUE ARCHIVE</span>
            </h3>

            <div className="space-y-2">
              {monthlyArchiveList.length > 0 ? (
                monthlyArchiveList.map((item) => {
                  const isSelected = selectedArchiveMonth === item.monthKey;
                  return (
                    <button
                      key={item.monthKey}
                      onClick={() => {
                        setSelectedArchiveMonth(isSelected ? "All" : item.monthKey);
                        setSelectedDateFilter("All");
                      }}
                      className={`w-full flex items-center justify-between rounded-2xl border px-3.5 py-2.5 text-xs font-semibold transition ${isSelected
                          ? "border-[#4cd34c] bg-[#4cd34c]/10 text-[#4cd34c] font-bold"
                          : "border-[var(--field-border)] hover:border-[#4cd34c]/50 text-[var(--app-text)]"
                        }`}
                    >
                      <span>[ {item.label} ]</span>
                      <span className="text-[10px] opacity-75">
                        ({item.count})
                      </span>
                    </button>
                  );
                })
              ) : (
                <p className="text-xs italic p-2" style={{ color: "var(--text-muted)" }}>
                  No archive records
                </p>
              )}
            </div>
          </div>
        </aside>

        {/* RIGHT WORKSPACE (CARRIER BANNER + SEARCH & FILTER + COMPACT CARDS) */}
        <div className="flex-1 w-full space-y-6">
          {/* Active Filter Indicators */}
          {(selectedDateFilter !== "All" || selectedArchiveMonth !== "All" || shiftFilter !== "All") && (
            <div className="flex items-center justify-between rounded-2xl border px-4 py-2.5 text-xs font-bold bg-[#4cd34c]/10 border-[#4cd34c]/30 text-[#4cd34c]">
              <span>
                Filtering: {selectedDateFilter !== "All" ? `Date (${selectedDateFilter})` : ""} {selectedArchiveMonth !== "All" ? `Month (${selectedArchiveMonth})` : ""} {shiftFilter !== "All" ? `Shift (${shiftFilter})` : ""}
              </span>
              <button
                onClick={() => {
                  setSelectedDateFilter("All");
                  setSelectedArchiveMonth("All");
                  setShiftFilter("All");
                }}
                className="underline text-xs hover:opacity-80"
              >
                Clear Filters ✕
              </button>
            </div>
          )}

          {/* PRIORITY CARRY FORWARD BANNER */}
          {carryForwardItems.length > 0 && (
            <div className="rounded-3xl border p-5 shadow-xl backdrop-blur relative overflow-hidden bg-gradient-to-r from-[#b83838]/15 via-[#f1c84b]/10 to-transparent border-[#f1c84b]/40 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-3 w-3 rounded-full bg-[#ff6b6b] animate-ping" />
                  <h3 className="text-base font-bold text-[#ff6b6b] flex items-center gap-2 uppercase tracking-wider">
                    ⚠️ Priority: Carried Forward To This Shift ({carryForwardItems.length})
                  </h3>
                </div>
                <span className="text-xs font-medium opacity-80" style={{ color: "var(--text-muted)" }}>
                  Requires Next Shift Attention
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {carryForwardItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border p-4 shadow-md bg-[var(--field-bg)] backdrop-blur space-y-2 border-[#f1c84b]/30"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#f1c84b]/20 text-[#f1c84b] border border-[#f1c84b]/40">
                        {item.reference_no}
                      </span>
                      <span className="text-[11px] font-semibold opacity-75" style={{ color: "var(--text-muted)" }}>
                        Time: {item.time_noticed} ({item.shift_name || "Prior Shift"})
                      </span>
                    </div>

                    <h4 className="font-bold text-sm" style={{ color: "var(--app-text)" }}>
                      {item.title}
                    </h4>

                    {item.next_shift_instructions && (
                      <div className="rounded-xl border p-2.5 text-xs bg-[#ff6b6b]/10 border-[#ff6b6b]/30 text-[#ff8080]">
                        <strong className="block mb-0.5 text-[#ff6b6b]">What next shift should do:</strong>
                        <p className="whitespace-pre-wrap">{item.next_shift_instructions}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FILTER & SEARCH BAR */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-2xl border p-4 shadow-md backdrop-blur" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}>
            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              {["All", "Ongoing", "Monitoring", "Resolved"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${statusFilter === tab
                      ? "bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] shadow-sm"
                      : "hover:bg-[var(--neutral-bg)] text-[var(--neutral-text)]"
                    }`}
                >
                  {tab === "All" ? `All Issues (${issues.length})` : tab}
                </button>
              ))}

              <label className="ml-3 flex items-center gap-2 text-xs font-semibold cursor-pointer select-none border-l pl-3 border-[var(--panel-border)] whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={carryForwardOnly}
                  onChange={(e) => setCarryForwardOnly(e.target.checked)}
                  className="rounded accent-[#4cd34c] h-4 w-4"
                />
                <span style={{ color: carryForwardOnly ? "#ff6b6b" : "var(--app-text)" }}>
                  Priority / Carry Forward Only ⚡
                </span>
              </label>
            </div>

            {/* Search Bar */}
            <div className="relative min-w-[240px]">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by Title, Ref #, Agent..."
                className="w-full rounded-xl border py-2 pl-9 pr-3 text-xs font-medium focus:outline-none focus:border-[#4cd34c]"
                style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
              />
              <img src="/search.png" alt="Search" className="absolute left-3 top-2.5 h-3.5 w-3.5 object-contain opacity-60" />
            </div>
          </div>

          {/* COMPACT ISSUES CARDS GRID */}
          {loading ? (
            <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>
              <span className="inline-block animate-spin text-2xl mb-2">⏳</span>
              <p className="text-sm font-medium">Loading shift register records...</p>
            </div>
          ) : filteredIssues.length === 0 ? (
            <div className="rounded-3xl border p-12 text-center shadow-inner space-y-3" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}>
              <div className="text-4xl">📋</div>
              <h3 className="text-lg font-bold" style={{ color: "var(--app-text)" }}>
                No shift issues found
              </h3>
              <p className="text-xs max-w-md mx-auto" style={{ color: "var(--text-muted)" }}>
                No records match your active filters or search terms. Click '+ Record Issue' above to log a new issue.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredIssues.map((issue) => {
                const statusDot = issue.status === "Resolved" ? "🟢" : issue.status === "Monitoring" ? "🟠" : "🔴";
                const shiftCleanName = (issue.shift_name || "Shift").replace(/shift/i, "").trim();

                let cardDate = "";
                if (issue.created_at) {
                  try {
                    const d = new Date(issue.created_at);
                    cardDate = d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
                  } catch (e) {
                    cardDate = "Today";
                  }
                } else {
                  cardDate = "Today";
                }

                const escalatedLabel = issue.escalated_to && issue.escalated_to !== "None"
                  ? `Reported to ${issue.escalated_to}`
                  : "Logged for shift monitoring";

                const deptLabel = issue.escalated_to && issue.escalated_to !== "None"
                  ? issue.escalated_to.split(" ")[0]
                  : "Support";

                return (
                  <div
                    key={issue.id}
                    className={`rounded-2xl border p-5 shadow-md backdrop-blur transition-all space-y-3 flex flex-col justify-between hover:scale-[1.01] ${issue.carry_forward && issue.status !== "Resolved"
                        ? "border-[#f1c84b]/50 bg-gradient-to-r from-[#f1c84b]/5 via-transparent to-transparent"
                        : ""
                      }`}
                    style={{
                      borderColor: issue.carry_forward && issue.status !== "Resolved" ? undefined : "var(--panel-border)",
                      backgroundColor: "var(--panel-bg)",
                    }}
                  >
                    {/* Top Row: Status Dot + Title */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-base flex items-center gap-2 text-[var(--app-text)] line-clamp-1">
                          <span>{statusDot}</span>
                          <span>{issue.title}</span>
                        </h3>
                        {issue.carry_forward && (
                          <span className="rounded-full border px-2 py-0.5 text-[9px] font-bold border-[#ff6b6b]/40 bg-[#ff6b6b]/10 text-[#ff6b6b] shrink-0">
                            Priority ⚡
                          </span>
                        )}
                      </div>

                      {/* Second Line: Morning · 17 Aug · 10:35 */}
                      <div className="text-xs font-semibold text-[var(--text-muted)]">
                        {shiftCleanName} · {cardDate} · {issue.time_noticed}
                      </div>

                      {/* Third Line: Reported to Technical Support */}
                      <div className="text-xs font-semibold text-[#4cd34c]">
                        {escalatedLabel}
                      </div>
                    </div>

                    {/* Footer Row: User Initials & Department + View Details Button */}
                    <div className="flex items-center justify-between pt-3 border-t border-[var(--panel-border)] text-xs">
                      <div className="font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
                        <span>👤</span>
                        <span>{issue.logged_by_initials || "Agent"} · {deptLabel}</span>
                      </div>

                      <button
                        onClick={() => setViewDetailIssue(issue)}
                        className="text-xs font-extrabold text-[#4cd34c] hover:underline flex items-center gap-1 transition"
                      >
                        <span>View Details</span>
                        <span>→</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* VIEW DETAILS MODAL */}
      {viewDetailIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div
            className="w-full max-w-2xl rounded-3xl border p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
            style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)", color: "var(--app-text)" }}
          >
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--panel-border)" }}>
              <div className="flex items-center gap-3">
                <span className="text-xl">
                  {viewDetailIssue.status === "Resolved" ? "🟢" : viewDetailIssue.status === "Monitoring" ? "🟠" : "🔴"}
                </span>
                <div>
                  <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#4cd34c]/15 text-[#4cd34c] border border-[#4cd34c]/30">
                    {viewDetailIssue.reference_no || `#SIR-${viewDetailIssue.id}`}
                  </span>
                  <h3 className="text-lg font-extrabold mt-1">{viewDetailIssue.title}</h3>
                </div>
              </div>
              <button
                onClick={() => setViewDetailIssue(null)}
                className="text-lg font-bold opacity-60 hover:opacity-100 transition"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div className="rounded-xl border p-2.5" style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)" }}>
                <span className="text-[10px] font-semibold text-[var(--text-muted)] block">Status:</span>
                <span className="font-bold text-[#4cd34c]">{viewDetailIssue.status}</span>
              </div>
              <div className="rounded-xl border p-2.5" style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)" }}>
                <span className="text-[10px] font-semibold text-[var(--text-muted)] block">Shift & Time:</span>
                <span className="font-bold">{viewDetailIssue.shift_name} ({viewDetailIssue.time_noticed})</span>
              </div>
              <div className="rounded-xl border p-2.5" style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)" }}>
                <span className="text-[10px] font-semibold text-[var(--text-muted)] block">Escalated To:</span>
                <span className="font-bold">{viewDetailIssue.escalated_to || "None"}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="rounded-2xl border p-4 space-y-1" style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)" }}>
                <span className="font-bold text-[#4cd34c] uppercase text-[10px]">Description of Issue</span>
                <p className="whitespace-pre-wrap leading-relaxed font-medium">{viewDetailIssue.description}</p>
              </div>

              <div className="rounded-2xl border p-4 space-y-1" style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)" }}>
                <span className="font-bold text-[#4cd34c] uppercase text-[10px]">Actions Taken</span>
                <p className="whitespace-pre-wrap leading-relaxed font-medium">{viewDetailIssue.actions_taken}</p>
              </div>

              {viewDetailIssue.customer_response && (
                <div className="rounded-2xl border p-4 bg-[#4cd34c]/5 border-[#4cd34c]/30 text-xs">
                  <span className="font-bold text-[#4cd34c] uppercase text-[10px] block mb-1">💬 Customer Given Response:</span>
                  <p className="whitespace-pre-wrap font-medium text-emerald-300">"{viewDetailIssue.customer_response}"</p>
                </div>
              )}

              {viewDetailIssue.next_shift_instructions && (
                <div className="rounded-2xl border p-4 bg-[#ff6b6b]/10 border-[#ff6b6b]/30 text-[#ff8080] text-xs">
                  <strong className="block text-[10px] text-[#ff6b6b] uppercase font-bold mb-1">What Next Shift Should Know / Do:</strong>
                  <p className="whitespace-pre-wrap font-semibold">{viewDetailIssue.next_shift_instructions}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: "var(--panel-border)" }}>
              <div className="text-xs text-[var(--text-muted)]">
                Logged by: <strong className="text-[#4cd34c]">{viewDetailIssue.logged_by_name} ({viewDetailIssue.logged_by_initials})</strong>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const item = viewDetailIssue;
                    setViewDetailIssue(null);
                    handleOpenEditModal(item);
                  }}
                  className="px-4 py-2 rounded-xl border text-xs font-semibold hover:opacity-80 transition"
                  style={{ borderColor: "var(--badge-border)" }}
                >
                  Edit Issue
                </button>
                <button
                  onClick={() => {
                    const id = viewDetailIssue.id;
                    setViewDetailIssue(null);
                    handleDeleteIssue(id);
                  }}
                  className="px-4 py-2 rounded-xl border text-xs font-semibold hover:bg-[#ff6b6b]/10 hover:text-[#ff6b6b] transition"
                  style={{ borderColor: "var(--error-border)", color: "var(--error-text)" }}
                >
                  Delete
                </button>
                <button
                  onClick={() => setViewDetailIssue(null)}
                  className="px-4 py-2 rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] text-xs font-bold shadow-md"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EXPORT SHIFT ISSUES MODAL */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div
            className="w-full max-w-md rounded-3xl border p-6 shadow-2xl space-y-5"
            style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)", color: "var(--app-text)" }}
          >
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--panel-border)" }}>
              <h3 className="text-lg font-extrabold flex items-center gap-2">
                <span>📥</span>
                <span>Export Shift Issues</span>
              </h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-lg font-bold opacity-60 hover:opacity-100 transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {/* Option 1: Excel Workbook (.xlsx) */}
              <button
                onClick={handleExportExcel}
                className="w-full text-left rounded-2xl border p-4 transition-all hover:scale-[1.01] hover:border-[#4cd34c] bg-[var(--field-bg)] space-y-1 group"
                style={{ borderColor: "var(--field-border)" }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm flex items-center gap-2 group-hover:text-[#4cd34c] transition">
                    <span>📊</span>
                    <span>Excel Workbook (.xlsx)</span>
                  </span>
                  <span className="text-[11px] font-extrabold text-[#4cd34c] bg-[#4cd34c]/10 px-2 py-0.5 rounded-full border border-[#4cd34c]/30">
                    3 Worksheets
                  </span>
                </div>
                <p className="text-xs opacity-75 pl-6" style={{ color: "var(--text-muted)" }}>
                  Complete issue records with Summary, Issue Register & Trends worksheets
                </p>
              </button>

              {/* Option 2: Management Report (.txt) */}
              <button
                onClick={handleExportManagementReport}
                className="w-full text-left rounded-2xl border p-4 transition-all hover:scale-[1.01] hover:border-[#4cd34c] bg-[var(--field-bg)] space-y-1 group"
                style={{ borderColor: "var(--field-border)" }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm flex items-center gap-2 group-hover:text-[#4cd34c] transition">
                    <span>📄</span>
                    <span>Management Report (.pdf)</span>
                  </span>
                  <span className="text-[11px] font-extrabold text-[#4cd34c] bg-[#4cd34c]/10 px-2 py-0.5 rounded-full border border-[#4cd34c]/30">
                    PDF Document
                  </span>
                </div>
                <p className="text-xs opacity-75 pl-6" style={{ color: "var(--text-muted)" }}>
                  Executive summary report suitable for management briefings
                </p>
              </button>

              {/* Option 3: CSV Data (.csv) */}
              <button
                onClick={handleExportCSV}
                className="w-full text-left rounded-2xl border p-4 transition-all hover:scale-[1.01] hover:border-[#4cd34c] bg-[var(--field-bg)] space-y-1 group"
                style={{ borderColor: "var(--field-border)" }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm flex items-center gap-2 group-hover:text-[#4cd34c] transition">
                    <span>📋</span>
                    <span>CSV Data (.csv)</span>
                  </span>
                  <span className="text-[11px] font-extrabold text-[#4cd34c] bg-[#4cd34c]/10 px-2 py-0.5 rounded-full border border-[#4cd34c]/30">
                    Raw Data
                  </span>
                </div>
                <p className="text-xs opacity-75 pl-6" style={{ color: "var(--text-muted)" }}>
                  Raw data file for further database or spreadsheet processing
                </p>
              </button>
            </div>

            <div className="flex justify-end pt-2 border-t" style={{ borderColor: "var(--panel-border)" }}>
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 rounded-xl border text-xs font-bold hover:opacity-80 transition"
                style={{ borderColor: "var(--badge-border)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div
            className="w-full max-w-3xl rounded-3xl border p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
            style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)", color: "var(--app-text)" }}
          >
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--panel-border)" }}>
              <div className="flex items-center gap-3">
                <img src="/clipboard.png" alt="Register" className="h-7 w-7 object-contain" />
                <h3 className="text-xl font-bold">
                  {editIssueId ? `Edit Issue Record #${editIssueId}` : "+ Record Shift Issue"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-lg font-bold opacity-60 hover:opacity-100 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Row 1: Title, Reporting Shift & Time Noticed */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs font-bold mb-1 block" style={{ color: "var(--text-muted)" }}>
                    Issue Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. EcoCash USSD Timeout Error"
                    className="w-full rounded-xl border p-2.5 text-sm font-medium focus:outline-none focus:border-[#4cd34c]"
                    style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold mb-1 block text-[#4cd34c]">
                    Reporting Shift *
                  </label>
                  <select
                    value={selectedShiftForIssue}
                    onChange={(e) => setSelectedShiftForIssue(e.target.value)}
                    className="w-full rounded-xl border p-2.5 text-sm font-medium focus:outline-none focus:border-[#4cd34c]"
                    style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                  >
                    {(shifts || []).map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold mb-1 block" style={{ color: "var(--text-muted)" }}>
                    Time First Noticed *
                  </label>
                  <input
                    type="time"
                    required
                    value={timeNoticed}
                    onChange={(e) => setTimeNoticed(e.target.value)}
                    className="w-full rounded-xl border p-2.5 text-sm font-medium focus:outline-none focus:border-[#4cd34c]"
                    style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                  />
                </div>
              </div>

              {/* Row 2: Status & Escalated To */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold mb-1 block" style={{ color: "var(--text-muted)" }}>
                    Current Status *
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-xl border p-2.5 text-sm font-medium focus:outline-none focus:border-[#4cd34c]"
                    style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                  >
                    <option value="Ongoing">Ongoing (Requires Action)</option>
                    <option value="Monitoring">Monitoring (Under Observation)</option>
                    <option value="Resolved">Resolved (Completed)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold mb-1 block" style={{ color: "var(--text-muted)" }}>
                    Escalated To *
                  </label>
                  <select
                    value={escalatedToSelect}
                    onChange={(e) => setEscalatedToSelect(e.target.value)}
                    className="w-full rounded-xl border p-2.5 text-sm font-medium focus:outline-none focus:border-[#4cd34c]"
                    style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                  >
                    <option value="None">None (Handled On Shift)</option>
                    {(escalationTargets || []).map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                    <option value="Other">Other (Custom Option...)</option>
                  </select>
                </div>
              </div>

              {/* Conditional custom escalated target input */}
              {escalatedToSelect === "Other" && (
                <div>
                  <label className="text-xs font-bold mb-1 block text-[#f1c84b]">
                    Specify Custom Escalated Target *
                  </label>
                  <input
                    type="text"
                    required
                    value={escalatedToCustom}
                    onChange={(e) => setEscalatedToCustom(e.target.value)}
                    placeholder="e.g. Core Switching Team / Vendor X"
                    className="w-full rounded-xl border p-2.5 text-sm font-medium focus:outline-none focus:border-[#4cd34c]"
                    style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                  />
                </div>
              )}

              {/* Row 3: Description */}
              <div>
                <label className="text-xs font-bold mb-1 block" style={{ color: "var(--text-muted)" }}>
                  Description of the Issue *
                </label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide details about the issue reported by customers..."
                  className="w-full rounded-xl border p-2.5 text-sm font-medium focus:outline-none focus:border-[#4cd34c]"
                  style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                />
              </div>

              {/* Row 4: Actions Taken */}
              <div>
                <label className="text-xs font-bold mb-1 block" style={{ color: "var(--text-muted)" }}>
                  Actions Taken *
                </label>
                <textarea
                  required
                  rows={2}
                  value={actionsTaken}
                  onChange={(e) => setActionsTaken(e.target.value)}
                  placeholder="Describe troubleshooting steps or escalations performed..."
                  className="w-full rounded-xl border p-2.5 text-sm font-medium focus:outline-none focus:border-[#4cd34c]"
                  style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                />
              </div>

              {/* Row 5: Customer Given Response */}
              <div>
                <label className="text-xs font-bold mb-1 block" style={{ color: "var(--text-muted)" }}>
                  Customer Given Response (Optional)
                </label>
                <textarea
                  rows={2}
                  value={customerResponse}
                  onChange={(e) => setCustomerResponse(e.target.value)}
                  placeholder="Exact response script or message provided to reporting customers..."
                  className="w-full rounded-xl border p-2.5 text-sm font-medium focus:outline-none focus:border-[#4cd34c]"
                  style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                />
              </div>

              {/* NEXT SHIFT ACTION SECTION */}
              <div className="rounded-2xl border p-4 space-y-3 bg-[#ff6b6b]/5 border-[#ff6b6b]/30">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#ff6b6b] flex items-center gap-2">
                  <span>⚡</span>
                  <span>Next Shift Action</span>
                </h4>

                <label className="flex items-center gap-2.5 text-sm font-bold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={carryForward}
                    onChange={(e) => setCarryForward(e.target.checked)}
                    className="rounded accent-[#ff6b6b] h-4 w-4"
                  />
                  <span>Carry forward to next shift</span>
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
                      className="w-full rounded-xl border p-2.5 text-sm font-medium focus:outline-none focus:border-[#f1c84b]"
                      style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                    />
                  </div>
                )}
              </div>

              {/* Row 6: Additional Notes */}
              <div>
                <label className="text-xs font-bold mb-1 block" style={{ color: "var(--text-muted)" }}>
                  Additional Notes (Optional)
                </label>
                <input
                  type="text"
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  placeholder="Any extra reference numbers, tickets, or observations..."
                  className="w-full rounded-xl border p-2.5 text-sm font-medium focus:outline-none focus:border-[#4cd34c]"
                  style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                />
              </div>

              {/* Modal Footer Buttons */}
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
                  className="px-6 py-2.5 rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] text-xs font-bold shadow-md transition hover:scale-105"
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
