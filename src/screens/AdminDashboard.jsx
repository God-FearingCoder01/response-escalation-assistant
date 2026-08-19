import { useRef, useEffect, useState, useMemo } from "react";
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
  placeholderConfigs = {},
  setPlaceholderConfigs,
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
  handleToggleAgentActive,
  adminCurrentPin,
  setAdminCurrentPin,
  adminNewPin,
  setAdminNewPin,
  adminConfirmPin,
  setAdminConfirmPin,
  pinSuccessMsg,
  setPinSuccessMsg,
  pinErrorMsg,
  setPinErrorMsg,
  handleChangeAdminPin,
  sirState,
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

  // SECTION 5: SIR SHIFT & ESCALATION TARGET CONTROL STATES
  const {
    shifts = [],
    escalationTargets = [],
    handleCreateShift = () => { },
    handleUpdateShift = () => { },
    handleDeleteShift = () => { },
    handleCreateTarget = () => { },
    handleDeleteTarget = () => { },
  } = sirState || {};

  const [shiftName, setShiftName] = useState("");
  const [shiftStart, setShiftStart] = useState("07:00");
  const [shiftEnd, setShiftEnd] = useState("15:00");
  const [editShiftId, setEditShiftId] = useState(null);

  const [newTargetName, setNewTargetName] = useState("");
  const [companyWeekStart, setCompanyWeekStart] = useState(() => localStorage.getItem("REA_COMPANY_WEEK_START") || "Monday");
  const [companyLogo, setCompanyLogo] = useState(() => localStorage.getItem("REA_COMPANY_LOGO") || "");

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      alert("Logo image file size must be smaller than 3MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64 = evt.target?.result || "";
      setCompanyLogo(base64);
      localStorage.setItem("REA_COMPANY_LOGO", base64);
      alert("Company logo uploaded successfully! It will now appear on your PDF management reports.");
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setCompanyLogo("");
    localStorage.removeItem("REA_COMPANY_LOGO");
  };

  const handleSaveShiftForm = async (e) => {
    e.preventDefault();
    if (!shiftName.trim()) return;

    if (editShiftId) {
      await handleUpdateShift(editShiftId, {
        name: shiftName.trim(),
        start_time: shiftStart,
        end_time: shiftEnd,
      });
    } else {
      await handleCreateShift({
        name: shiftName.trim(),
        start_time: shiftStart,
        end_time: shiftEnd,
        is_active: true,
      });
    }

    setEditShiftId(null);
    setShiftName("");
    setShiftStart("07:00");
    setShiftEnd("15:00");
  };

  const handleEditShiftClick = (s) => {
    setEditShiftId(s.id);
    setShiftName(s.name);
    setShiftStart(s.start_time || "07:00");
    setShiftEnd(s.end_time || "15:00");
  };

  const handleAddTargetSubmit = async (e) => {
    e.preventDefault();
    if (!newTargetName.trim()) return;
    await handleCreateTarget(newTargetName.trim());
    setNewTargetName("");
  };

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

  const extractedPlaceholders = useMemo(() => {
    if (!editTplBody) return [];
    const set = new Set();
    const re = /\{([^}]+)\}/g;
    let m;
    while ((m = re.exec(editTplBody))) set.add(m[1]);
    return Array.from(set);
  }, [editTplBody]);

  const updatePlaceholderConfig = (phKey, updates) => {
    setPlaceholderConfigs?.((prev) => {
      const current = prev[phKey] || { control_type: "text", auto_fill_type: "none" };
      return {
        ...prev,
        [phKey]: { ...current, ...updates },
      };
    });
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

              {/* Placeholder Configuration Section */}
              {extractedPlaceholders.length > 0 && (
                <div className="md:col-span-3 rounded-xl border p-4 space-y-3 mt-1 bg-[#4cd34c]/5 border-[#4cd34c]/30">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs uppercase font-bold text-[#4cd34c] flex items-center gap-1.5">
                      <span>⚙️ Configure Placeholder Controls & Auto-Fill</span>
                      <span className="text-[10px] font-medium text-[var(--text-muted)] lowercase font-mono">
                        ({extractedPlaceholders.length} detected: {extractedPlaceholders.map(p => `{${p}}`).join(", ")})
                      </span>
                    </h5>
                    <span className="text-[10px] text-[var(--text-muted)]">Customize UI capture type & default auto-fill source</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {extractedPlaceholders.map((ph) => {
                      const cfg = placeholderConfigs[ph] || { control_type: "text", auto_fill_type: "none" };
                      const isCombobox = cfg.control_type === "combobox";
                      const isCustomAuto = cfg.auto_fill_type === "custom";

                      return (
                        <div
                          key={ph}
                          className="rounded-xl border p-3 space-y-2 backdrop-blur bg-[var(--panel-bg)] border-[var(--field-border)]"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#4cd34c]">
                              {`{${ph}}`}
                            </span>
                            <span className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">
                              Parameter Control
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] block mb-1 font-medium text-[var(--text-muted)]">Control Type:</label>
                              <select
                                value={cfg.control_type || "text"}
                                onChange={(e) => updatePlaceholderConfig(ph, { control_type: e.target.value })}
                                className="w-full rounded-lg border p-1.5 text-xs font-semibold focus:outline-none focus:border-[#4cd34c]"
                                style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                              >
                                <option value="text">Single-Line Text Input</option>
                                <option value="textarea">Multi-Line Text Area</option>
                                <option value="number">Numeric Up/Down (Number)</option>
                                <option value="combobox">Select Combobox (Dropdown)</option>
                                <option value="date">Date Picker (Date Only)</option>
                                <option value="time">Time Picker (Time Only)</option>
                                <option value="datetime">Date / Time Picker (Combined)</option>
                              </select>
                            </div>

                            <div>
                              <label className="text-[10px] block mb-1 font-medium text-[var(--text-muted)]">Auto-Fill Source:</label>
                              <select
                                value={cfg.auto_fill_type || "none"}
                                onChange={(e) => updatePlaceholderConfig(ph, { auto_fill_type: e.target.value })}
                                className="w-full rounded-lg border p-1.5 text-xs font-semibold focus:outline-none focus:border-[#4cd34c]"
                                style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                              >
                                <option value="none">None (Manual Entry)</option>
                                <option value="agent_name">Agent Display Name (e.g. Sys_Admin, Chris)</option>
                                <option value="agent_fullname">Agent Full Name (e.g. System Administrator, Chris Whyt)</option>
                                <option value="agent_initials">Agent Initials (e.g. SA, CW)</option>
                                <option value="greeting">Clock Greeting (morning / afternoon / evening)</option>
                                <option value="Greeting">Capitalized Greeting (Morning / Afternoon / Evening)</option>
                                <option value="good_greeting">Full Greeting (Good morning / afternoon / evening)</option>
                                <option value="date_day">System Day (DD)</option>
                                <option value="date_month">System Month (MM)</option>
                                <option value="date_year">System Year (YYYY)</option>
                                <option value="date_time">System Time (HH:mm)</option>
                                <option value="custom">Custom Default Value</option>
                              </select>
                            </div>
                          </div>

                          {/* Date/Time Format Configurator */}
                          {(cfg.control_type === "date" || cfg.control_type === "time" || cfg.control_type === "datetime") && (() => {
                            const presetFormats = ["default", "DD/MM/YYYY", "DD.MM.YYYY", "DD/MM/YYYY HH:mm", "YYYY/MM/DD", "YYYY-MM-DD", "HHmm"];
                            const isCustomFormat = cfg.date_format_mode === "custom" || cfg.is_custom_date_format || (cfg.date_format && !presetFormats.includes(cfg.date_format));

                            return (
                              <div>
                                <label className="text-[10px] block mb-1 font-bold text-[#4cd34c]">
                                  Output Date/Time Format *
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  <select
                                    value={isCustomFormat ? "custom" : (cfg.date_format || "default")}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === "custom") {
                                        updatePlaceholderConfig(ph, {
                                          date_format_mode: "custom",
                                          is_custom_date_format: true,
                                          date_format: cfg.custom_date_format || "DD.MM.YYYY",
                                        });
                                      } else {
                                        updatePlaceholderConfig(ph, {
                                          date_format_mode: "preset",
                                          is_custom_date_format: false,
                                          date_format: val,
                                        });
                                      }
                                    }}
                                    className="w-full rounded-lg border p-1.5 text-xs font-semibold focus:outline-none focus:border-[#4cd34c]"
                                    style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                                  >
                                    <option value="default">Default DD/MM/YYYY (18/08/2026)</option>
                                    <option value="DD/MM/YYYY">DD/MM/YYYY (18/08/2026)</option>
                                    <option value="DD.MM.YYYY">DD.MM.YYYY (18.08.2026)</option>
                                    <option value="DD/MM/YYYY HH:mm">DD/MM/YYYY HH:mm (18/08/2026 07:29)</option>
                                    <option value="YYYY/MM/DD">YYYY/MM/DD (2026/08/18)</option>
                                    <option value="YYYY-MM-DD">YYYY-MM-DD (2026-08-18)</option>
                                    <option value="HHmm">HHMM (0729 - No Colon)</option>
                                    <option value="custom">Custom Format Pattern...</option>
                                  </select>

                                  {isCustomFormat && (
                                    <input
                                      type="text"
                                      value={cfg.custom_date_format !== undefined ? cfg.custom_date_format : (cfg.date_format || "")}
                                      onChange={(e) => {
                                        const newCustom = e.target.value;
                                        updatePlaceholderConfig(ph, {
                                          date_format_mode: "custom",
                                          is_custom_date_format: true,
                                          custom_date_format: newCustom,
                                          date_format: newCustom,
                                        });
                                      }}
                                      placeholder="e.g. DD.MM.YYYY"
                                      className="w-full rounded-lg border p-1.5 text-xs font-mono font-semibold focus:outline-none focus:border-[#4cd34c]"
                                      style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                                    />
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Target token notice if starting with : */}
                          {ph.startsWith(":") && (
                            <div className="rounded-xl border p-2.5 text-xs bg-[#4cd34c]/10 border-[#4cd34c]/30 text-[#4cd34c] font-semibold space-y-1">
                              <div className="flex items-center gap-1.5 font-bold">
                                <span>⚡ Mapped Target Placeholder: {ph}</span>
                              </div>
                              <p className="text-[11px] opacity-90 font-normal">
                                This placeholder is automatically populated at runtime based on the Company Admin predefined mapping for the trigger placeholder. Support agents will not be required to enter this value manually.
                              </p>
                            </div>
                          )}

                          {/* Combobox & Conditional Mapping Configurator */}
                          {isCombobox && (
                            <div className="space-y-3">
                              <div>
                                <label className="text-[10px] block mb-1 font-bold text-[#4cd34c]">
                                  {ph.endsWith("?") ? "1-to-1 Mapped Target Token Name *" : "Mapped Target Token Name (Optional - Only if mapping to another token)"}
                                </label>
                                <input
                                  type="text"
                                  value={cfg.mapped_target !== undefined ? cfg.mapped_target : (ph.endsWith("?") ? `:${ph.replace(/\?$/, "")}` : "")}
                                  onChange={(e) => updatePlaceholderConfig(ph, { mapped_target: e.target.value })}
                                  placeholder={ph.endsWith("?") ? "e.g. :game" : "Leave blank for standalone dropdown (e.g. :game)"}
                                  className="w-full rounded-lg border p-1.5 text-xs font-mono font-semibold focus:outline-none focus:border-[#4cd34c]"
                                  style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                                />
                              </div>

                              {ph.endsWith("?") || (Boolean(cfg.mapped_target) && cfg.mapped_target.trim() !== "") ? (
                                <div>
                                  <label className="text-[10px] block mb-1 font-bold text-[#4cd34c] flex justify-between">
                                    <span>1-to-1 Conditional Value Pairings (Trigger ➔ Mapped Target) *</span>
                                    <span className="text-[9px] opacity-80 text-[var(--text-muted)] font-normal">Format: Trigger Option {"=>"} Mapped Target Value</span>
                                  </label>
                                  <textarea
                                    rows={4}
                                    value={
                                      cfg.mapping_raw !== undefined
                                        ? cfg.mapping_raw
                                        : (cfg.mapping
                                          ? Object.entries(cfg.mapping).map(([k, v]) => `${k} => ${v}`).join("\n")
                                          : (Array.isArray(cfg.options) ? cfg.options.join(", ") : ""))
                                    }
                                    onChange={(e) => {
                                      const rawVal = e.target.value;
                                      const lines = rawVal.split("\n").map((l) => l.trim()).filter(Boolean);
                                      const options = [];
                                      const mapping = {};

                                      lines.forEach((line) => {
                                        if (line.includes("=>") || line.includes(":") || line.includes("->")) {
                                          const parts = line.split(/=>|:|-/);
                                          const k = parts[0]?.trim();
                                          const v = parts.slice(1).join("=>").replace(/^>/, "").trim();
                                          if (k) {
                                            options.push(k);
                                            if (v) mapping[k] = v;
                                          }
                                        } else if (line.includes(",")) {
                                          line.split(",").forEach((item) => {
                                            const cleaned = item.trim();
                                            if (cleaned) options.push(cleaned);
                                          });
                                        } else {
                                          options.push(line);
                                        }
                                      });

                                      updatePlaceholderConfig(ph, {
                                        mapping_raw: rawVal,
                                        options_raw: options.join(", "),
                                        options,
                                        mapping,
                                      });
                                    }}
                                    placeholder={"e.g.\nElephant => Big Game Slot\nRhino => Stampede Slot\nLion => King Jungle Slot\nBuffalo => Buffalo Gold\nLeopard => Leopard Riches"}
                                    className="w-full rounded-lg border p-2 text-xs font-mono leading-relaxed focus:outline-none focus:border-[#4cd34c]"
                                    style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                                  />
                                  {cfg.mapping && Object.keys(cfg.mapping).length > 0 ? (
                                    <div className="text-[10px] text-[#4cd34c] font-semibold mt-1">
                                      ✓ {Object.keys(cfg.mapping).length} conditional pair(s) configured ({Object.entries(cfg.mapping).map(([k,v])=>`${k}➔"${v}"`).slice(0, 3).join(", ")}{Object.keys(cfg.mapping).length > 3 ? "..." : ""})
                                    </div>
                                  ) : null}
                                </div>
                              ) : (
                                <div>
                                  <label className="text-[10px] block mb-1 font-bold text-[#4cd34c]">
                                    Predefined Options (Comma Separated) *
                                  </label>
                                  <input
                                    type="text"
                                    value={cfg.options_raw !== undefined ? cfg.options_raw : (Array.isArray(cfg.options) ? cfg.options.join(", ") : "")}
                                    onChange={(e) => {
                                      const rawVal = e.target.value;
                                      const parsedArr = rawVal
                                        .split(",")
                                        .map((s) => s.trim())
                                        .filter(Boolean);
                                      updatePlaceholderConfig(ph, {
                                        options_raw: rawVal,
                                        options: parsedArr,
                                      });
                                    }}
                                    placeholder="e.g. EcoCash, Zipit, InnBucks, Bank Transfer"
                                    className="w-full rounded-lg border p-1.5 text-xs focus:outline-none focus:border-[#4cd34c]"
                                    style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          {/* Custom Default Input */}
                          {isCustomAuto && (
                            <div>
                              <label className="text-[10px] block mb-1 font-bold text-[#4cd34c]">
                                Custom Default Value
                              </label>
                              <input
                                type="text"
                                value={cfg.custom_default || ""}
                                onChange={(e) => updatePlaceholderConfig(ph, { custom_default: e.target.value })}
                                placeholder="Enter default fallback value..."
                                className="w-full rounded-lg border p-1.5 text-xs focus:outline-none focus:border-[#4cd34c]"
                                style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              {(editTplId || editTplName || editTplBody || editTplCat || editTplSubcat) ? (
                <button
                  type="button"
                  onClick={handleResetTemplateForm}
                  className="px-4 py-2 rounded-xl border text-sm font-medium transition hover:bg-[#b83838]/10 hover:border-[#b83838]/40 hover:text-[#ff6b6b] flex items-center gap-1.5"
                  style={{ borderColor: "var(--badge-border)", color: "var(--neutral-text)", backgroundColor: "var(--neutral-bg)" }}
                >
                  <img src="/refresh.png" alt="Reset" className="h-3.5 w-3.5 object-contain shrink-0" />
                  Reset Form
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
                className="px-4 py-2 rounded-xl border text-sm font-medium transition hover:bg-[#b83838]/10 hover:border-[#b83838]/40 hover:text-[#ff6b6b] flex items-center gap-1.5"
                style={{ borderColor: "var(--badge-border)", color: "var(--neutral-text)", backgroundColor: "var(--neutral-bg)" }}
              >
                <img src="/refresh.png" alt="Reset" className="h-3.5 w-3.5 object-contain shrink-0" />
                Reset Form
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
                  <div className="font-bold text-sm flex items-center gap-1.5">
                    <span>{agent.agent_name}</span>
                    {agent.is_active === false ? (
                      <span className="text-[10px] font-extrabold text-[#ff6b6b] bg-[#ff6b6b]/10 border border-[#ff6b6b]/30 px-2 py-0.5 rounded-full">
                        Deactivated
                      </span>
                    ) : (
                      <span className="text-[10px] font-extrabold text-[#4cd34c] bg-[#4cd34c]/10 border border-[#4cd34c]/30 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                  {agent.agent && agent.agent !== agent.agent_name ? (
                    <div className="text-xs text-[var(--text-muted)]">{agent.agent}</div>
                  ) : null}
                  <div className="text-[11px] text-[#4cd34c] mt-0.5">{agent.is_admin ? "System Admin" : "Support Agent"}</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleEditAgentClick(agent)}
                  className="px-2.5 py-1.5 rounded-xl border text-xs font-semibold"
                  style={{ borderColor: "var(--badge-border)" }}
                >
                  Edit
                </button>
                {agent.agent_initials === "SA" || agent.agent_name === "Sys_Admin" ? (
                  <button
                    disabled
                    className="px-2.5 py-1.5 rounded-xl border text-xs font-semibold opacity-50 cursor-not-allowed text-[#4cd34c] border-[#4cd34c]/30 bg-[#4cd34c]/10"
                    title="System Admin profile cannot be deactivated or deleted"
                  >
                    Protected 🛡️
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => handleToggleAgentActive && handleToggleAgentActive(agent.id)}
                      className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition ${
                        agent.is_active === false
                          ? "border-[#4cd34c]/40 text-[#4cd34c] hover:bg-[#4cd34c]/10"
                          : "border-[#f1c84b]/40 text-[#f1c84b] hover:bg-[#f1c84b]/10"
                      }`}
                      title={agent.is_active === false ? "Click to reactivate agent profile" : "Deactivate agent (removes from Welcome screen)"}
                    >
                      {agent.is_active === false ? "Activate" : "Deactivate"}
                    </button>
                    <button
                      onClick={() => handleDeleteAgent(agent.id)}
                      className="px-2.5 py-1.5 rounded-xl border text-xs font-semibold"
                      style={{ borderColor: "var(--error-border)", color: "var(--error-text)" }}
                    >
                      Delete
                    </button>
                  </>
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
            <div className="flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-semibold text-[#4cd34c] border-[#4cd34c]/40 bg-[#4cd34c]/10">
              <span>{pinSuccessMsg}</span>
              <button
                type="button"
                onClick={() => setPinSuccessMsg?.("")}
                className="ml-2 font-bold opacity-70 hover:opacity-100 transition"
                title="Dismiss message"
              >
                ✕
              </button>
            </div>
          ) : null}

          {pinErrorMsg ? (
            <div
              className="flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-semibold"
              style={{ borderColor: "var(--error-border)", backgroundColor: "var(--error-bg)", color: "var(--error-text)" }}
            >
              <span>{pinErrorMsg}</span>
              <button
                type="button"
                onClick={() => setPinErrorMsg?.("")}
                className="ml-2 font-bold opacity-70 hover:opacity-100 transition"
                title="Dismiss error"
              >
                ✕
              </button>
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

      {/* SECTION 4: PRESET CUSTOMER SUPPORT PHRASES MANAGEMENT */}
      <div className="rounded-3xl border p-6 shadow-[var(--panel-shadow)] backdrop-blur space-y-6" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--app-text)" }}>
              <img src="/globe.png" alt="Globe" className="h-5 w-5 shrink-0 object-contain" />
              4. Preset Customer Support Phrases Control
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Configure quick preset phrases displayed on the English ⇄ Shona / Ndebele Translation Center.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetPresetDefaults}
            className="px-3 py-1.5 rounded-xl border text-xs font-semibold hover:opacity-90 flex items-center gap-1.5 transition"
            style={{ borderColor: "var(--badge-border)", color: "var(--neutral-text)", backgroundColor: "var(--neutral-bg)" }}
          >
            <img src="/refresh.png" alt="Refresh" className="h-3.5 w-3.5 object-contain shrink-0" />
            Reset Default Presets
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
                placeholder="e.g. Request Account no."
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
                placeholder="e.g. Please provide your registered account number."
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

      {/* SECTION 5: SHIFT ISSUE REGISTER (SIR) CONTROL */}
      <div
        className="rounded-3xl border p-6 shadow-[var(--panel-shadow)] backdrop-blur space-y-8"
        style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}
      >
        <div className="border-b pb-4" style={{ borderColor: "var(--panel-border)" }}>
          <h3 className="text-lg font-bold flex items-center gap-2.5" style={{ color: "var(--app-text)" }}>
            <img src="/clipboard.png" alt="Register" className="h-6 w-6 shrink-0 object-contain" />
            5. Shift Issue Register (SIR) Company Control
          </h3>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Define custom shift hours (including overnight shifts) and predefine escalation target options for support agents.
          </p>
        </div>

        {/* SUBSECTION A: SHIFT DEFINITIONS */}
        <div className="space-y-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-[#4cd34c]">
            A. Shift Hours & Naming Control ({shifts.length})
          </h4>

          <form onSubmit={handleSaveShiftForm} className="rounded-2xl border p-4 space-y-4" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--field-bg)" }}>
            <span className="text-xs uppercase font-semibold text-sky-400 block">
              {editShiftId ? `Edit Shift Definition #${editShiftId}` : "Create New Shift Definition"}
            </span>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] block mb-1 font-bold" style={{ color: "var(--text-muted)" }}>
                  Shift Name *
                </label>
                <input
                  type="text"
                  required
                  value={shiftName}
                  onChange={(e) => setShiftName(e.target.value)}
                  placeholder="e.g. Graveyard Night Shift"
                  className="w-full rounded-xl border p-2.5 text-sm font-medium"
                  style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                />
              </div>

              <div>
                <label className="text-[11px] block mb-1 font-bold" style={{ color: "var(--text-muted)" }}>
                  Start Time *
                </label>
                <input
                  type="time"
                  required
                  value={shiftStart}
                  onChange={(e) => setShiftStart(e.target.value)}
                  className="w-full rounded-xl border p-2.5 text-sm font-medium"
                  style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                />
              </div>

              <div>
                <label className="text-[11px] block mb-1 font-bold" style={{ color: "var(--text-muted)" }}>
                  End Time (Supports Overnight) *
                </label>
                <input
                  type="time"
                  required
                  value={shiftEnd}
                  onChange={(e) => setShiftEnd(e.target.value)}
                  className="w-full rounded-xl border p-2.5 text-sm font-medium"
                  style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              {editShiftId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditShiftId(null);
                    setShiftName("");
                    setShiftStart("07:00");
                    setShiftEnd("15:00");
                  }}
                  className="px-4 py-2 rounded-xl border text-xs font-semibold hover:opacity-80"
                  style={{ borderColor: "var(--badge-border)" }}
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={!shiftName.trim()}
                className="px-5 py-2 rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] text-xs font-bold shadow-md disabled:opacity-50"
              >
                {editShiftId ? "Update Shift" : "Add Shift Definition"}
              </button>
            </div>
          </form>

          {/* Active Shift List */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {shifts.map((s) => (
              <div
                key={s.id}
                className="rounded-2xl border p-4 flex flex-col justify-between gap-3 shadow-sm"
                style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)" }}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <strong className="text-sm" style={{ color: "var(--app-text)" }}>
                      {s.name}
                    </strong>
                    <span className="text-[10px] uppercase font-bold text-[#4cd34c] bg-[#4cd34c]/10 border border-[#4cd34c]/30 px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  </div>
                  <p className="text-xs mt-1 font-mono font-medium" style={{ color: "var(--text-muted)" }}>
                    ⏰ {s.start_time} ➔ {s.end_time}
                  </p>
                </div>

                <div className="flex gap-2 justify-end pt-2 border-t" style={{ borderColor: "var(--panel-border)" }}>
                  <button
                    type="button"
                    onClick={() => handleEditShiftClick(s)}
                    className="px-3 py-1 rounded-xl border text-xs font-semibold hover:opacity-80"
                    style={{ borderColor: "var(--badge-border)" }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteShift(s.id)}
                    className="px-3 py-1 rounded-xl border text-xs font-semibold hover:bg-[#ff6b6b]/20"
                    style={{ borderColor: "var(--error-border)", color: "var(--error-text)" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SUBSECTION B: ESCALATION TARGETS */}
        <div className="space-y-4 pt-4 border-t" style={{ borderColor: "var(--panel-border)" }}>
          <h4 className="text-sm font-bold uppercase tracking-wider text-[#4cd34c]">
            B. Predefined Escalation Targets Control ({escalationTargets.length})
          </h4>

          <form onSubmit={handleAddTargetSubmit} className="flex gap-3 items-center">
            <input
              type="text"
              required
              value={newTargetName}
              onChange={(e) => setNewTargetName(e.target.value)}
              placeholder="e.g. Technical Team / Risk Team"
              className="flex-1 rounded-xl border p-2.5 text-sm font-medium"
              style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
            />
            <button
              type="submit"
              disabled={!newTargetName.trim()}
              className="px-5 py-2.5 rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] text-xs font-bold shadow-md disabled:opacity-50 whitespace-nowrap"
            >
              + Add Escalation Target
            </button>
          </form>

          <div className="flex flex-wrap gap-2.5">
            {escalationTargets.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2 rounded-2xl border px-3.5 py-1.5 text-xs font-semibold shadow-sm"
                style={{ borderColor: "var(--badge-border)", backgroundColor: "var(--field-bg)" }}
              >
                <span style={{ color: "var(--app-text)" }}>{t.name}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteTarget(t.id)}
                  className="ml-1 text-xs font-bold text-[#ff6b6b] hover:opacity-100 opacity-70"
                  title="Remove target"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 6: ORGANIZATION REPORTING SETTINGS (REPORTING WEEK START) */}
        <div className="rounded-3xl border p-6 shadow-md backdrop-blur space-y-4" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}>
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--field-border)" }}>
            <div>
              <h3 className="text-[#4cd34c] text-[11px] font-extrabold uppercase tracking-wider">
                Section 6 · Organization Reporting Settings
              </h3>
              <p className="text-[13px] font-bold mt-0.5" style={{ color: "var(--app-text)" }}>
                Configure Company SIR Reporting Period & Week Cycle
              </p>
            </div>
            <span className="text-xs font-bold text-[#4cd34c] bg-[#4cd34c]/10 border border-[#4cd34c]/30 px-2.5 py-1 rounded-full">
              Organization Setting
            </span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              localStorage.setItem("REA_COMPANY_WEEK_START", companyWeekStart);
              alert(`Saved Reporting Week Start day: ${companyWeekStart}`);
            }}
            className="space-y-5"
          >
            {/* COMPANY LOGO BRANDING UPLOAD */}
            <div className="p-4 rounded-2xl border space-y-3" style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)" }}>
              <label className="text-xs font-bold block text-[#4cd34c]">
                Company Branding Logo (PNG / JPEG)
              </label>

              {companyLogo ? (
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-xl border bg-white/5 shrink-0" style={{ borderColor: "var(--field-border)" }}>
                    <img src={companyLogo} alt="Company Logo" className="h-12 w-auto max-w-[140px] object-contain" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-[#4cd34c] block">✓ Logo active on PDF exports</span>
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="px-3 py-1 rounded-lg border text-[11px] font-bold text-red-400 hover:bg-red-500/10 transition"
                      style={{ borderColor: "var(--field-border)" }}
                    >
                      Remove Logo
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="block w-full text-xs text-[var(--text-muted)] file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#4cd34c]/20 file:text-[#4cd34c] hover:file:bg-[#4cd34c]/30 cursor-pointer"
                  />
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Upload your official organization logo to automatically brand generated SIR Management PDF Reports.
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-bold block mb-1" style={{ color: "var(--text-muted)" }}>
                Reporting Week Starts On *
              </label>
              <select
                value={companyWeekStart}
                onChange={(e) => setCompanyWeekStart(e.target.value)}
                className="w-full md:w-64 rounded-xl border p-2.5 text-xs font-bold focus:outline-none focus:border-[#4cd34c]"
                style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
              >
                <option value="Monday">Monday (Mon ➔ Sun)</option>
                <option value="Sunday">Sunday (Sun ➔ Sat)</option>
                <option value="Saturday">Saturday (Sat ➔ Fri)</option>
                <option value="Friday">Friday (Fri ➔ Thu)</option>
                <option value="Thursday">Thursday (Thu ➔ Wed)</option>
                <option value="Wednesday">Wednesday (Wed ➔ Tue)</option>
                <option value="Tuesday">Tuesday (Tue ➔ Mon)</option>
              </select>
              <p className="text-[11px] mt-1.5 font-medium" style={{ color: "var(--text-muted)" }}>
                Defines your organization's standard operational weekly reporting cycle for SIR exports & executive dashboards.
              </p>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] text-xs font-bold shadow-md transition hover:scale-105"
              >
                Save Reporting Settings
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
