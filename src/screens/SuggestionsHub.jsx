export default function SuggestionsHub({
  activeScreen,
  currentAgent,
  suggestions,
  sugName,
  setSugName,
  sugBody,
  setSugBody,
  sugType,
  setSugType,
  sugCat,
  setSugCat,
  sugSubcat,
  setSugSubcat,
  sugSubmitting,
  sugFilterStatus,
  setSugFilterStatus,
  handleSubmitSuggestion,
  handleApproveSuggestion,
  handleRejectSuggestion,
}) {
  if (activeScreen !== "suggestions" || !currentAgent) return null;

  return (
    <section className="max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--panel-border)" }}>
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: "var(--app-text)" }}>
            <span className="text-2xl">💡</span>
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
                className="w-full rounded-xl border p-2.5 text-sm"
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
                  className="w-full rounded-xl border p-2.5 text-sm"
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
                className="w-full rounded-xl border p-2.5 text-sm"
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
              className="w-full rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] py-3 font-semibold text-[#071007] shadow-lg disabled:opacity-50 transition hover:opacity-90"
            >
              {sugSubmitting ? "Submitting..." : "Submit Template Suggestion 💡"}
            </button>
          </form>
        </div>

        {/* Suggestions List & Approval Portal */}
        <div
          className="lg:col-span-7 rounded-3xl border p-6 shadow-[var(--panel-shadow)] backdrop-blur space-y-5"
          style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold" style={{ color: "var(--app-text)" }}>
                Team Template Suggestions ({suggestions.length})
              </h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {currentAgent?.is_admin
                  ? "Review pending team suggestions to approve into live templates."
                  : "Track status of submitted team template suggestions."}
              </p>
            </div>

            {/* Status Filter */}
            <div className="flex gap-1.5">
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

          <div className="space-y-3 max-h-[38rem] overflow-y-auto pr-1">
            {suggestions.filter((s) => sugFilterStatus === "All" || s.status === sugFilterStatus).length === 0 ? (
              <div className="p-8 text-center rounded-2xl border italic text-xs" style={{ borderColor: "var(--field-border)", color: "var(--text-muted)" }}>
                No template suggestions found for this status filter.
              </div>
            ) : (
              suggestions
                .filter((s) => sugFilterStatus === "All" || s.status === sugFilterStatus)
                .map((sug) => (
                  <div
                    key={sug.id}
                    className="p-4 rounded-2xl border space-y-3 transition backdrop-blur"
                    style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)" }}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-base flex items-center gap-2">
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
                        className={`text-[10px] rounded-full border px-2.5 py-0.5 uppercase font-bold ${
                          sug.status === "approved"
                            ? "text-[#4cd34c] border-[#4cd34c]/40 bg-[#4cd34c]/10"
                            : sug.status === "rejected"
                              ? "text-[var(--error-text)] border-[var(--error-border)] bg-[var(--error-bg)]"
                              : "text-[#f1c84b] border-[#f1c84b]/40 bg-[#f1c84b]/10"
                        }`}
                      >
                        {sug.status === "approved" ? "Approved ✅" : sug.status === "rejected" ? "Rejected ❌" : "Pending Review ⏳"}
                      </span>
                    </div>

                    <div className="rounded-xl border p-3 font-mono text-xs whitespace-pre-wrap leading-relaxed" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}>
                      {sug.body}
                    </div>

                    <div className="flex items-center justify-between pt-1 text-xs">
                      <span className="text-[11px] text-[var(--text-muted)] italic flex items-center gap-1">
                        Suggested by <strong className="text-[#4cd34c] font-semibold">{sug.suggested_by_name} ({sug.suggested_by_initials})</strong>
                      </span>

                      {currentAgent?.is_admin ? (
                        <div className="flex gap-2">
                          {sug.status !== "approved" ? (
                            <button
                              type="button"
                              onClick={() => handleApproveSuggestion(sug.id)}
                              className="px-3 py-1.5 rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] text-xs font-semibold shadow transition hover:opacity-90"
                            >
                              Approve & Add to Templates Library
                            </button>
                          ) : null}
                          {sug.status !== "rejected" ? (
                            <button
                              type="button"
                              onClick={() => handleRejectSuggestion(sug.id)}
                              className="px-3 py-1.5 rounded-xl border text-xs font-semibold hover:bg-[#b83838]/20 transition"
                              style={{ borderColor: "var(--error-border)", color: "var(--error-text)" }}
                            >
                              Reject
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
