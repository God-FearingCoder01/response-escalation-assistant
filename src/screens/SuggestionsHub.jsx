import { useState } from "react";

function getSuggestionDateBucket(sug) {
  if (!sug) return "Long time ago";
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const thisWeekStart = todayStart - 6 * 86400000;
  const lastWeekStart = todayStart - 13 * 86400000;

  let time = null;
  if (sug.created_at) {
    time = new Date(sug.created_at).getTime();
  } else if (sug.id && typeof sug.id === "number" && sug.id > 1600000000000) {
    time = sug.id;
  }

  if (!time || isNaN(time)) return "Long time ago";

  if (time >= todayStart) return "Today";
  if (time >= yesterdayStart) return "Yesterday";
  if (time >= thisWeekStart) return "This Week";
  if (time >= lastWeekStart) return "Last Week";
  return "Long time ago";
}

function getSuggestionCategoryBucket(sug) {
  if (!sug) return "General";
  const cat = (sug.category || "").trim();
  if (!cat) return "General";
  return cat;
}

export default function SuggestionsHub({
  activeScreen,
  currentAgent,
  suggestions = [],
  sugName = "",
  setSugName,
  sugBody = "",
  setSugBody,
  sugType = "customer_reply",
  setSugType,
  sugCat = "",
  setSugCat,
  sugSubcat = "",
  setSugSubcat,
  sugSubmitting = false,
  sugFilterStatus = "all",
  setSugFilterStatus,
  handleSubmitSuggestion,
  handleApproveSuggestion,
  handleRejectSuggestion,
  handleDeleteSuggestion,
}) {
  const [groupingMode, setGroupingMode] = useState("date"); // 'date' | 'category'
  const [expandedGroups, setExpandedGroups] = useState({});

  if (activeScreen !== "suggestions" || !currentAgent) return null;

  const sugList = suggestions || [];
  const filteredSuggestions = sugList.filter(
    (s) => sugFilterStatus === "All" || sugFilterStatus === "all" || s.status === sugFilterStatus
  );

  // Group suggestions according to mode
  let groupedSections = [];

  if (groupingMode === "date") {
    const DATE_BUCKETS = ["Today", "Yesterday", "This Week", "Last Week", "Long time ago"];
    groupedSections = DATE_BUCKETS.map((bucket) => {
      const items = filteredSuggestions.filter((s) => getSuggestionDateBucket(s) === bucket);
      return { title: bucket, items, type: "date" };
    }).filter((section) => section.items.length > 0);
  } else {
    // Group by category
    const catMap = {};
    for (const sug of filteredSuggestions) {
      const catKey = getSuggestionCategoryBucket(sug);
      if (!catMap[catKey]) catMap[catKey] = [];
      catMap[catKey].push(sug);
    }

    const catKeys = Object.keys(catMap).sort((a, b) => {
      if (a === "General") return 1;
      if (b === "General") return -1;
      return a.localeCompare(b);
    });

    groupedSections = catKeys.map((cat) => ({
      title: cat,
      items: catMap[cat],
      type: "category",
    }));
  }

  const toggleAccordion = (title) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  const isGroupExpanded = (title) => {
    // Collapsed by default
    return Boolean(expandedGroups[title]);
  };

  return (
    <section className="max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--panel-border)" }}>
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: "var(--app-text)" }}>
            <img src="/bulb.png" alt="Lightbulb" className="h-6 w-6 object-contain" />
            Template Suggestions Hub
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Submit & review standardized communication templates for team-wide approval across support shifts.
          </p>
        </div>
        <span className="rounded-full border px-3 py-1 text-xs uppercase font-bold tracking-wider text-[#4cd34c] border-[#4cd34c]/40 bg-[#4cd34c]/10">
          Standardization Center
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Submission Form */}
        <div
          className="lg:col-span-5 rounded-3xl border p-6 shadow-[var(--panel-shadow)] backdrop-blur space-y-5"
          style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}
        >
          <div>
            <h3 className="text-lg font-bold" style={{ color: "var(--app-text)" }}>
              Submit a New Template Suggestion
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Suggest a response template you found effective for manager/team lead approval.
            </p>
          </div>

          <form onSubmit={handleSubmitSuggestion} className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-muted)" }}>
                Suggested Template Name *
              </label>
              <input
                value={sugName}
                onChange={(e) => setSugName(e.target.value)}
                placeholder="e.g. Verification Delay Notice"
                className="w-full rounded-xl border p-2.5 text-sm font-medium"
                style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-muted)" }}>
                  Target Center *
                </label>
                <select
                  value={sugType}
                  onChange={(e) => setSugType(e.target.value)}
                  className="w-full rounded-xl border p-2.5 text-sm font-medium"
                  style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                >
                  <option value="customer_reply">Customer Reply</option>
                  <option value="tech_escalation">Tech Escalation</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-muted)" }}>
                  Category
                </label>
                <input
                  value={sugCat}
                  onChange={(e) => setSugCat(e.target.value)}
                  placeholder="e.g. Transactions"
                  className="w-full rounded-xl border p-2.5 text-sm font-medium"
                  style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-muted)" }}>
                Subcategory (Optional)
              </label>
              <input
                value={sugSubcat}
                onChange={(e) => setSugSubcat(e.target.value)}
                placeholder="e.g. Verification"
                className="w-full rounded-xl border p-2.5 text-sm font-medium"
                style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-muted)" }}>
                Suggested Message Body *
              </label>
              <textarea
                rows={5}
                value={sugBody}
                onChange={(e) => setSugBody(e.target.value)}
                placeholder="Enter the template body text with placeholders like {customer_name}, {day}, {time_units}..."
                className="w-full rounded-xl border p-3 text-sm font-mono leading-relaxed"
                style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                required
              />
            </div>

            <button
              type="submit"
              disabled={sugSubmitting || !sugName.trim() || !sugBody.trim()}
              className="w-full rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] py-3 font-semibold text-[#071007] shadow-lg disabled:opacity-50 transition hover:opacity-90 flex items-center justify-center gap-2"
            >
              <span>{sugSubmitting ? "Submitting..." : "Submit Template Suggestion"}</span>
              <img src="/bulb.png" alt="Bulb" className="h-4 w-4 object-contain" />
            </button>
          </form>
        </div>

        {/* Suggestions List & Accordion Categorization Portal */}
        <div
          className="lg:col-span-7 rounded-3xl border p-6 shadow-[var(--panel-shadow)] backdrop-blur space-y-5"
          style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold" style={{ color: "var(--app-text)" }}>
                Team Template Suggestions ({filteredSuggestions.length})
              </h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {currentAgent?.is_admin
                  ? "Review pending team suggestions to approve into live templates."
                  : "Track status of submitted team template suggestions."}
              </p>
            </div>

            {/* Ordering / Grouping Mode Selector & Status Filter */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Grouping Mode Pill Toggle */}
              <div className="flex items-center rounded-xl border p-1 text-xs" style={{ borderColor: "var(--badge-border)" }}>
                <button
                  type="button"
                  onClick={() => setGroupingMode("date")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 ${
                    groupingMode === "date" ? "bg-[#4cd34c] text-[#071007]" : "opacity-70 hover:opacity-100"
                  }`}
                >
                  <img src="/calendar.png" alt="Calendar" className="h-3.5 w-3.5 object-contain" />
                  <span>By Date</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGroupingMode("category")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 ${
                    groupingMode === "category" ? "bg-[#4cd34c] text-[#071007]" : "opacity-70 hover:opacity-100"
                  }`}
                >
                  <img src="/folder.png" alt="Folder" className="h-3.5 w-3.5 object-contain" />
                  <span>By Category</span>
                </button>
              </div>

              {/* Status Filters */}
              <div className="flex gap-1">
                {["All", "pending", "approved", "rejected"].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setSugFilterStatus(st)}
                    className={`px-2.5 py-1 rounded-xl text-xs capitalize font-semibold border transition ${
                      sugFilterStatus === st
                        ? "border-[#4cd34c] bg-[#4cd34c]/10 text-[#4cd34c]"
                        : "hover:bg-[var(--neutral-bg)] text-[var(--text-muted)]"
                    }`}
                    style={{ borderColor: sugFilterStatus === st ? "#4cd34c" : "var(--field-border)" }}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Grouped Accordions List */}
          <div className="space-y-4 max-h-[42rem] overflow-y-auto pr-1">
            {groupedSections.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border italic text-xs" style={{ borderColor: "var(--field-border)", color: "var(--text-muted)" }}>
                No template suggestions found for the current filters.
              </div>
            ) : (
              groupedSections.map((section) => {
                const expanded = isGroupExpanded(section.title);
                return (
                  <div
                    key={section.title}
                    className="rounded-2xl border shadow-sm transition overflow-hidden"
                    style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--field-bg)" }}
                  >
                    {/* Accordion Header */}
                    <div
                      onClick={() => toggleAccordion(section.title)}
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-[var(--neutral-bg)] transition select-none"
                    >
                      <div className="flex items-center gap-2.5">
                        {section.type === "date" ? (
                          <img src="/calendar.png" alt="Calendar" className="h-4 w-4 object-contain" />
                        ) : (
                          <img src="/folder.png" alt="Folder" className="h-4 w-4 object-contain" />
                        )}
                        <h4 className="font-bold text-sm tracking-wide" style={{ color: "var(--app-text)" }}>
                          {section.title}
                        </h4>
                        <span className="text-[11px] rounded-full border px-2 py-0.5 font-semibold text-[#4cd34c] border-[#4cd34c]/30 bg-[#4cd34c]/10">
                          {section.items.length} suggestion{section.items.length === 1 ? "" : "s"}
                        </span>
                      </div>

                      <span className={`transform transition-transform duration-200 text-xs ${expanded ? "rotate-180" : ""}`}>
                        ▼
                      </span>
                    </div>

                    {/* Accordion Body */}
                    {expanded && (
                      <div className="p-4 border-t space-y-3" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}>
                        {section.items.map((sug) => (
                          <div
                            key={sug.id}
                            className="p-4 rounded-2xl border space-y-3 transition backdrop-blur"
                            style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)" }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-bold text-sm flex items-center gap-2 flex-wrap">
                                  {sug.name}
                                  <span className="text-[10px] rounded-full border px-2 py-0.5 uppercase font-bold" style={{ borderColor: "var(--badge-border)", color: "var(--badge-text)" }}>
                                    {sug.category_type === "tech_escalation" ? "Tech Escalation" : "Customer Reply"}
                                  </span>
                                </div>
                                <div className="text-xs text-[var(--text-muted)] mt-0.5">
                                  Category: <strong className="text-[var(--app-text)]">{sug.category || "General"}</strong>
                                  {sug.subcategory ? ` › ${sug.subcategory}` : ""}
                                </div>
                              </div>

                              {/* Status Badge */}
                              <span
                                className={`text-[10px] rounded-full border px-2.5 py-0.5 uppercase font-bold shrink-0 flex items-center gap-1 ${
                                  sug.status === "approved"
                                    ? "text-[#4cd34c] border-[#4cd34c]/40 bg-[#4cd34c]/10"
                                    : sug.status === "rejected"
                                      ? "text-[var(--error-text)] border-[var(--error-border)] bg-[var(--error-bg)]"
                                      : "text-[#f1c84b] border-[#f1c84b]/40 bg-[#f1c84b]/10"
                                }`}
                              >
                                {sug.status === "approved" ? (
                                  <>
                                    <img src="/signed.png" alt="Approved" className="h-3 w-3 object-contain" />
                                    Approved
                                  </>
                                ) : sug.status === "rejected" ? (
                                  <>
                                    <img src="/warning.png" alt="Rejected" className="h-3 w-3 object-contain" />
                                    Rejected
                                  </>
                                ) : (
                                  <>
                                    <img src="/clock.png" alt="Pending" className="h-3 w-3 object-contain" />
                                    Pending
                                  </>
                                )}
                              </span>
                            </div>

                            <div className="rounded-xl border p-3 font-mono text-xs whitespace-pre-wrap leading-relaxed" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}>
                              {sug.body}
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-xs">
                              <span className="text-[11px] text-[var(--text-muted)] italic">
                                Suggested by <strong className="text-[#4cd34c] font-semibold">{sug.suggested_by_name} ({sug.suggested_by_initials})</strong>
                              </span>

                              <div className="flex gap-2 self-end sm:self-center">
                                {currentAgent?.is_admin && sug.status !== "approved" && (
                                  <button
                                    type="button"
                                    onClick={() => handleApproveSuggestion(sug.id)}
                                    className="px-3 py-1 rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] text-xs font-semibold shadow transition hover:opacity-90 cursor-pointer"
                                  >
                                    Approve & Add
                                  </button>
                                )}
                                {currentAgent?.is_admin && sug.status !== "rejected" && (
                                  <button
                                    type="button"
                                    onClick={() => handleRejectSuggestion(sug.id)}
                                    className="px-3 py-1 rounded-xl border text-xs font-semibold hover:bg-[#b83838]/20 transition cursor-pointer"
                                    style={{ borderColor: "var(--error-border)", color: "var(--error-text)" }}
                                  >
                                    Reject
                                  </button>
                                )}
                                {(currentAgent?.is_admin || (currentAgent?.agent_initials && sug.suggested_by_initials === currentAgent?.agent_initials)) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (window.confirm(`Delete suggestion "${sug.name}"?`)) {
                                        handleDeleteSuggestion(sug.id);
                                      }
                                    }}
                                    className="px-3 py-1 rounded-xl border text-xs font-semibold hover:bg-[#b83838]/20 transition cursor-pointer flex items-center gap-1.5"
                                    style={{ borderColor: "var(--error-border)", color: "var(--error-text)" }}
                                    title="Permanently delete template suggestion"
                                  >
                                    <img src="/warning.png" alt="Delete" className="h-3.5 w-3.5 object-contain" />
                                    <span>Delete</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
