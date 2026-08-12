import { useRef, useEffect, useState } from "react";
import { getPresetPhrases, savePresetPhrases, DEFAULT_PRESET_PHRASES } from "../services/translationService";

export default function AdminDashboard({
  activeScreen,
  currentAgent,
  saving,
  templates,
  exportTemplates,
  importTemplatesFile,
  handleDeduplicateTemplates,
  editTplId,
  setEditTplId,
  editTplName,
  setEditTplName,
  editTplBody,
  setEditTplBody,
  editTplType,
  setEditTplType,
  editTplCat,
  setEditTplCat,
  editTplSubcat,
  setEditTplSubcat,
  handleEditTemplateClick,
  handleResetTemplateForm,
  handleCreateOrUpdateTemplate,
  handleDeleteTemplate,
  groupedAdminCategories,
  expandedAdminCats,
  setExpandedAdminCats,
  adminSubcatFilter,
  setAdminSubcatFilter,
  agents,
  editAgentId,
  setEditAgentId,
  editAgentFullName,
  setEditAgentFullName,
  editAgentName,
  setEditAgentName,
  editAgentInitials,
  setEditAgentInitials,
  editAgentIsAdmin,
  setEditAgentIsAdmin,
  setUserCustomizedInitials,
  handleEditAgentClick,
  handleResetAgentForm,
  handleCreateOrUpdateAgent,
  handleDeleteAgent,
  adminCurrentPin,
  setAdminCurrentPin,
  adminNewPin,
  setAdminNewPin,
  adminConfirmPin,
  setAdminConfirmPin,
  pinSuccessMsg,
  pinErrorMsg,
  handleChangeAdminPin,
}) {
  const fileRef = useRef(null);
  const templateFormRef = useRef(null);
  const templateBodyRef = useRef(null);

  const scrollToTemplateForm = () => {
    if (templateFormRef.current) {
      templateFormRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const adjustTextareaHeight = (element) => {
    if (element) {
      element.style.height = "auto";
      element.style.height = `${element.scrollHeight}px`;
    }
  };

  const [presetList, setPresetList] = useState(() => getPresetPhrases());
  const [editPresetIndex, setEditPresetIndex] = useState(null);
  const [presetLabel, setPresetLabel] = useState("");
  const [presetEn, setPresetEn] = useState("");
  const [presetSn, setPresetSn] = useState("");
  const [presetNd, setPresetNd] = useState("");

  const handleSavePreset = (e) => {
    e.preventDefault();
    if (!presetLabel.trim() || !presetEn.trim() || !presetSn.trim()) return;

    const newObj = { label: presetLabel.trim(), en: presetEn.trim(), sn: presetSn.trim(), nd: presetNd.trim() };
    let updatedList;
    if (editPresetIndex !== null) {
      updatedList = presetList.map((item, idx) => (idx === editPresetIndex ? newObj : item));
    } else {
      updatedList = [...presetList, newObj];
    }

    setPresetList(updatedList);
    savePresetPhrases(updatedList);
    setEditPresetIndex(null);
    setPresetLabel("");
    setPresetEn("");
    setPresetSn("");
    setPresetNd("");
  };

  const handleEditPresetClick = (preset, idx) => {
    setEditPresetIndex(idx);
    setPresetLabel(preset.label);
    setPresetEn(preset.en);
    setPresetSn(preset.sn);
    setPresetNd(preset.nd || "");
  };

  const handleDeletePreset = (idx) => {
    const updatedList = presetList.filter((_, i) => i !== idx);
    setPresetList(updatedList);
    savePresetPhrases(updatedList);
    if (editPresetIndex === idx) {
      setEditPresetIndex(null);
      setPresetLabel("");
      setPresetEn("");
      setPresetSn("");
      setPresetNd("");
    }
  };

  const handleResetPresetDefaults = () => {
    setPresetList(DEFAULT_PRESET_PHRASES);
    savePresetPhrases(DEFAULT_PRESET_PHRASES);
    setEditPresetIndex(null);
    setPresetLabel("");
    setPresetEn("");
    setPresetSn("");
    setPresetNd("");
  };

  useEffect(() => {
    if (templateBodyRef.current) {
      adjustTextareaHeight(templateBodyRef.current);
    }
  }, [editTplBody, editTplId]);

  if (activeScreen !== "admin" || !currentAgent?.is_admin) return null;

  return (
    <section className="max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--panel-border)" }}>
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: "var(--app-text)" }}>
            <img src="/admin.png" alt="System Admin" className="h-7 w-7 shrink-0 object-contain" />
            System Admin Control Panel
          </h2>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Manage global response templates, categories, agent credentials, and system security PIN.
          </p>
        </div>
        <span className="rounded-full border px-3 py-1 text-xs uppercase font-bold tracking-wider text-[#f1c84b] border-[#f1c84b]/40 bg-[#f1c84b]/10">
          Admin Privilege Mode
        </span>
      </div>

      {/* SECTION 1: TEMPLATE MANAGEMENT */}
      <div
        className="rounded-3xl border p-6 shadow-[var(--panel-shadow)] backdrop-blur space-y-6"
        style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold" style={{ color: "var(--app-text)" }}>
            1. Message Template Management
          </h3>
          <div className="flex gap-2">
            <button
              onClick={exportTemplates}
              className="px-3 py-1.5 rounded-xl border text-xs font-semibold hover:opacity-90"
              style={{ borderColor: "var(--badge-border)", color: "var(--neutral-text)", backgroundColor: "var(--neutral-bg)" }}
            >
              Export JSON
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="px-3 py-1.5 rounded-xl border text-xs font-semibold hover:opacity-90"
              style={{ borderColor: "var(--badge-border)", color: "var(--neutral-text)", backgroundColor: "var(--neutral-bg)" }}
            >
              Import JSON
            </button>
            <button
              onClick={handleDeduplicateTemplates}
              className="px-3 py-1.5 rounded-xl border text-xs font-semibold hover:bg-[#4cd34c]/10 hover:border-[#4cd34c]/50 transition"
              style={{ borderColor: "var(--badge-border)", color: "var(--neutral-text)", backgroundColor: "var(--neutral-bg)" }}
              title="Remove duplicate templates"
            >
              Clean Duplicates 🧹
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={importTemplatesFile}
            />
          </div>
        </div>

        {/* Create/Edit Template Form */}
        <div
          ref={templateFormRef}
          className="rounded-2xl border p-4 space-y-3"
          style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--field-bg)" }}
        >
          <h4 className="text-xs uppercase font-semibold" style={{ color: "var(--text-muted)" }}>
            {editTplId ? `Edit Template #${editTplId}` : "Create New Response Template"}
          </h4>
          <form onSubmit={handleCreateOrUpdateTemplate}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="text-[11px] block mb-1" style={{ color: "var(--text-muted)" }}>Category Type:</label>
                <select
                  value={editTplType}
                  onChange={(e) => setEditTplType(e.target.value)}
                  className="w-full rounded-xl border p-2.5 text-sm"
                  style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                >
                  <option value="tech_escalation">Tech Escalation (Telegram)</option>
                  <option value="customer_reply">Customer Reply (Signed & Unsigned)</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] block mb-1" style={{ color: "var(--text-muted)" }}>Primary Category:</label>
                <input
                  value={editTplCat}
                  onChange={(e) => setEditTplCat(e.target.value)}
                  placeholder="e.g. Agent Introductions, Transactions"
                  className="w-full rounded-xl border p-2.5 text-sm"
                  style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                />
              </div>
              <div>
                <label className="text-[11px] block mb-1" style={{ color: "var(--text-muted)" }}>Subcategory (Optional):</label>
                <input
                  value={editTplSubcat}
                  onChange={(e) => setEditTplSubcat(e.target.value)}
                  placeholder="e.g. Deposit, Withdrawal"
                  className="w-full rounded-xl border p-2.5 text-sm"
                  style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                />
              </div>
              <div className="md:col-span-3">
                <label className="text-[11px] block mb-1" style={{ color: "var(--text-muted)" }}>Template Title:</label>
                <input
                  value={editTplName}
                  onChange={(e) => setEditTplName(e.target.value)}
                  placeholder="e.g. Deposit Under Review"
                  className="w-full rounded-xl border p-2.5 text-sm"
                  style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                />
              </div>
              <div className="md:col-span-3">
                <label className="text-[11px] block mb-1" style={{ color: "var(--text-muted)" }}>Template Body (use placeholders like {"{customer_name}"}):</label>
                <textarea
                  ref={templateBodyRef}
                  value={editTplBody}
                  onChange={(e) => {
                    setEditTplBody(e.target.value);
                    adjustTextareaHeight(e.target);
                  }}
                  placeholder="Write message template..."
                  className="w-full rounded-xl border p-2.5 min-h-[5rem] text-sm overflow-hidden resize-none transition-all"
                  style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              {(editTplId || editTplName || editTplBody || editTplCat || editTplSubcat) ? (
                <button
                  type="button"
                  onClick={handleResetTemplateForm}
                  className="px-4 py-2 rounded-xl border text-sm font-medium transition hover:bg-[#b83838]/10 hover:border-[#b83838]/40 hover:text-[#ff6b6b]"
                  style={{ borderColor: "var(--badge-border)", color: "var(--neutral-text)", backgroundColor: "var(--neutral-bg)" }}
                >
                  🔄 Reset Form
                </button>
              ) : null}
              <button
                type="submit"
                disabled={!editTplName || !editTplBody || saving}
                className="px-4 py-2 rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] text-sm font-semibold shadow-md disabled:opacity-50"
              >
                {saving ? "Saving..." : editTplId ? "Save Changes" : "Add Template"}
              </button>
            </div>
          </form>
        </div>

        {/* Category Cards with Accordion Expansion & Horizontal Subcategory Navigation */}
        <div className="space-y-4">
          {(groupedAdminCategories || []).map((catGroup) => {
            const isExpanded = Boolean(expandedAdminCats[catGroup.categoryName]);
            const selectedSub = adminSubcatFilter[catGroup.categoryName] ?? "All";

            const filteredTemplates = catGroup.templates.filter((t) => {
              if (selectedSub === "All") return true;
              return (t.subcategory ?? "").trim() === selectedSub;
            });

            return (
              <div
                key={catGroup.categoryName}
                className="rounded-2xl border shadow-md backdrop-blur transition-all overflow-hidden"
                style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--field-bg)" }}
              >
                {/* Accordion Card Header */}
                <div
                  onClick={() =>
                    setExpandedAdminCats((prev) => ({
                      ...prev,
                      [catGroup.categoryName]: !isExpanded,
                    }))
                  }
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-[var(--neutral-bg)] transition select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center">
                      {catGroup.categoryType === "tech_escalation" ? (
                        <img src="/Lightning.png" alt="Tech Escalation" className="h-5 w-5 object-contain" />
                      ) : (
                        <img src="/chat.png" alt="Customer Reply" className="h-5 w-5 object-contain" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-base" style={{ color: "var(--app-text)" }}>
                          {catGroup.categoryName}
                        </h4>
                        <span className="text-[10px] rounded-full border px-2 py-0.5 font-semibold" style={{ borderColor: "var(--badge-border)", color: "var(--badge-text)" }}>
                          {catGroup.categoryType === "tech_escalation" ? "Tech Escalation" : "Customer Reply"}
                        </span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {catGroup.totalCount} template{catGroup.totalCount === 1 ? "" : "s"} • {catGroup.subcategories.length - 1} subcategor{catGroup.subcategories.length - 1 === 1 ? "y" : "ies"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full border" style={{ borderColor: "var(--badge-border)", color: "var(--badge-text)" }}>
                      {catGroup.totalCount}
                    </span>
                    <span className={`transform transition-transform duration-200 text-sm ${isExpanded ? "rotate-180" : ""}`}>
                      ▼
                    </span>
                  </div>
                </div>

                {/* Vertically Expandable Body */}
                {isExpanded ? (
                  <div className="p-4 border-t space-y-4" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}>
                    {/* Horizontal Subcategory Navigation Pills */}
                    {catGroup.subcategories.length > 1 ? (
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                          Subcategory Filter:
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                          {catGroup.subcategories.map((sub) => {
                            const isSubActive = selectedSub === sub;
                            return (
                              <button
                                key={sub}
                                type="button"
                                onClick={() =>
                                  setAdminSubcatFilter((prev) => ({
                                    ...prev,
                                    [catGroup.categoryName]: sub,
                                  }))
                                }
                                className={`rounded-xl border px-3 py-1 text-xs font-medium shrink-0 transition ${isSubActive
                                    ? "bg-[#4cd34c] text-[#071007] font-bold border-[#4cd34c] shadow-sm"
                                    : "hover:bg-[var(--neutral-bg)] text-[var(--neutral-text)]"
                                  }`}
                                style={{ borderColor: isSubActive ? "#4cd34c" : "var(--badge-border)" }}
                              >
                                {sub}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {/* Inner Templates List */}
                    <div className="space-y-3">
                      {filteredTemplates.length === 0 ? (
                        <p className="text-xs italic p-3 rounded-xl border text-center" style={{ borderColor: "var(--field-border)", color: "var(--text-muted)" }}>
                          No templates found under subcategory "{selectedSub}".
                        </p>
                      ) : (
                        filteredTemplates.map((t) => (
                          <div
                            key={t.id}
                            className="rounded-2xl border p-4 flex items-center justify-between transition hover:border-[#4cd34c]/50"
                            style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--field-bg)" }}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-base">{t.name}</span>
                                {t.subcategory ? (
                                  <span className="text-[10px] rounded-full border px-2 py-0.5 font-semibold" style={{ borderColor: "var(--badge-border)", color: "var(--badge-text)" }}>
                                    {t.subcategory}
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-xs mt-1 leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-muted)" }}>
                                {t.body}
                              </div>
                            </div>

                            <div className="flex gap-2 shrink-0 ml-4">
                              <button
                                onClick={() => {
                                  handleEditTemplateClick(t);
                                  scrollToTemplateForm();
                                  setTimeout(() => {
                                    if (templateBodyRef.current) {
                                      templateBodyRef.current.focus();
                                      adjustTextareaHeight(templateBodyRef.current);
                                    }
                                  }, 50);
                                }}
                                className="px-3 py-1.5 rounded-xl border text-xs font-semibold transition hover:bg-[var(--neutral-bg)]"
                                style={{ borderColor: "var(--badge-border)" }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteTemplate(t.id)}
                                className="px-3 py-1.5 rounded-xl border text-xs font-semibold transition hover:bg-[#b83838]/20"
                                style={{ borderColor: "var(--error-border)", color: "var(--error-text)" }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: AGENT PROFILE CONTROL MANAGEMENT */}
      <div className="rounded-3xl border p-6 shadow-[var(--panel-shadow)] backdrop-blur space-y-6" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}>
        <h3 className="text-lg font-bold" style={{ color: "var(--app-text)" }}>
          2. Agent Profile Control
        </h3>

        {/* Create/Edit Agent Form */}
        <form onSubmit={handleCreateOrUpdateAgent} className="rounded-2xl border p-4 space-y-3" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--field-bg)" }}>
          <h4 className="text-xs uppercase font-semibold" style={{ color: "var(--text-muted)" }}>
            {editAgentId ? `Edit Agent Profile #${editAgentId}` : "Add New Agent Profile"}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] block mb-1" style={{ color: "var(--text-muted)" }}>Agent Full Name (Agent):</label>
              <input
                value={editAgentFullName}
                onChange={(e) => setEditAgentFullName(e.target.value)}
                placeholder="e.g. Vuyolwenkosi Ndlovu"
                className="w-full rounded-xl border p-2.5 text-sm"
                style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
              />
            </div>
            <div>
              <label className="text-[11px] block mb-1" style={{ color: "var(--text-muted)" }}>Display Name (Agent Name):</label>
              <input
                value={editAgentName}
                onChange={(e) => setEditAgentName(e.target.value)}
                placeholder="e.g. Vuyo"
                className="w-full rounded-xl border p-2.5 text-sm"
                style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
              />
            </div>
            <div>
              <label className="text-[11px] block mb-1 flex justify-between" style={{ color: "var(--text-muted)" }}>
                <span>Agent Initials:</span>
                <span className="text-[10px] text-[#4cd34c]">Auto-generated</span>
              </label>
              <input
                value={editAgentInitials}
                onChange={(e) => {
                  setEditAgentInitials(e.target.value);
                  setUserCustomizedInitials(true);
                }}
                placeholder="e.g. VN"
                className="w-full rounded-xl border p-2.5 text-sm uppercase font-semibold"
                maxLength={4}
                style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
              />
            </div>
            <div className="md:col-span-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer p-1">
                <input
                  type="checkbox"
                  checked={editAgentIsAdmin}
                  onChange={(e) => setEditAgentIsAdmin(e.target.checked)}
                  className="rounded accent-[#4cd34c] h-4 w-4"
                />
                <span>Grant System Admin Privileges</span>
              </label>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            {(editAgentId || editAgentFullName || editAgentName || editAgentInitials) ? (
              <button
                type="button"
                onClick={handleResetAgentForm}
                className="px-4 py-2 rounded-xl border text-sm font-medium transition hover:bg-[#b83838]/10 hover:border-[#b83838]/40 hover:text-[#ff6b6b]"
                style={{ borderColor: "var(--badge-border)", color: "var(--neutral-text)", backgroundColor: "var(--neutral-bg)" }}
              >
                🔄 Reset Form
              </button>
            ) : null}
            <button
              type="submit"
              disabled={!editAgentName || !editAgentInitials || saving}
              className="px-4 py-2 rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] text-sm font-semibold shadow-md disabled:opacity-50"
            >
              {saving ? "Saving..." : editAgentId ? "Save Agent Changes" : "Create Agent Profile"}
            </button>
          </div>
        </form>

        {/* Agent List */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(agents || []).map((agent) => (
            <div key={agent.id} className="rounded-2xl border p-4 flex items-center justify-between" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--field-bg)" }}>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#32324a_0%,#11111e_100%)] text-sm font-bold text-[#4cd34c] border" style={{ borderColor: "var(--badge-border)" }}>
                  {agent.agent_initials}
                </div>
                <div>
                  <div className="font-bold text-sm">{agent.agent_name}</div>
                  {agent.agent && agent.agent !== agent.agent_name ? (
                    <div className="text-xs text-[var(--text-muted)]">{agent.agent}</div>
                  ) : null}
                  <div className="text-[11px] text-[#4cd34c] mt-0.5">{agent.is_admin ? "System Admin" : "Support Agent"}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEditAgentClick(agent)}
                  className="px-3 py-1.5 rounded-xl border text-xs font-semibold"
                  style={{ borderColor: "var(--badge-border)" }}
                >
                  Edit
                </button>
                {agent.agent_initials === "SA" || agent.agent_name === "Sys_Admin" ? (
                  <button
                    disabled
                    className="px-3 py-1.5 rounded-xl border text-xs font-semibold opacity-50 cursor-not-allowed text-[#4cd34c] border-[#4cd34c]/30 bg-[#4cd34c]/10"
                    title="System Admin profile cannot be deleted"
                  >
                    Protected 🛡️
                  </button>
                ) : (
                  <button
                    onClick={() => handleDeleteAgent(agent.id)}
                    className="px-3 py-1.5 rounded-xl border text-xs font-semibold"
                    style={{ borderColor: "var(--error-border)", color: "var(--error-text)" }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 3: SYSTEM ADMIN SECURITY & PIN MANAGEMENT */}
      <div className="rounded-3xl border p-6 shadow-[var(--panel-shadow)] backdrop-blur space-y-4" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold" style={{ color: "var(--app-text)" }}>
              3. System Admin Security & PIN Control
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Update the 4-digit security PIN required to sign in as System Admin.
            </p>
          </div>
          <span className="text-xs uppercase font-bold text-[#f1c84b] bg-[#f1c84b]/10 border border-[#f1c84b]/30 px-3 py-1 rounded-full flex items-center gap-1.5">
            <img src="/lock.png" alt="Lock" className="h-3.5 w-3.5 shrink-0 object-contain" />
            PIN Protection Active
          </span>
        </div>

        <form onSubmit={handleChangeAdminPin} className="rounded-2xl border p-4 space-y-4" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--field-bg)" }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-muted)" }}>Current 4-Digit PIN:</label>
              <input
                type="password"
                maxLength={4}
                value={adminCurrentPin}
                onChange={(e) => setAdminCurrentPin(e.target.value)}
                placeholder="••••"
                className="w-full rounded-xl border p-2.5 text-sm font-mono tracking-widest text-center"
                style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-muted)" }}>New 4-Digit PIN:</label>
              <input
                type="password"
                maxLength={4}
                value={adminNewPin}
                onChange={(e) => setAdminNewPin(e.target.value)}
                placeholder="Enter 4 digits"
                className="w-full rounded-xl border p-2.5 text-sm font-mono tracking-widest text-center"
                style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-muted)" }}>Confirm New PIN:</label>
              <input
                type="password"
                maxLength={4}
                value={adminConfirmPin}
                onChange={(e) => setAdminConfirmPin(e.target.value)}
                placeholder="Repeat 4 digits"
                className="w-full rounded-xl border p-2.5 text-sm font-mono tracking-widest text-center"
                style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
              />
            </div>
          </div>

          {pinSuccessMsg ? (
            <div className="rounded-xl border px-3 py-2 text-xs font-semibold text-[#4cd34c] border-[#4cd34c]/40 bg-[#4cd34c]/10">
              {pinSuccessMsg}
            </div>
          ) : null}

          {pinErrorMsg ? (
            <div className="rounded-xl border px-3 py-2 text-xs font-semibold" style={{ borderColor: "var(--error-border)", backgroundColor: "var(--error-bg)", color: "var(--error-text)" }}>
              {pinErrorMsg}
            </div>
          ) : null}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!adminCurrentPin || !adminNewPin || !adminConfirmPin || saving}
              className="px-5 py-2.5 rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] text-sm font-semibold shadow-md disabled:opacity-50 transition hover:opacity-90"
            >
              {saving ? "Updating..." : "Update System Admin PIN"}
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 4: PRESET TELECOM & SUPPORT PHRASES MANAGEMENT */}
      <div className="rounded-3xl border p-6 shadow-[var(--panel-shadow)] backdrop-blur space-y-6" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--app-text)" }}>
              <img src="/globe.png" alt="Globe" className="h-5 w-5 shrink-0 object-contain" />
              4. Preset Telecom & Support Phrases Control
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Configure quick preset phrases displayed on the English ⇄ Shona Translator screen.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetPresetDefaults}
            className="px-3 py-1.5 rounded-xl border text-xs font-semibold hover:opacity-90"
            style={{ borderColor: "var(--badge-border)", color: "var(--neutral-text)", backgroundColor: "var(--neutral-bg)" }}
          >
            Reset Default Presets 🔄
          </button>
        </div>

        {/* Add/Edit Preset Form */}
        <form onSubmit={handleSavePreset} className="rounded-2xl border p-4 space-y-4" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--field-bg)" }}>
          <h4 className="text-xs uppercase font-semibold text-[#4cd34c]">
            {editPresetIndex !== null ? `Edit Preset Phrase #${editPresetIndex + 1}` : "Add New Preset Phrase"}
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] block mb-1" style={{ color: "var(--text-muted)" }}>Badge / Label *:</label>
              <input
                value={presetLabel}
                onChange={(e) => setPresetLabel(e.target.value)}
                placeholder="e.g. Billing Query"
                className="w-full rounded-xl border p-2.5 text-sm font-medium"
                style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                required
              />
            </div>
            <div>
              <label className="text-[11px] block mb-1" style={{ color: "var(--text-muted)" }}>English Phrase *:</label>
              <input
                value={presetEn}
                onChange={(e) => setPresetEn(e.target.value)}
                placeholder="e.g. Please provide your invoice number."
                className="w-full rounded-xl border p-2.5 text-sm font-medium"
                style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                required
              />
            </div>
            <div>
              <label className="text-[11px] block mb-1" style={{ color: "var(--text-muted)" }}>Shona Translation *:</label>
              <input
                value={presetSn}
                onChange={(e) => setPresetSn(e.target.value)}
                placeholder="e.g. Ndapota ipai nhamba yenhoroondo yemubhadharo."
                className="w-full rounded-xl border p-2.5 text-sm font-medium"
                style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                required
              />
            </div>
            <div>
              <label className="text-[11px] block mb-1" style={{ color: "var(--text-muted)" }}>IsiNdebele Translation:</label>
              <input
                value={presetNd}
                onChange={(e) => setPresetNd(e.target.value)}
                placeholder="e.g. Cela unikeze inombolo yakho..."
                className="w-full rounded-xl border p-2.5 text-sm font-medium"
                style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            {(editPresetIndex !== null || presetLabel || presetEn || presetSn || presetNd) && (
              <button
                type="button"
                onClick={() => {
                  setEditPresetIndex(null);
                  setPresetLabel("");
                  setPresetEn("");
                  setPresetSn("");
                  setPresetNd("");
                }}
                className="px-4 py-2 rounded-xl border text-sm font-medium transition"
                style={{ borderColor: "var(--badge-border)", color: "var(--neutral-text)", backgroundColor: "var(--neutral-bg)" }}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={!presetLabel.trim() || !presetEn.trim() || !presetSn.trim()}
              className="px-5 py-2 rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] text-sm font-semibold shadow-md disabled:opacity-50"
            >
              {editPresetIndex !== null ? "Update Preset Phrase" : "Add Preset Phrase"}
            </button>
          </div>
        </form>

        {/* Existing Preset Phrases Cards */}
        <div className="space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wider block" style={{ color: "var(--text-muted)" }}>
            Active Preset Phrases ({presetList.length}):
          </label>
          <div className="grid grid-cols-1 gap-3">
            {presetList.map((preset, idx) => (
              <div
                key={idx}
                className="rounded-2xl border p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 transition"
                style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)" }}
              >
                <div className="space-y-1">
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full border border-[#4cd34c]/40 bg-[#4cd34c]/10 text-[#4cd34c] uppercase">
                    {preset.label}
                  </span>
                  <p className="text-xs font-semibold" style={{ color: "var(--app-text)" }}>
                    🇬🇧 <span className="opacity-90">{preset.en}</span>
                  </p>
                  <p className="text-xs font-semibold text-[#4cd34c]">
                    🇿🇼 (SN) <span>{preset.sn}</span>
                  </p>
                  {preset.nd && (
                    <p className="text-xs font-semibold text-[#4cd34c]">
                      🇿🇼 (ND) <span>{preset.nd}</span>
                    </p>
                  )}
                </div>

                <div className="flex gap-2 self-end md:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => handleEditPresetClick(preset, idx)}
                    className="px-3 py-1.5 rounded-xl border text-xs font-semibold transition hover:bg-[var(--neutral-bg)]"
                    style={{ borderColor: "var(--badge-border)" }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePreset(idx)}
                    className="px-3 py-1.5 rounded-xl border text-xs font-semibold transition hover:bg-[#b83838]/20"
                    style={{ borderColor: "var(--error-border)", color: "var(--error-text)" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
