import { useState, useMemo } from "react";

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

  // Filtered issues calculation
  const filteredIssues = useMemo(() => {
    return (issues || []).filter((item) => {
      if (statusFilter !== "All" && item.status !== statusFilter) return false;
      if (shiftFilter !== "All" && item.shift_name !== shiftFilter) return false;
      if (carryForwardOnly && !item.carry_forward) return false;

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
  }, [issues, statusFilter, shiftFilter, carryForwardOnly, searchTerm]);

  // Priority Carry Forward Items
  const carryForwardItems = useMemo(() => {
    return (issues || []).filter((item) => item.carry_forward && item.status !== "Resolved");
  }, [issues]);

  if (activeScreen !== "shift_register") return null;

  return (
    <section className="max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-6" style={{ borderColor: "var(--panel-border)" }}>
        <div>
          <div className="flex items-center gap-3">
            <img src="/clipboard.png" alt="Register" className="h-8 w-8 object-contain shrink-0" />
            <h2 className="text-3xl font-extrabold tracking-tight" style={{ color: "var(--app-text)" }}>
              Shift Issue Register (SIR)
            </h2>
          </div>
          <p className="text-sm mt-1.5 font-medium" style={{ color: "var(--text-muted)" }}>
            Record any noteworthy issue, actions taken and important information for the next shift
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-xs font-semibold backdrop-blur shadow-sm transition hover:border-[#4cd34c]/50"
            style={{ borderColor: "var(--badge-border)", backgroundColor: "var(--badge-bg)" }}
            title="Click to switch your current operating shift"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-[#4cd34c] animate-pulse" />
            <span>Active Shift:</span>
            <select
              value={currentShiftName}
              onChange={(e) => handleSelectActiveShift?.(e.target.value)}
              className="bg-transparent font-bold text-[#4cd34c] cursor-pointer focus:outline-none pr-1"
            >
              {(shifts || []).map((s) => (
                <option key={s.id} value={s.name} className="bg-[var(--panel-bg)] text-[var(--app-text)] font-semibold">
                  {s.name} ({s.start_time} - {s.end_time})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleOpenRecordModal}
            className="px-5 py-2.5 rounded-2xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] text-sm font-bold shadow-lg transition hover:scale-[1.02] active:scale-95 flex items-center gap-2"
          >
            <span className="text-base font-extrabold">+</span>
            <span>Record Issue</span>
          </button>
        </div>
      </div>

      {/* PRIORITY CARRY FORWARD BANNER (IF ACTIVE CARRY FORWARD ISSUES EXIST) */}
      {carryForwardItems.length > 0 && (
        <div className="rounded-3xl border p-5 shadow-xl backdrop-blur relative overflow-hidden bg-gradient-to-r from-[#b83838]/15 via-[#f1c84b]/10 to-transparent border-[#f1c84b]/40">
          <div className="flex items-center justify-between mb-4">
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

                <div className="flex items-center justify-between pt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  <span>Escalated to: <strong>{item.escalated_to}</strong></span>
                  <span>Logged by: <strong>{item.logged_by_name} ({item.logged_by_initials})</strong></span>
                </div>
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
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                statusFilter === tab
                  ? "bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] shadow-sm"
                  : "hover:bg-[var(--neutral-bg)] text-[var(--neutral-text)]"
              }`}
            >
              {tab === "All" ? `All Issues (${issues.length})` : tab}
            </button>
          ))}

          {/* Shift Filter Dropdown */}
          <div className="flex items-center gap-1.5 border-l pl-3 border-[var(--panel-border)]">
            <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Shift:</span>
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
              className="rounded-xl border px-2.5 py-1 text-xs font-semibold focus:outline-none focus:border-[#4cd34c]"
              style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
            >
              <option value="All">All Shifts</option>
              {(shifts || []).map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

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

      {/* ISSUES LIST / CARDS GRID */}
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
            {searchTerm || statusFilter !== "All" || carryForwardOnly
              ? "No records match your active filters or search terms."
              : "No issues recorded yet for this shift. Click '+ Record Issue' above to log a new issue."}
          </p>
          {(searchTerm || statusFilter !== "All" || carryForwardOnly) && (
            <button
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("All");
                setCarryForwardOnly(false);
              }}
              className="mt-2 text-xs text-[#4cd34c] underline font-bold"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredIssues.map((issue) => (
            <div
              key={issue.id}
              className={`rounded-3xl border p-6 shadow-md backdrop-blur transition-all space-y-4 ${
                issue.carry_forward && issue.status !== "Resolved"
                  ? "border-[#f1c84b]/50 bg-gradient-to-r from-[#f1c84b]/5 via-transparent to-transparent"
                  : ""
              }`}
              style={{
                borderColor: issue.carry_forward && issue.status !== "Resolved" ? undefined : "var(--panel-border)",
                backgroundColor: "var(--panel-bg)",
              }}
            >
              {/* Card Header */}
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b pb-3" style={{ borderColor: "var(--panel-border)" }}>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-extrabold px-3 py-1 rounded-full bg-[#4cd34c]/15 text-[#4cd34c] border border-[#4cd34c]/30 shadow-sm">
                    {issue.reference_no || `#SIR-${issue.id}`}
                  </span>
                  <h3 className="text-lg font-bold" style={{ color: "var(--app-text)" }}>
                    {issue.title}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  {/* Carry Forward Badge */}
                  {issue.carry_forward && (
                    <span className="rounded-full border px-2.5 py-0.5 text-[11px] font-bold border-[#ff6b6b]/40 bg-[#ff6b6b]/10 text-[#ff6b6b]">
                      Next Shift Priority ⚡
                    </span>
                  )}

                  {/* Status Badge */}
                  <span
                    className={`rounded-full border px-3 py-0.5 text-xs font-bold ${
                      issue.status === "Resolved"
                        ? "border-[#4cd34c]/40 bg-[#4cd34c]/10 text-[#4cd34c]"
                        : issue.status === "Monitoring"
                          ? "border-[#f1c84b]/40 bg-[#f1c84b]/10 text-[#f1c84b]"
                          : "border-[#ff6b6b]/40 bg-[#ff6b6b]/10 text-[#ff6b6b]"
                    }`}
                  >
                    ● {issue.status}
                  </span>

                  {/* Edit / Delete Buttons */}
                  <div className="ml-2 flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEditModal(issue)}
                      className="px-2.5 py-1 rounded-xl border text-xs font-semibold hover:opacity-80 transition"
                      style={{ borderColor: "var(--badge-border)" }}
                      title="Edit issue details"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteIssue(issue.id)}
                      className="px-2.5 py-1 rounded-xl border text-xs font-semibold hover:bg-[#ff6b6b]/10 hover:text-[#ff6b6b] transition"
                      style={{ borderColor: "var(--error-border)", color: "var(--error-text)" }}
                      title="Delete record"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Description */}
                <div className="rounded-2xl border p-3.5 space-y-1" style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)" }}>
                  <span className="font-bold text-[#4cd34c] uppercase tracking-wider text-[10px]">Description of Issue</span>
                  <p className="whitespace-pre-wrap font-medium" style={{ color: "var(--app-text)" }}>
                    {issue.description}
                  </p>
                </div>

                {/* Actions Taken */}
                <div className="rounded-2xl border p-3.5 space-y-1" style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)" }}>
                  <span className="font-bold text-[#4cd34c] uppercase tracking-wider text-[10px]">Actions Taken</span>
                  <p className="whitespace-pre-wrap font-medium" style={{ color: "var(--app-text)" }}>
                    {issue.actions_taken}
                  </p>
                </div>
              </div>

              {/* Optional Response given to customer */}
              {issue.customer_response && (
                <div className="rounded-2xl border p-3.5 text-xs bg-[#4cd34c]/5 border-[#4cd34c]/30">
                  <span className="font-bold text-[#4cd34c] uppercase tracking-wider text-[10px] block mb-1">
                    💬 Customer Given Response:
                  </span>
                  <p className="whitespace-pre-wrap font-medium text-emerald-300">
                    "{issue.customer_response}"
                  </p>
                </div>
              )}

              {/* Next Shift Instructions (If carried forward) */}
              {issue.carry_forward && issue.next_shift_instructions && (
                <div className="rounded-2xl border p-3.5 text-xs bg-[#f1c84b]/10 border-[#f1c84b]/40 text-[#f1c84b]">
                  <span className="font-bold uppercase tracking-wider text-[10px] block mb-1">
                    📌 What Next Shift Should Know / Do:
                  </span>
                  <p className="whitespace-pre-wrap font-semibold">
                    {issue.next_shift_instructions}
                  </p>
                </div>
              )}

              {/* Card Footer Metadata */}
              <div className="flex flex-wrap items-center justify-between pt-2 border-t text-[11px]" style={{ borderColor: "var(--panel-border)", color: "var(--text-muted)" }}>
                <div className="flex items-center gap-4">
                  <span>First Noticed: <strong className="text-[var(--app-text)]">{issue.time_noticed}</strong></span>
                  <span>Escalated To: <strong className="text-[var(--app-text)]">{issue.escalated_to || "None"}</strong></span>
                  {issue.shift_name && <span>Shift: <strong className="text-[var(--app-text)]">{issue.shift_name}</strong></span>}
                </div>

                <div>
                  Logged by: <strong className="text-[#4cd34c]">{issue.logged_by_name} ({issue.logged_by_initials})</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* RECORD / EDIT ISSUE MODAL */}
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
