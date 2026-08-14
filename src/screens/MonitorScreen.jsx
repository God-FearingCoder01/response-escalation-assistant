import { useState } from "react";
import { resetCompanyAdminPinApi, updateSuperAdminSettingsApi } from "../services/api";

export default function MonitorScreen({
  activeScreen,
  currentAgent,
  companies = [],
  activeCompanyId,
  switchCompany,
  handleCreateCompany,
  handleUpdateCompany,
  handleNavigate,
  superAdminEmail = "gfc.dev@proton.me",
  themeMode,
  setThemeMode,
  showToast = () => {},
}) {
  const siteOrigin = typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [newOrgIsActive, setNewOrgIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState("");

  const [editCompany, setEditCompany] = useState(null);
  const [editOrgName, setEditOrgName] = useState("");
  const [editOrgSlug, setEditOrgSlug] = useState("");
  const [editOrgIsActive, setEditOrgIsActive] = useState(true);
  const [editError, setEditError] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Reset Company Admin PIN Modal State
  const [resetPinCompany, setResetPinCompany] = useState(null);
  const [companyNewPin, setCompanyNewPin] = useState("");
  const [resetPinError, setResetPinError] = useState("");
  const [isResettingPin, setIsResettingPin] = useState(false);

  // Super Admin Settings Modal State
  const [showSaSettings, setShowSaSettings] = useState(false);
  const [saCurrentPin, setSaCurrentPin] = useState("");
  const [saNewEmail, setSaNewEmail] = useState("");
  const [saNewPin, setSaNewPin] = useState("");
  const [saSettingsError, setSaSettingsError] = useState("");
  const [isSavingSaSettings, setIsSavingSaSettings] = useState(false);

  if (activeScreen !== "monitor") return null;

  // Auto slug generator helper
  const generateSlug = (text) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const handleNameChange = (e) => {
    const val = e.target.value;
    setNewOrgName(val);
    if (!newOrgSlug || newOrgSlug === generateSlug(newOrgName)) {
      setNewOrgSlug(generateSlug(val));
    }
  };

  const onSubmitCreate = async (e) => {
    e.preventDefault();
    if (!newOrgName.trim()) {
      setCreateError("Organization name is required.");
      return;
    }
    const finalSlug = (newOrgSlug.trim() || generateSlug(newOrgName)).toLowerCase();
    if (!finalSlug) {
      setCreateError("Valid slug is required.");
      return;
    }

    setCreateError("");
    setIsSubmitting(true);
    try {
      await handleCreateCompany({
        name: newOrgName.trim(),
        slug: finalSlug,
        is_active: newOrgIsActive,
      });
      setNewOrgName("");
      setNewOrgSlug("");
      setNewOrgIsActive(true);
      setShowCreateModal(false);
      showToast?.(`Organization '${newOrgName}' created successfully!`);
    } catch (err) {
      setCreateError(err.message || "Failed to create organization");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (comp) => {
    setEditCompany(comp);
    setEditOrgName(comp.name);
    setEditOrgSlug(comp.slug);
    setEditOrgIsActive(comp.is_active !== false);
    setEditError("");
  };

  const onSubmitEdit = async (e) => {
    e.preventDefault();
    if (!editCompany) return;
    if (!editOrgName.trim()) {
      setEditError("Organization name is required.");
      return;
    }
    const finalSlug = (editOrgSlug.trim() || generateSlug(editOrgName)).toLowerCase();

    setEditError("");
    setIsEditing(true);
    try {
      await handleUpdateCompany(editCompany.id, {
        name: editOrgName.trim(),
        slug: finalSlug,
        is_active: editOrgIsActive,
      });
      setEditCompany(null);
      showToast?.(`Organization '${editOrgName}' updated successfully!`);
    } catch (err) {
      setEditError(err.message || "Failed to update organization");
    } finally {
      setIsEditing(false);
    }
  };

  const handleOpenResetPin = (comp) => {
    setResetPinCompany(comp);
    setCompanyNewPin("");
    setResetPinError("");
  };

  const onSubmitResetCompanyAdminPin = async (e) => {
    e.preventDefault();
    if (!resetPinCompany) return;
    if (companyNewPin.length !== 4 || !/^\d{4}$/.test(companyNewPin)) {
      setResetPinError("PIN must be exactly 4 digits.");
      return;
    }

    setResetPinError("");
    setIsResettingPin(true);
    try {
      const res = await resetCompanyAdminPinApi(resetPinCompany.id, null, companyNewPin);
      showToast?.(res.message || `Reset Admin PIN for ${resetPinCompany.name}`);
      setResetPinCompany(null);
    } catch (err) {
      setResetPinError(err.message || "Failed to reset Company Admin PIN");
    } finally {
      setIsResettingPin(false);
    }
  };

  const handleOpenSaSettings = () => {
    setShowSaSettings(true);
    setSaCurrentPin("");
    setSaNewEmail(superAdminEmail || "");
    setSaNewPin("");
    setSaSettingsError("");
  };

  const onSubmitSaSettings = async (e) => {
    e.preventDefault();
    if (!saCurrentPin) {
      setSaSettingsError("Current Super Admin PIN is required.");
      return;
    }

    setSaSettingsError("");
    setIsSavingSaSettings(true);
    try {
      await updateSuperAdminSettingsApi({
        current_pin: saCurrentPin,
        email: saNewEmail.trim() || undefined,
        pin: saNewPin.trim() || undefined,
      });
      showToast?.("Super Admin credentials updated successfully!");
      setShowSaSettings(false);
    } catch (err) {
      setSaSettingsError(err.message || "Failed to update Super Admin settings");
    } finally {
      setIsSavingSaSettings(false);
    }
  };

  const activeCount = companies.filter((c) => c.is_active !== false).length;
  const currentCompany = companies.find((c) => c.id === activeCompanyId) || companies[0];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* HEADER BANNER */}
      <div
        className="rounded-3xl border p-6 md:p-8 shadow-2xl relative overflow-hidden backdrop-blur"
        style={{
          borderColor: "var(--panel-border)",
          backgroundColor: "var(--panel-bg)",
        }}
      >
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 rounded-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#4cd34c]/20 via-transparent to-transparent pointer-events-none blur-2xl" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div>
            <div
              className="mb-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider"
              style={{
                borderColor: "var(--badge-border)",
                backgroundColor: "var(--badge-bg)",
                color: "#4cd34c",
              }}
            >
              <span>🏢</span> ORGANIZATION MONITOR & MANAGEMENT
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl" style={{ color: "var(--app-text)" }}>
              Organization Hub
            </h2>
            <p className="mt-2 text-sm max-w-2xl" style={{ color: "var(--header-muted)" }}>
              Manage multi-tenant organizations, configure slug endpoints (e.g. <code className="text-[#4cd34c] bg-black/30 px-2 py-0.5 rounded font-mono">/winbucks</code>), monitor health metrics, and launch dedicated assistant environments.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {setThemeMode && (
              <button
                onClick={() => setThemeMode((c) => (c === "night" ? "day" : "night"))}
                className="flex items-center gap-2 rounded-2xl border px-3.5 py-3 font-semibold transition hover:bg-[var(--neutral-bg)] cursor-pointer"
                style={{ borderColor: "var(--badge-border)", color: "var(--app-text)" }}
                title={`Switch to ${themeMode === "night" ? "Day" : "Night"} mode`}
              >
                <img
                  src={themeMode === "night" ? "/moon.png" : "/sun.png"}
                  alt={themeMode === "night" ? "Night Mode" : "Day Mode"}
                  className="h-4 w-4 shrink-0 object-contain"
                />
                <span>{themeMode === "night" ? "Night Mode" : "Day Mode"}</span>
              </button>
            )}

            <button
              onClick={() => handleNavigate?.("root")}
              className="flex items-center gap-2 rounded-2xl border px-4 py-3 font-semibold transition hover:bg-[var(--neutral-bg)] active:scale-95 cursor-pointer"
              style={{ borderColor: "var(--panel-border)", color: "var(--app-text)" }}
              title="Return to Root Portal (/)"
            >
              <span>🏠 Root Portal (/)</span>
            </button>

            <button
              onClick={handleOpenSaSettings}
              className="flex items-center gap-2 rounded-2xl border px-4 py-3 font-semibold text-[#4cd34c] border-[#4cd34c]/40 hover:bg-[#4cd34c]/10 active:scale-95 transition-all cursor-pointer"
            >
              <span>⚙️ Super Admin Settings</span>
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] px-5 py-3 font-semibold text-[#071007] shadow-lg hover:opacity-90 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
            >
              <span className="text-lg">✨</span>
              <span>Create Organization</span>
            </button>
          </div>
        </div>

        {/* METRICS STRIP */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t pt-6" style={{ borderColor: "var(--panel-border)" }}>
          <div className="rounded-2xl border p-4 backdrop-blur" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--neutral-bg)" }}>
            <div className="text-xs font-medium uppercase tracking-wider text-gray-400">Total Organizations</div>
            <div className="mt-1 text-3xl font-black text-[#4cd34c]">{companies.length}</div>
          </div>

          <div className="rounded-2xl border p-4 backdrop-blur" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--neutral-bg)" }}>
            <div className="text-xs font-medium uppercase tracking-wider text-gray-400">Active Tenants</div>
            <div className="mt-1 text-3xl font-black text-[#4cd34c]">{activeCount}</div>
          </div>

          <div className="rounded-2xl border p-4 backdrop-blur" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--neutral-bg)" }}>
            <div className="text-xs font-medium uppercase tracking-wider text-gray-400">Active URL Endpoint</div>
            <div className="mt-1 text-xl font-bold font-mono text-[#4cd34c] truncate">
              /{currentCompany?.slug || "corp-a"}
            </div>
          </div>
        </div>
      </div>

      {/* ORGANIZATIONS LIST / GRID */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--app-text)" }}>
            <span>🏢</span> Managed Organizations
          </h3>
          <span className="text-xs font-medium text-gray-400">
            Click any organization card to launch its environment
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map((comp) => {
            const isCurrent = comp.id === activeCompanyId;
            const initials = comp.name
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();

            return (
              <div
                key={comp.id}
                className={`group relative rounded-3xl border p-6 transition-all duration-300 flex flex-col justify-between backdrop-blur ${
                  isCurrent ? "ring-2 ring-[#4cd34c] shadow-[0_0_25px_rgba(76,211,76,0.15)]" : "hover:border-[#4cd34c]/50"
                }`}
                style={{
                  borderColor: isCurrent ? "#4cd34c" : "var(--panel-border)",
                  backgroundColor: "var(--panel-bg)",
                }}
              >
                <div>
                  {/* Card top */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-black text-base shadow-md border"
                        style={{
                          backgroundColor: isCurrent ? "rgba(76, 211, 76, 0.15)" : "var(--neutral-bg)",
                          borderColor: isCurrent ? "#4cd34c" : "var(--badge-border)",
                          color: "#4cd34c",
                        }}
                      >
                        {initials}
                      </div>
                      <div>
                        <h4 className="font-bold text-lg leading-tight" style={{ color: "var(--app-text)" }}>
                          {comp.name}
                        </h4>
                        <div className="mt-0.5 font-mono text-xs font-semibold text-[#4cd34c] flex items-center gap-1">
                          <span>URL:</span>
                          <span className="underline decoration-dotted font-bold">/{comp.slug}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide border ${
                          comp.is_active !== false
                            ? "bg-[#4cd34c]/10 text-[#4cd34c] border-[#4cd34c]/30"
                            : "bg-red-500/10 text-red-400 border-red-500/30"
                        }`}
                      >
                        {comp.is_active !== false ? "ACTIVE" : "INACTIVE"}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[#4cd34c]">
                          CURRENT
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Info list */}
                  <div
                    className="rounded-2xl border p-3 text-xs space-y-1.5 my-4"
                    style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--neutral-bg)" }}
                  >
                    <div className="flex justify-between">
                      <span className="text-gray-400">Organization ID:</span>
                      <span className="font-mono font-bold" style={{ color: "var(--app-text)" }}>#{comp.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Slug Endpoint:</span>
                      <span className="font-mono text-[#4cd34c] font-bold">/{comp.slug}</span>
                    </div>
                  </div>
                </div>

                {/* Card actions */}
                <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: "var(--panel-border)" }}>
                  <button
                    onClick={() => switchCompany(comp.id || comp.slug)}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition-all ${
                      isCurrent
                        ? "bg-[#4cd34c]/20 text-[#4cd34c] border border-[#4cd34c]/40 cursor-default"
                        : "bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] hover:opacity-90 shadow-md cursor-pointer"
                    }`}
                  >
                    <span>{isCurrent ? "Active Workspace" : "Enter Workspace"}</span>
                    <span>➜</span>
                  </button>

                  <button
                    onClick={() => handleOpenResetPin(comp)}
                    className="p-2.5 rounded-xl border border-amber-500/30 text-amber-400 text-xs font-semibold hover:bg-amber-500/10 transition-colors cursor-pointer"
                    title="Reset Company Admin PIN"
                  >
                    🔑
                  </button>

                  <button
                    onClick={() => handleOpenEdit(comp)}
                    className="p-2.5 rounded-xl border text-xs font-semibold hover:bg-[var(--neutral-bg)] transition-colors cursor-pointer"
                    style={{ borderColor: "var(--panel-border)", color: "var(--app-text)" }}
                    title="Edit Organization Settings"
                  >
                    ⚙️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CREATE ORGANIZATION MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div
            className="w-full max-w-lg rounded-3xl border p-6 md:p-8 shadow-2xl space-y-6 backdrop-blur"
            style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}
          >
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--panel-border)" }}>
              <div className="flex items-center gap-2">
                <span className="text-2xl">✨</span>
                <h3 className="text-xl font-bold" style={{ color: "var(--app-text)" }}>
                  Create Organization
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-white text-xl font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={onSubmitCreate} className="space-y-4">
              {createError && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-400">
                  {createError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "var(--header-muted)" }}>
                  Organization Name *
                </label>
                <input
                  type="text"
                  value={newOrgName}
                  onChange={handleNameChange}
                  placeholder="e.g. Winbucks"
                  required
                  className="w-full rounded-2xl border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4cd34c]"
                  style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--neutral-bg)", color: "var(--app-text)" }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "var(--header-muted)" }}>
                  URL Slug Endpoint *
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-[#4cd34c]">/</span>
                  <input
                    type="text"
                    value={newOrgSlug}
                    onChange={(e) => setNewOrgSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                    placeholder="e.g. winbucks"
                    required
                    className="w-full rounded-2xl border p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#4cd34c]"
                    style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--neutral-bg)", color: "var(--app-text)" }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-gray-400">
                  Access URL will be: <code className="text-[#4cd34c] font-mono">{siteOrigin}/{newOrgSlug || "slug"}</code>
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="create-active-toggle"
                  checked={newOrgIsActive}
                  onChange={(e) => setNewOrgIsActive(e.target.checked)}
                  className="h-4 w-4 accent-[#4cd34c] cursor-pointer"
                />
                <label htmlFor="create-active-toggle" className="text-xs font-semibold cursor-pointer" style={{ color: "var(--app-text)" }}>
                  Set Organization Status as Active
                </label>
              </div>

              <div className="rounded-2xl border p-3 text-xs bg-black/20 space-y-1" style={{ borderColor: "var(--panel-border)" }}>
                <span className="font-bold text-[#4cd34c]">⚡ Automatic Provisioning:</span>
                <p className="text-gray-400">
                  Creating a new organization automatically seeds starter escalation & reply templates as well as a System Administrator profile (<code className="text-white">SA</code> / default PIN: <code className="text-white">0000</code>).
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: "var(--panel-border)" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border px-4 py-2.5 text-xs font-semibold hover:bg-[var(--neutral-bg)] transition-colors cursor-pointer"
                  style={{ borderColor: "var(--panel-border)", color: "var(--app-text)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] px-5 py-2.5 text-xs font-bold text-[#071007] hover:opacity-90 transition-all cursor-pointer shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? "Provisioning..." : "Create Organization"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ORGANIZATION MODAL */}
      {editCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div
            className="w-full max-w-lg rounded-3xl border p-6 md:p-8 shadow-2xl space-y-6 backdrop-blur"
            style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}
          >
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--panel-border)" }}>
              <div className="flex items-center gap-2">
                <span className="text-2xl">⚙️</span>
                <h3 className="text-xl font-bold" style={{ color: "var(--app-text)" }}>
                  Edit Organization #{editCompany.id}
                </h3>
              </div>
              <button
                onClick={() => setEditCompany(null)}
                className="text-gray-400 hover:text-white text-xl font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={onSubmitEdit} className="space-y-4">
              {editError && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-400">
                  {editError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "var(--header-muted)" }}>
                  Organization Name *
                </label>
                <input
                  type="text"
                  value={editOrgName}
                  onChange={(e) => setEditOrgName(e.target.value)}
                  required
                  className="w-full rounded-2xl border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4cd34c]"
                  style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--neutral-bg)", color: "var(--app-text)" }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "var(--header-muted)" }}>
                  URL Slug Endpoint *
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-[#4cd34c]">/</span>
                  <input
                    type="text"
                    value={editOrgSlug}
                    onChange={(e) => setEditOrgSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                    required
                    className="w-full rounded-2xl border p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#4cd34c]"
                    style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--neutral-bg)", color: "var(--app-text)" }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-gray-400">
                  Access URL will be: <code className="text-[#4cd34c] font-mono">{siteOrigin}/{editOrgSlug || "slug"}</code>
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="edit-active-toggle"
                  checked={editOrgIsActive}
                  onChange={(e) => setEditOrgIsActive(e.target.checked)}
                  className="h-4 w-4 accent-[#4cd34c] cursor-pointer"
                />
                <label htmlFor="edit-active-toggle" className="text-xs font-semibold cursor-pointer" style={{ color: "var(--app-text)" }}>
                  Organization Status Active
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: "var(--panel-border)" }}>
                <button
                  type="button"
                  onClick={() => setEditCompany(null)}
                  className="rounded-xl border px-4 py-2.5 text-xs font-semibold hover:bg-[var(--neutral-bg)] transition-colors cursor-pointer"
                  style={{ borderColor: "var(--panel-border)", color: "var(--app-text)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isEditing}
                  className="rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] px-5 py-2.5 text-xs font-bold text-[#071007] hover:opacity-90 transition-all cursor-pointer shadow-md disabled:opacity-50"
                >
                  {isEditing ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET COMPANY ADMIN PIN MODAL */}
      {resetPinCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div
            className="w-full max-w-md rounded-3xl border p-6 md:p-8 shadow-2xl space-y-6 backdrop-blur"
            style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}
          >
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--panel-border)" }}>
              <div className="flex items-center gap-2">
                <span className="text-2xl">🔑</span>
                <h3 className="text-xl font-bold" style={{ color: "var(--app-text)" }}>
                  Reset Admin PIN
                </h3>
              </div>
              <button
                onClick={() => setResetPinCompany(null)}
                className="text-gray-400 hover:text-white text-xl font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={onSubmitResetCompanyAdminPin} className="space-y-4">
              {resetPinError && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-400">
                  {resetPinError}
                </div>
              )}

              <p className="text-xs text-gray-300">
                Resetting the Admin PIN for <strong className="text-[#4cd34c]">{resetPinCompany.name}</strong> will update the login PIN for all administrator profiles in this company.
              </p>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "var(--header-muted)" }}>
                  New 4-Digit Admin PIN *
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={companyNewPin}
                  onChange={(e) => setCompanyNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="e.g. 1234"
                  required
                  className="w-full rounded-2xl border p-3 text-sm font-mono text-center tracking-widest text-xl focus:outline-none focus:ring-2 focus:ring-[#4cd34c]"
                  style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--neutral-bg)", color: "var(--app-text)" }}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: "var(--panel-border)" }}>
                <button
                  type="button"
                  onClick={() => setResetPinCompany(null)}
                  className="rounded-xl border px-4 py-2.5 text-xs font-semibold hover:bg-[var(--neutral-bg)] transition-colors cursor-pointer"
                  style={{ borderColor: "var(--panel-border)", color: "var(--app-text)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResettingPin || companyNewPin.length !== 4}
                  className="rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] px-5 py-2.5 text-xs font-bold text-[#071007] hover:opacity-90 transition-all cursor-pointer shadow-md disabled:opacity-50"
                >
                  {isResettingPin ? "Resetting..." : "Reset Admin PIN"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUPER ADMIN SETTINGS MODAL */}
      {showSaSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div
            className="w-full max-w-lg rounded-3xl border p-6 md:p-8 shadow-2xl space-y-6 backdrop-blur"
            style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}
          >
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--panel-border)" }}>
              <div className="flex items-center gap-2">
                <span className="text-2xl">⚙️</span>
                <h3 className="text-xl font-bold" style={{ color: "var(--app-text)" }}>
                  Super Admin Credentials
                </h3>
              </div>
              <button
                onClick={() => setShowSaSettings(false)}
                className="text-gray-400 hover:text-white text-xl font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={onSubmitSaSettings} className="space-y-4">
              {saSettingsError && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-400">
                  {saSettingsError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "var(--header-muted)" }}>
                  Registered Super Admin Personal Email
                </label>
                <input
                  type="email"
                  value={saNewEmail}
                  onChange={(e) => setSaNewEmail(e.target.value)}
                  placeholder="e.g. gfc.dev@proton.me"
                  className="w-full rounded-2xl border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4cd34c]"
                  style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--neutral-bg)", color: "var(--app-text)" }}
                />
                <p className="mt-1 text-[11px] text-gray-400">
                  Used to authorize PIN resets if you forget your Super Admin PIN.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "var(--header-muted)" }}>
                  Change 4-Digit Super Admin PIN (Optional)
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={saNewPin}
                  onChange={(e) => setSaNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="Leave blank to keep current PIN"
                  className="w-full rounded-2xl border p-3 text-sm font-mono text-center tracking-widest text-xl focus:outline-none focus:ring-2 focus:ring-[#4cd34c]"
                  style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--neutral-bg)", color: "var(--app-text)" }}
                />
              </div>

              <div className="border-t pt-4" style={{ borderColor: "var(--panel-border)" }}>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-[#4cd34c]">
                  Confirm Current Super Admin PIN *
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={saCurrentPin}
                  onChange={(e) => setSaCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="Enter current PIN to save changes"
                  required
                  className="w-full rounded-2xl border p-3 text-sm font-mono text-center tracking-widest text-xl focus:outline-none focus:ring-2 focus:ring-[#4cd34c]"
                  style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--neutral-bg)", color: "var(--app-text)" }}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: "var(--panel-border)" }}>
                <button
                  type="button"
                  onClick={() => setShowSaSettings(false)}
                  className="rounded-xl border px-4 py-2.5 text-xs font-semibold hover:bg-[var(--neutral-bg)] transition-colors cursor-pointer"
                  style={{ borderColor: "var(--panel-border)", color: "var(--app-text)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingSaSettings || !saCurrentPin}
                  className="rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] px-5 py-2.5 text-xs font-bold text-[#071007] hover:opacity-90 transition-all cursor-pointer shadow-md disabled:opacity-50"
                >
                  {isSavingSaSettings ? "Updating..." : "Save Credentials"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
