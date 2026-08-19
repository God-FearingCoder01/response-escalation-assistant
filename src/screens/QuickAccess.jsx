import { useState } from "react";
import { getDateAutoValues, resolveConditionalMappings, formatDateTimeString } from "../services/api";

export default function QuickAccess({
  activeScreen,
  currentAgent,
  quickTab,
  setQuickTab,
  favoriteTemplates = [],
  mostUsedTemplates = [],
  recentlyUsedTemplates = [],
  templates = [],
  setSelectedQuickId,
  activeTemplate,
  toggleFavorite,
  favoriteIds = [],
  usageCounts = {},
  placeholders = [],
  values = {},
  setValues,
  generatedMsg,
  copyText,
  privateNotesHook,
}) {
  const [showCreateNote, setShowCreateNote] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [newNoteName, setNewNoteName] = useState("");
  const [newNoteBody, setNewNoteBody] = useState("");
  const [newNoteType, setNewNoteType] = useState("customer_reply");
  const [creatingNote, setCreatingNote] = useState(false);

  if (activeScreen !== "quick_access" || !currentAgent) return null;

  const {
    privateNotes = [],
    createPrivateNote,
    updatePrivateNote,
    deletePrivateNote,
    trackPrivateNoteUsage,
    promoteToSuggestion,
    promptBannerNote,
    dismissPromptBanner,
  } = privateNotesHook || {};

  const favList = favoriteTemplates || [];
  const mostList = mostUsedTemplates || [];
  const recList = recentlyUsedTemplates || [];
  const privList = privateNotes || [];
  const allTemplates = templates || [];
  const favIds = favoriteIds || [];
  const counts = usageCounts || {};
  const phList = placeholders || [];

  const currentTabTemplates =
    quickTab === "favorites"
      ? favList
      : quickTab === "most_used"
        ? mostList
        : quickTab === "private_notes"
          ? privList
          : recList;

  const handleStartCreateNote = () => {
    setEditingNote(null);
    setNewNoteName("");
    setNewNoteBody("");
    setNewNoteType("customer_reply");
    setShowCreateNote(true);
  };

  const handleStartEditNote = (note) => {
    setEditingNote(note);
    setNewNoteName(note.name || "");
    setNewNoteBody(note.body || "");
    setNewNoteType(note.category_type || "customer_reply");
    setShowCreateNote(true);
  };

  const handleSavePrivateNote = async (e) => {
    e.preventDefault();
    if (!newNoteName.trim() || !newNoteBody.trim()) return;
    setCreatingNote(true);
    try {
      if (editingNote && updatePrivateNote) {
        const updated = await updatePrivateNote(editingNote.id, {
          name: newNoteName.trim(),
          body: newNoteBody.trim(),
          category_type: newNoteType,
        });
        if (updated && setSelectedQuickId) {
          setSelectedQuickId(updated.id);
        }
      } else if (createPrivateNote) {
        const created = await createPrivateNote({
          name: newNoteName.trim(),
          body: newNoteBody.trim(),
          category_type: newNoteType,
          category: "Personal Notes",
        });
        if (created && setSelectedQuickId) {
          setSelectedQuickId(created.id);
        }
      }
      setEditingNote(null);
      setNewNoteName("");
      setNewNoteBody("");
      setShowCreateNote(false);
    } catch (e) {
    } finally {
      setCreatingNote(false);
    }
  };

  const handleCopyAction = () => {
    copyText(generatedMsg, "Quick message copied to clipboard! 📋", activeTemplate?.id);
    if (activeTemplate && (activeTemplate.is_private_note || activeTemplate.agent_initials || quickTab === "private_notes" || privList.some(n => n.id === activeTemplate.id))) {
      if (trackPrivateNoteUsage) {
        trackPrivateNoteUsage(activeTemplate.id);
      }
    }
  };

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto space-y-4 lg:space-y-0">
      {/* High-frequency Private Note Smart Suggestion Banner */}
      {promptBannerNote && (
        <div className="lg:col-span-12 p-4 rounded-2xl border border-[#4cd34c]/40 bg-[#4cd34c]/10 text-xs flex flex-wrap items-center justify-between gap-3 shadow-md animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <div className="font-bold text-sm text-[var(--app-text)]">
                Smart Suggestion: Frequently Used Private Note!
              </div>
              <div style={{ color: "var(--text-muted)" }}>
                You've used your private template <strong>"{promptBannerNote.name}"</strong> {promptBannerNote.use_count} times. Would you like to share it as a Team Suggestion?
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => promoteToSuggestion(promptBannerNote)}
              className="px-3.5 py-1.5 rounded-xl bg-[#4cd34c] text-black font-extrabold text-xs shadow-sm hover:opacity-90 transition flex items-center gap-1.5"
            >
              🚀 Submit to Team Suggestions
            </button>
            <button
              type="button"
              onClick={dismissPromptBanner}
              className="px-2.5 py-1.5 rounded-xl border text-xs font-semibold hover:bg-[var(--neutral-bg)] transition"
              style={{ borderColor: "var(--field-border)", color: "var(--text-muted)" }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Left Panel: Favorites & Recents & Private Notes Selector */}
      <div
        className="lg:col-span-7 rounded-3xl border p-6 shadow-[var(--panel-shadow)] backdrop-blur space-y-5"
        style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold mb-1 flex items-center gap-2" style={{ color: "var(--app-text)" }}>
              <span className="text-xl">⭐</span>
              Quick Access & Favorites Center
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Instant access to your starred, most used, recently copied, and private agent response templates.
            </p>
          </div>
          {quickTab === "private_notes" && (
            <button
              type="button"
              onClick={() => {
                if (showCreateNote) {
                  setShowCreateNote(false);
                  setEditingNote(null);
                } else {
                  handleStartCreateNote();
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-[#4cd34c] text-black font-bold text-xs shadow-sm hover:opacity-90 transition flex items-center gap-1 shrink-0"
            >
              {showCreateNote ? "✕ Close Form" : "+ Add Private Note"}
            </button>
          )}
        </div>

        {/* Create / Edit Private Note Form */}
        {showCreateNote && (
          <form onSubmit={handleSavePrivateNote} className="p-4 rounded-2xl border bg-[var(--field-bg)] space-y-3 shadow-md" style={{ borderColor: "#4cd34c" }}>
            <div className="font-bold text-xs text-[#4cd34c] flex items-center justify-between">
              <span>{editingNote ? "✏️ Edit Private Agent Template" : "🔒 Create Private Agent Template"}</span>
              {editingNote && (
                <span className="text-[10px] bg-[#4cd34c]/20 px-2 py-0.5 rounded-full">Editing ID: {editingNote.id}</span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold block mb-1" style={{ color: "var(--text-muted)" }}>Template Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. My Personal Verification Response"
                  value={newNoteName}
                  onChange={(e) => setNewNoteName(e.target.value)}
                  className="w-full rounded-xl border p-2 text-xs font-semibold focus:outline-none focus:border-[#4cd34c]"
                  style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold block mb-1" style={{ color: "var(--text-muted)" }}>Template Type</label>
                <select
                  value={newNoteType}
                  onChange={(e) => setNewNoteType(e.target.value)}
                  className="w-full rounded-xl border p-2 text-xs font-semibold focus:outline-none focus:border-[#4cd34c]"
                  style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                >
                  <option value="customer_reply">Customer Reply</option>
                  <option value="tech_escalation">Tech Escalation</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold block mb-1" style={{ color: "var(--text-muted)" }}>Message Body (Use {"{customer_name}"}, {"{greeting}"}, {"{reason}"} for placeholders) *</label>
              <textarea
                required
                rows={3}
                placeholder="Good {greeting} {customer_name}, your request is being handled..."
                value={newNoteBody}
                onChange={(e) => setNewNoteBody(e.target.value)}
                className="w-full rounded-xl border p-2 text-xs font-mono focus:outline-none focus:border-[#4cd34c]"
                style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreateNote(false);
                  setEditingNote(null);
                }}
                className="px-3 py-1.5 rounded-xl border text-xs font-semibold hover:bg-[var(--neutral-bg)]"
                style={{ borderColor: "var(--field-border)", color: "var(--text-muted)" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingNote}
                className="px-4 py-1.5 rounded-xl bg-[#4cd34c] text-black font-bold text-xs hover:opacity-90 transition"
              >
                {creatingNote ? "Saving..." : (editingNote ? "Update Private Note" : "Save Private Note")}
              </button>
            </div>
          </form>
        )}

        {/* Sub-Tab Navigation */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-b pb-3" style={{ borderColor: "var(--field-border)" }}>
          <button
            type="button"
            onClick={() => setQuickTab("favorites")}
            className={`rounded-xl border py-2 px-2.5 text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
              quickTab === "favorites"
                ? "border-[#4cd34c] bg-[#4cd34c]/10 text-[#4cd34c] shadow-sm"
                : "hover:bg-[var(--neutral-bg)] text-[var(--text-muted)]"
            }`}
            style={{ borderColor: quickTab === "favorites" ? "#4cd34c" : "var(--field-border)" }}
          >
            <span>⭐ Favorites</span>
            <span className="text-[10px] rounded-full px-1.5 py-0.2 bg-[#4cd34c]/20 font-bold">{favList.length}</span>
          </button>

          <button
            type="button"
            onClick={() => setQuickTab("most_used")}
            className={`rounded-xl border py-2 px-2.5 text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
              quickTab === "most_used"
                ? "border-[#4cd34c] bg-[#4cd34c]/10 text-[#4cd34c] shadow-sm"
                : "hover:bg-[var(--neutral-bg)] text-[var(--text-muted)]"
            }`}
            style={{ borderColor: quickTab === "most_used" ? "#4cd34c" : "var(--field-border)" }}
          >
            <span className="flex items-center gap-1 truncate">
              <img src="/fire.png" alt="Most Used" className="h-3.5 w-3.5 shrink-0 object-contain" />
              Most Used
            </span>
            <span className="text-[10px] rounded-full px-1.5 py-0.2 bg-[#4cd34c]/20 font-bold">{mostList.length}</span>
          </button>

          <button
            type="button"
            onClick={() => setQuickTab("recently_used")}
            className={`rounded-xl border py-2 px-2.5 text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
              quickTab === "recently_used"
                ? "border-[#4cd34c] bg-[#4cd34c]/10 text-[#4cd34c] shadow-sm"
                : "hover:bg-[var(--neutral-bg)] text-[var(--text-muted)]"
            }`}
            style={{ borderColor: quickTab === "recently_used" ? "#4cd34c" : "var(--field-border)" }}
          >
            <span className="flex items-center gap-1 truncate">
              <img src="/clock.png" alt="Recents" className="h-3.5 w-3.5 shrink-0 object-contain" />
              Recents
            </span>
            <span className="text-[10px] rounded-full px-1.5 py-0.2 bg-[#4cd34c]/20 font-bold">{recList.length}</span>
          </button>

          <button
            type="button"
            onClick={() => setQuickTab("private_notes")}
            className={`rounded-xl border py-2 px-2.5 text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
              quickTab === "private_notes"
                ? "border-[#4cd34c] bg-[#4cd34c]/10 text-[#4cd34c] shadow-sm"
                : "hover:bg-[var(--neutral-bg)] text-[var(--text-muted)]"
            }`}
            style={{ borderColor: quickTab === "private_notes" ? "#4cd34c" : "var(--field-border)" }}
          >
            <span>🔒 Private Notes</span>
            <span className="text-[10px] rounded-full px-1.5 py-0.2 bg-[#4cd34c]/20 font-bold">{privList.length}</span>
          </button>
        </div>

        {/* Template List Cards */}
        <div className="space-y-3 max-h-[32rem] overflow-y-auto pr-1">
          {currentTabTemplates.length === 0 ? (
            <div className="space-y-4">
              <div
                className="p-6 text-center rounded-2xl border backdrop-blur space-y-2"
                style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--text-muted)" }}
              >
                <div className="text-2xl">⭐</div>
                <div className="font-bold text-sm text-[var(--app-text)]">
                  {quickTab === "favorites"
                    ? "No Starred Favorites Yet"
                    : quickTab === "most_used"
                      ? "No Copy Statistics Recorded Yet"
                      : quickTab === "private_notes"
                        ? "No Private Notes Created Yet"
                        : "No Recently Used Templates"}
                </div>
                <p className="text-xs max-w-sm mx-auto">
                  {quickTab === "private_notes"
                    ? "Create private response templates that are visible only to you. High-frequency notes can be shared with the team!"
                    : "Click the ⭐ Star icon on any template below or across Tech Escalation and Customer Reply to add it to your Favorites list!"}
                </p>
                {quickTab === "private_notes" && (
                  <button
                    type="button"
                    onClick={handleStartCreateNote}
                    className="mt-2 px-4 py-2 rounded-xl bg-[#4cd34c] text-black font-bold text-xs shadow-sm hover:opacity-90 transition"
                  >
                    + Create First Private Note
                  </button>
                )}
              </div>

              {quickTab !== "private_notes" && (
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wider block" style={{ color: "var(--text-muted)" }}>
                    All Templates Library (Click ⭐ to add to Favorites):
                  </label>
                  {allTemplates.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedQuickId(t.id)}
                      className={`p-3 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                        t.id === activeTemplate?.id
                          ? "border-[#4cd34c] ring-1 ring-[#4cd34c]/30 bg-[#4cd34c]/5"
                          : "hover:border-[#4cd34c]/50"
                      }`}
                      style={{ borderColor: t.id === activeTemplate?.id ? "#4cd34c" : "var(--field-border)", backgroundColor: "var(--field-bg)" }}
                    >
                      <div className="space-y-0.5 max-w-md">
                        <div className="font-bold text-sm flex items-center gap-2">
                          {t.name}
                          <span className="text-[10px] rounded-full border px-2 py-0.5" style={{ borderColor: "var(--badge-border)", color: "var(--badge-text)" }}>
                            {t.category_type === "tech_escalation" ? "Tech Escalation" : "Customer Reply"}
                          </span>
                        </div>
                        <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                          {t.body}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(t.id);
                        }}
                        className="p-1 rounded-lg text-sm hover:scale-125 transition shrink-0 ml-2"
                        title={favIds.includes(t.id) ? "Remove from Favorites" : "Add to Favorites"}
                      >
                        {favIds.includes(t.id) ? "⭐" : "☆"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            currentTabTemplates.map((t) => {
              const isPrivateNote = t.is_private_note || String(t.id).startsWith("priv_") || t.agent_initials !== undefined;
              const copyCount = isPrivateNote ? (t.use_count || 0) : (counts[t.id] || 0);

              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedQuickId(t.id)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                    t.id === activeTemplate?.id
                      ? "border-[#4cd34c] ring-1 ring-[#4cd34c]/30 bg-[#4cd34c]/5"
                      : "hover:border-[#4cd34c]/50"
                  }`}
                  style={{ borderColor: t.id === activeTemplate?.id ? "#4cd34c" : "var(--field-border)", backgroundColor: "var(--field-bg)" }}
                >
                  <div className="space-y-1 max-w-md">
                    <div className="font-bold text-sm flex items-center gap-2">
                      {t.name}
                      {quickTab !== "private_notes" && isPrivateNote ? (
                        <span className="text-[10px] rounded-full border px-2 py-0.5 font-semibold border-[#4cd34c] text-[#4cd34c]">
                          🔒 Private Note
                        </span>
                      ) : (
                        quickTab !== "private_notes" && (
                          <span className="text-[10px] rounded-full border px-2 py-0.5" style={{ borderColor: "var(--badge-border)", color: "var(--badge-text)" }}>
                            {t.category_type === "tech_escalation" ? "Tech Escalation" : "Customer Reply"}
                          </span>
                        )
                      )}
                    </div>
                    <div className="text-xs truncate font-mono" style={{ color: "var(--text-muted)" }}>
                      {t.body}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {copyCount > 0 ? (
                      <span className="text-[10px] font-semibold rounded-full bg-[#4cd34c]/10 text-[#4cd34c] border border-[#4cd34c]/30 px-2 py-0.5">
                        {copyCount} {copyCount === 1 ? "use" : "uses"}
                      </span>
                    ) : null}

                    {isPrivateNote && copyCount >= 3 && !t.submitted_as_suggestion && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (promoteToSuggestion) promoteToSuggestion(t);
                        }}
                        className="px-2 py-1 rounded-lg bg-[#4cd34c]/20 text-[#4cd34c] text-[10px] font-bold border border-[#4cd34c]/40 hover:bg-[#4cd34c] hover:text-black transition"
                        title="Submit this high-frequency note as a Team Suggestion"
                      >
                        🚀 Suggest
                      </button>
                    )}

                    {isPrivateNote && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEditNote(t);
                        }}
                        className="p-1 rounded-lg text-xs hover:text-[#4cd34c] transition"
                        title="Edit Private Note"
                      >
                        ✏️
                      </button>
                    )}

                    {isPrivateNote && quickTab === "private_notes" && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (deletePrivateNote && confirm(`Delete private note "${t.name}"?`)) {
                            deletePrivateNote(t.id);
                          }
                        }}
                        className="p-1 rounded-lg text-xs hover:text-red-400 transition"
                        title="Delete Private Note"
                      >
                        🗑️
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(t.id);
                      }}
                      className="p-1 rounded-lg text-sm hover:scale-125 transition"
                      title={favIds.includes(t.id) ? "Remove from Favorites" : "Add to Favorites"}
                    >
                      {favIds.includes(t.id) ? "⭐" : "☆"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Panel: Live Message Preview & Instant Parameters */}
      <div
        className="lg:col-span-5 rounded-3xl border p-6 shadow-[var(--panel-shadow)] backdrop-blur flex flex-col justify-between"
        style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold" style={{ color: "var(--app-text)" }}>
              Quick Message Preview
            </h2>
            {activeTemplate ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#4cd34c] bg-[#4cd34c]/10 border border-[#4cd34c]/30 px-2.5 py-0.5 rounded-full">
                  {activeTemplate.name}
                </span>
                {activeTemplate.is_private_note && (
                  <button
                    type="button"
                    onClick={() => handleStartEditNote(activeTemplate)}
                    className="text-xs text-[#4cd34c] font-bold hover:underline"
                  >
                    ✏️ Edit
                  </button>
                )}
              </div>
            ) : null}
          </div>
          {(() => {
            let parsedCfgMap = {};
            if (activeTemplate?.placeholder_config) {
              try {
                parsedCfgMap = typeof activeTemplate.placeholder_config === "string"
                  ? JSON.parse(activeTemplate.placeholder_config)
                  : activeTemplate.placeholder_config;
              } catch (e) {}
            }
            const { resolvedValues, mappedTargetKeys } = resolveConditionalMappings(phList, parsedCfgMap, values);
            const visiblePlaceholders = (phList || []).filter((ph) => !ph.startsWith(":") && !mappedTargetKeys.has(ph));

            return visiblePlaceholders.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1 border-b pb-3" style={{ borderColor: "var(--field-border)" }}>
                <label className="text-[11px] font-semibold uppercase tracking-wider block" style={{ color: "var(--text-muted)" }}>
                  Fill Template Parameters:
                </label>
                {visiblePlaceholders.map((ph) => {
                  const dateAuto = getDateAutoValues();
                  const customCfg = parsedCfgMap[ph] || null;

                  const isAgentField = ph === "agent_name" || ph === "agent_initials" || ph === "agent";
                  const isDateField = dateAuto[ph] !== undefined || dateAuto[ph.toLowerCase()] !== undefined;
                  const isTimeUnitField = /^time_unit/i.test(ph);
                  const isReasonField = ph.toLowerCase().includes("reason") || ph.toLowerCase().includes("details") || ph.toLowerCase().includes("note") || ph.toLowerCase().includes("description");
                  const isDayField = ph === "day" || ph === "day_number" || ph === "day_num" || ph === "dd";
                  const isMonthNumberField = ph === "month_number" || ph === "month_num" || ph === "month" || ph === "mm";

                  let controlType = customCfg?.control_type || (
                    ph.endsWith("?") ? "combobox" :
                    isReasonField ? "textarea" :
                    isTimeUnitField ? "time_units_select" :
                    isDayField || isMonthNumberField ? "number" :
                    "text"
                  );

                  let autoVal = "";
                  if (customCfg?.auto_fill_type === "date_day") autoVal = dateAuto.day;
                  else if (customCfg?.auto_fill_type === "date_month") autoVal = dateAuto.month_number;
                  else if (customCfg?.auto_fill_type === "date_year") autoVal = dateAuto.year;
                  else if (customCfg?.auto_fill_type === "date_time") autoVal = dateAuto.time;
                  else if (customCfg?.auto_fill_type === "greeting" || customCfg?.auto_fill_type === "time_of_day") autoVal = dateAuto.greeting;
                  else if (customCfg?.auto_fill_type === "Greeting" || customCfg?.auto_fill_type === "greeting_cap") autoVal = dateAuto.Greeting;
                  else if (customCfg?.auto_fill_type === "good_greeting") autoVal = dateAuto.good_greeting;
                  else if (customCfg?.auto_fill_type === "agent_name") autoVal = currentAgent?.agent_name ?? "";
                  else if (customCfg?.auto_fill_type === "agent_fullname" || customCfg?.auto_fill_type === "agent") autoVal = (currentAgent?.agent || currentAgent?.agent_name) ?? "";
                  else if (customCfg?.auto_fill_type === "agent_initials") autoVal = currentAgent?.agent_initials ?? "";
                  else if (customCfg?.auto_fill_type === "custom") autoVal = customCfg.custom_default ?? "";
                  else if (isAgentField) autoVal = ph === "agent_initials" ? currentAgent?.agent_initials : (ph === "agent" ? (currentAgent?.agent || currentAgent?.agent_name) : currentAgent?.agent_name);
                  else if (isDateField) autoVal = dateAuto[ph] ?? dateAuto[ph.toLowerCase()];
                  else if (isTimeUnitField) autoVal = "hour(s)";

                  let options = Array.isArray(customCfg?.options) ? customCfg.options : [];
                  if (options.length === 0 && ph.endsWith("?")) {
                    options = ["Elephant", "Rhino", "Lion", "Buffalo", "Leopard"];
                  }

                  const isTrigger = ph.endsWith("?") || (Boolean(customCfg?.mapped_target) && customCfg.mapped_target.trim() !== "");
                  const targetKey = isTrigger ? (customCfg?.mapped_target || `:${ph.replace(/\?$/, "")}`) : null;
                  const autoMappedVal = targetKey ? resolvedValues[targetKey] : null;

                  return (
                    <div key={ph}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs capitalize font-medium" style={{ color: "var(--text-muted)" }}>
                          {ph.replace("_", " ")}:
                        </span>
                        {targetKey && autoMappedVal ? (
                          <span className="text-[10px] text-[#4cd34c] font-extrabold bg-[#4cd34c]/15 px-2 py-0.5 rounded-full border border-[#4cd34c]/30">
                            ⚡ Auto-maps {targetKey} ➔ "{autoMappedVal}"
                          </span>
                        ) : customCfg ? (
                          <span className="text-[10px] text-[#4cd34c] font-semibold">Configured: {controlType}</span>
                        ) : isAgentField ? (
                          <span className="text-[10px] text-[#4cd34c] font-semibold">Auto-filled from profile</span>
                        ) : isDayField || isMonthNumberField ? (
                          <span className="text-[10px] text-[#4cd34c] font-semibold">Numeric up/down (Auto-filled)</span>
                        ) : isDateField ? (
                          <span className="text-[10px] text-[#4cd34c] font-semibold">Auto-filled from date</span>
                        ) : isTimeUnitField ? (
                          <span className="text-[10px] text-[#4cd34c] font-semibold">Preset dropdown</span>
                        ) : isReasonField ? (
                          <span className="text-[10px] text-[#4cd34c] font-semibold">Multi-line resizable text</span>
                        ) : null}
                      </div>      {controlType === "combobox" ? (
                      <select
                        value={values[ph] ?? (options[0] || autoVal)}
                        onChange={(e) => setValues((s) => ({ ...s, [ph]: e.target.value }))}
                        className="w-full rounded-xl border p-2 text-xs font-medium"
                        style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                      >
                        {options.length > 0 ? (
                          options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))
                        ) : (
                          <option value={autoVal || "Default"}>{autoVal || "Default"}</option>
                        )}
                      </select>
                    ) : controlType === "number" ? (
                      (isMonthNumberField || isDayField || customCfg?.auto_fill_type === "month_number" || customCfg?.auto_fill_type === "day_number" || ["month_number", "month_num", "month", "mm", "day_number", "day_num", "day", "dd"].includes(ph.toLowerCase())) ? (
                        <div className="flex items-center rounded-xl border overflow-hidden" style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)" }}>
                          <input
                            type="text"
                            maxLength={2}
                            value={
                              values[ph] !== undefined
                                ? (values[ph] ? String(parseInt(values[ph], 10) || 1).padStart(2, "0") : "")
                                : (autoVal ? String(parseInt(autoVal, 10) || 1).padStart(2, "0") : "01")
                            }
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, "");
                              if (!digits) {
                                setValues((s) => ({ ...s, [ph]: "" }));
                                return;
                              }
                              let n = parseInt(digits, 10);
                              const maxVal = (isMonthNumberField || customCfg?.auto_fill_type === "month_number" || ["month_number", "month_num", "month", "mm"].includes(ph.toLowerCase())) ? 12 : 31;
                              if (n > maxVal) n = maxVal;
                              setValues((s) => ({ ...s, [ph]: String(n).padStart(2, "0") }));
                            }}
                            placeholder="01"
                            className="w-full p-1.5 text-xs font-bold font-mono tracking-wider text-center bg-transparent focus:outline-none"
                            style={{ color: "var(--app-text)" }}
                          />
                          <div className="flex flex-col border-l" style={{ borderColor: "var(--field-border)" }}>
                            <button
                              type="button"
                              onClick={() => {
                                const maxVal = (isMonthNumberField || customCfg?.auto_fill_type === "month_number" || ["month_number", "month_num", "month", "mm"].includes(ph.toLowerCase())) ? 12 : 31;
                                const current = parseInt(values[ph] ?? autoVal ?? "1", 10) || 1;
                                let next = current + 1;
                                if (next > maxVal) next = 1;
                                setValues((s) => ({ ...s, [ph]: String(next).padStart(2, "0") }));
                              }}
                              className="px-2 py-0.5 text-[9px] font-black hover:bg-[#4cd34c]/20 transition select-none"
                              style={{ color: "var(--app-text)" }}
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const maxVal = (isMonthNumberField || customCfg?.auto_fill_type === "month_number" || ["month_number", "month_num", "month", "mm"].includes(ph.toLowerCase())) ? 12 : 31;
                                const current = parseInt(values[ph] ?? autoVal ?? "1", 10) || 1;
                                let next = current - 1;
                                if (next < 1) next = maxVal;
                                setValues((s) => ({ ...s, [ph]: String(next).padStart(2, "0") }));
                              }}
                              className="px-2 py-0.5 text-[9px] font-black hover:bg-[#4cd34c]/20 transition border-t select-none"
                              style={{ borderColor: "var(--field-border)", color: "var(--app-text)" }}
                            >
                              ▼
                            </button>
                          </div>
                        </div>
                      ) : (
                        <input
                          type="number"
                          min={1}
                          max={999999}
                          value={values[ph] ?? autoVal}
                          onChange={(e) => setValues((s) => ({ ...s, [ph]: e.target.value }))}
                          placeholder={`Enter ${ph.replace("_", " ")}`}
                          className="w-full rounded-xl border p-2 text-xs font-semibold"
                          style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                        />
                      )
                    ) : controlType === "date" ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw) {
                              const [y, m, d] = raw.split("-");
                              setValues((s) => ({ ...s, [ph]: `${d}/${m}/${y}` }));
                            }
                          }}
                          className="rounded-xl border p-1.5 text-xs font-medium shrink-0 cursor-pointer"
                          style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                        />
                        <input
                          type="text"
                          value={formatDateTimeString(values[ph] ?? autoVal, "date", customCfg?.date_format)}
                          onChange={(e) => setValues((s) => ({ ...s, [ph]: e.target.value }))}
                          placeholder={customCfg?.date_format || "DD/MM/YYYY"}
                          className="w-full rounded-xl border p-2 text-xs font-semibold font-mono tracking-wider"
                          style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                        />
                      </div>
                    ) : controlType === "time" ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          onChange={(e) => {
                            const clean = (e.target.value || "").replace(/:/g, "");
                            setValues((s) => ({ ...s, [ph]: clean }));
                          }}
                          className="rounded-xl border p-1.5 text-xs font-medium shrink-0 cursor-pointer"
                          style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                        />
                        <input
                          type="text"
                          maxLength={4}
                          value={(values[ph] ?? autoVal ?? "").toString().replace(/:/g, "")}
                          onChange={(e) => {
                            const clean = e.target.value.replace(/:/g, "").replace(/\D/g, "").slice(0, 4);
                            setValues((s) => ({ ...s, [ph]: clean }));
                          }}
                          placeholder="HHMM (e.g. 0945)"
                          className="w-full rounded-xl border p-2 text-xs font-semibold font-mono tracking-wider"
                          style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                        />
                      </div>
                    ) : controlType === "datetime" ? (
                      <input
                        type="datetime-local"
                        value={values[ph] ?? autoVal}
                        onChange={(e) => setValues((s) => ({ ...s, [ph]: e.target.value }))}
                        className="w-full rounded-xl border p-2 text-xs font-medium"
                        style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                      />
                    ) : controlType === "time_units_select" ? (
                      <select
                        value={values[ph] ?? "hour(s)"}
                        onChange={(e) => setValues((s) => ({ ...s, [ph]: e.target.value }))}
                        className="w-full rounded-xl border p-2 text-xs font-medium"
                        style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                      >
                        <option value="hour(s)">hour(s)</option>
                        <option value="minutes">minutes</option>
                      </select>
                    ) : controlType === "textarea" ? (
                      <textarea
                        rows={3}
                        value={values[ph] ?? autoVal}
                        onChange={(e) => setValues((s) => ({ ...s, [ph]: e.target.value }))}
                        placeholder={`Enter ${ph.replace("_", " ")}...`}
                        className="w-full rounded-xl border p-2.5 text-sm resize-y font-sans leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#4cd34c]"
                        style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                      />
                    ) : (
                      <input
                        value={values[ph] ?? autoVal}
                        onChange={(e) => setValues((s) => ({ ...s, [ph]: e.target.value }))}
                        placeholder={`Enter ${ph.replace("_", " ")}`}
                        className="w-full rounded-xl border p-2 text-xs placeholder:text-[var(--field-placeholder)]"
                        style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                      />
                    )}
                  </div>
                  );
                })}
              </div>
            ) : null;
          })()}

          <div
            className="rounded-2xl border p-4 min-h-[10rem] max-h-[22rem] overflow-y-auto break-words [overflow-wrap:anywhere] font-mono text-sm leading-relaxed"
            style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
          >
            {generatedMsg || <span style={{ color: "var(--field-placeholder)" }}>Select a template from Quick Access...</span>}
          </div>
        </div>

        <div className="space-y-2 mt-6">
          <button
            type="button"
            onClick={handleCopyAction}
            disabled={!generatedMsg}
            className="w-full rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] py-3 font-semibold text-[#071007] shadow-lg disabled:opacity-50 transition hover:opacity-90"
          >
            Copy Message Text 📋
          </button>
          <button
            type="button"
            onClick={() => setValues({})}
            className="w-full rounded-xl border py-2 text-sm font-medium transition hover:opacity-90"
            style={{ borderColor: "var(--badge-border)", color: "var(--neutral-text)", backgroundColor: "var(--neutral-bg)" }}
          >
            Clear Parameter Inputs
          </button>
        </div>
      </div>
    </section>
  );
}
