import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const THEME_KEY = "rea_theme_v1";
const DEFAULT_TEMPLATES = [
  {
    id: 1,
    name: "Withdrawal Delay",
    body: "Hi {customer_name}, your withdrawal {reference_no} is under review. ETA: {eta}.",
  },
  {
    id: 2,
    name: "KYC Pending",
    body: "Hi {customer_name}, your account verification is still pending. Please upload: {required_docs}.",
  },
  {
    id: 3,
    name: "Bonus Not Received",
    body: "Hi {customer_name}, we checked your bonus request for promo {promo_code}. Status: {status}.",
  },
];

const THEMES = {
  night: {
    label: "Night mode",
    overlay:
      "radial-gradient(circle at top, rgba(76,211,76,0.12), transparent 40%),radial-gradient(circle at bottom right, rgba(15,155,0,0.12), transparent 35%),linear-gradient(180deg, #091009 0%, #040804 100%)",
    rootStyle: {
      "--app-bg": "#081008",
      "--app-text": "#f4f7f4",
      "--text-muted": "#c9c9d8",
      "--panel-bg": "rgba(11,19,11,0.85)",
      "--panel-border": "#32324a",
      "--panel-border-strong": "#4cd34c",
      "--field-bg": "#10111a",
      "--field-border": "#32324a",
      "--field-placeholder": "#7d7d93",
      "--neutral-bg": "#11111e",
      "--neutral-text": "#e1e1ee",
      "--badge-bg": "#11111e",
      "--badge-border": "#4a4a63",
      "--badge-text": "#c3c3d9",
      "--status-bg": "#141422",
      "--status-border": "#3a3a54",
      "--error-bg": "#231f16",
      "--error-border": "#6f5b2b",
      "--error-text": "#f2e8cf",
      "--panel-shadow": "0 12px 40px rgba(0,0,0,0.35)",
      "--header-border": "#2f2f46",
      "--header-bg": "rgba(11,19,11,0.85)",
      "--header-text": "#f3fff3",
      "--header-muted": "#c3d1c3",
    },
  },
  day: {
    label: "Day mode",
    overlay:
      "radial-gradient(circle at top, rgba(15,155,0,0.07), transparent 40%),radial-gradient(circle at bottom right, rgba(76,211,76,0.06), transparent 35%),linear-gradient(180deg, #f7f3ea 0%, #efeadf 100%)",
    rootStyle: {
      "--app-bg": "#f7f3ea",
      "--app-text": "#132013",
      "--text-muted": "#556255",
      "--panel-bg": "rgba(255,251,243,0.9)",
      "--panel-border": "#d7d0c3",
      "--panel-border-strong": "#0f9b00",
      "--field-bg": "#fffdf8",
      "--field-border": "#d7d0c3",
      "--field-placeholder": "#7c8377",
      "--neutral-bg": "#f4efe5",
      "--neutral-text": "#243024",
      "--badge-bg": "#f3ede1",
      "--badge-border": "#d2cabd",
      "--badge-text": "#3f493f",
      "--status-bg": "#f2f0e7",
      "--status-border": "#d2d2c5",
      "--error-bg": "#fff5df",
      "--error-border": "#d4be82",
      "--error-text": "#785d18",
      "--panel-shadow": "0 12px 40px rgba(0,0,0,0.08)",
      "--header-border": "#d7d0c3",
      "--header-bg": "rgba(255,251,243,0.9)",
      "--header-text": "#132013",
      "--header-muted": "#556255",
    },
  },
};

export default function App() {
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editBody, setEditBody] = useState("");
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [apiStatus, setApiStatus] = useState("checking");
  const [statusMessage, setStatusMessage] = useState("");
  const [themeMode, setThemeMode] = useState(() => {
    if (typeof window === "undefined") return "night";
    return window.localStorage.getItem(THEME_KEY) ?? "night";
  });

  const theme = THEMES[themeMode] ?? THEMES.night;

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(THEME_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    let mounted = true;
    async function loadTemplates() {
      setLoading(true);
      setError("");
      setApiStatus("checking");
      setStatusMessage("");
      try {
        const healthResponse = await fetch(`${API_BASE}/health`);
        if (!healthResponse.ok) throw new Error(`API health check failed (${healthResponse.status})`);
        const healthData = await healthResponse.json();
        if (!mounted) return;
        setApiStatus("online");
        setStatusMessage(healthData.message ?? "Backend is ready");

        const response = await fetch(`${API_BASE}/templates`);
        if (!response.ok) throw new Error(`Failed to load templates (${response.status})`);
        const data = await response.json();
        if (!mounted) return;
        const normalized = Array.isArray(data) ? data : [];
        setTemplates(normalized);
        setSelectedId(normalized[0]?.id ?? null);
      } catch (err) {
        if (!mounted) return;
        setApiStatus("offline");
        setError("");
        setStatusMessage("Backend offline. Using built-in templates for this session.");
        setTemplates(DEFAULT_TEMPLATES);
        setSelectedId(DEFAULT_TEMPLATES[0]?.id ?? null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadTemplates();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const t = templates.find((p) => p.id === selectedId) ?? templates[0];
    if (t) {
      setEditName(t.name);
      setEditBody(t.body);
    } else {
      setEditName("");
      setEditBody("");
    }
    setValues({});
  }, [selectedId, templates]);

  const placeholders = useMemo(() => {
    const t = templates.find((p) => p.id === selectedId);
    if (!t) return [];
    const set = new Set();
    const re = /\{([^}]+)\}/g;
    let m;
    while ((m = re.exec(t.body))) set.add(m[1]);
    return Array.from(set);
  }, [selectedId, templates]);

  async function refreshTemplates(nextSelectedId = null) {
    if (apiStatus === "offline") {
      if (templates.length === 0) {
        setTemplates(DEFAULT_TEMPLATES);
        setSelectedId(DEFAULT_TEMPLATES[0]?.id ?? null);
      }
      return;
    }

    const response = await fetch(`${API_BASE}/templates`);
    if (!response.ok) throw new Error(`Failed to refresh templates (${response.status})`);
    const data = await response.json();
    const normalized = Array.isArray(data) ? data : [];
    setTemplates(normalized);
    if (normalized.length === 0) {
      setSelectedId(null);
      return;
    }
    const activeId = nextSelectedId ?? selectedId;
    const stillExists = normalized.some((t) => t.id === activeId);
    setSelectedId(stillExists ? activeId : normalized[0].id);
  }

  async function upsertTemplate(id, name, body) {
    setSaving(true);
    setError("");
    try {
      if (apiStatus === "offline") {
        if (id == null) {
          const next = { id: Date.now(), name, body };
          setTemplates((current) => [next, ...current]);
          setSelectedId(next.id);
          setStatusMessage(`Template created locally: ${next.name}`);
        } else {
          setTemplates((current) => current.map((t) => (t.id === id ? { ...t, name, body } : t)));
          setStatusMessage(`Template updated locally: ${name}`);
        }
        return;
      }

      if (id == null) {
        const response = await fetch(`${API_BASE}/templates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, body }),
        });
        if (!response.ok) throw new Error(`Create failed (${response.status})`);
        const created = await response.json();
        setStatusMessage(`Template created: ${created.name}`);
        await refreshTemplates(created.id);
      } else {
        const response = await fetch(`${API_BASE}/templates/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, body }),
        });
        if (!response.ok) throw new Error(`Update failed (${response.status})`);
        const updated = await response.json();
        setStatusMessage(`Template updated: ${updated.name}`);
        setTemplates((s) => s.map((t) => (t.id === id ? updated : t)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTemplate(id) {
    setSaving(true);
    setError("");
    try {
      if (apiStatus === "offline") {
        setTemplates((current) => current.filter((t) => t.id !== id));
        setSelectedId((currentSelectedId) => {
          if (currentSelectedId === id) return DEFAULT_TEMPLATES[0]?.id ?? null;
          return currentSelectedId;
        });
        setStatusMessage("Template deleted locally");
        return;
      }

      const response = await fetch(`${API_BASE}/templates/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(`Delete failed (${response.status})`);
      const result = await response.json();
      setStatusMessage(result.message ?? "Template deleted");
      await refreshTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete template");
    } finally {
      setSaving(false);
    }
  }

  // import/export support
  const fileRef = useRef(null);

  async function exportTemplates() {
    try {
      if (apiStatus === "offline") {
        const blob = new Blob([JSON.stringify(templates, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "templates.json";
        a.click();
        URL.revokeObjectURL(url);
        setStatusMessage(`Exported ${templates.length} template(s) locally`);
        return;
      }

      const response = await fetch(`${API_BASE}/export`);
      if (!response.ok) throw new Error(`Export failed (${response.status})`);
      const data = await response.json();
      setStatusMessage(`Exported ${data.length} template(s)`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "templates.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export templates");
    }
  }

  async function importTemplatesFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const items = JSON.parse(reader.result);
        if (apiStatus === "offline") {
          const imported = Array.isArray(items) ? items : [];
          setTemplates(imported);
          setSelectedId(imported[0]?.id ?? null);
          setStatusMessage("Templates imported locally");
          return;
        }

        fetch(`${API_BASE}/import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(items),
        })
          .then(async (r) => {
            if (!r.ok) throw new Error(`Import failed (${r.status})`);
            const result = await r.json();
            setStatusMessage(result.message ?? "Templates imported");
            return refreshTemplates();
          })
          .catch((err) => setError(err instanceof Error ? err.message : "Failed to import templates"));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to import file");
      }
    };
    reader.readAsText(file);
  }

  function generateMessage() {
    const t = templates.find((p) => p.id === selectedId);
    if (!t) return "";
    let out = t.body;
    for (const key of Object.keys(values)) {
      const re = new RegExp(`\\{${key}\\}`, "g");
      out = out.replace(re, values[key] ?? "");
    }
    return out;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    return Promise.resolve();
  }

  function escapeForTelegramMarkdownV2(s) {
    // minimal escaping for common markdown chars
    return s.replace(/([_\*\[\]\(\)`~>#+=\-|{}.!])/g, "\\$1");
  }

  const message = generateMessage();

  return (
    <div className="relative min-h-screen overflow-hidden p-6 text-[var(--app-text)] transition-colors duration-300" style={{ backgroundColor: "var(--app-bg)", ...theme.rootStyle }}>
      <div className="absolute inset-0 -z-10" style={{ backgroundImage: theme.overlay }} />
      <header className="mb-6 flex flex-col gap-4 rounded-3xl border p-4 shadow-[var(--panel-shadow)] backdrop-blur md:flex-row md:items-center md:justify-between" style={{ borderColor: "var(--header-border)", backgroundColor: "var(--header-bg)" }}>
        <div className="flex items-center gap-4">
          <img
            src="/casino-logo.DetIqsS6.svg"
            alt="Casino logo"
            className="h-12 w-auto max-w-[11rem] object-contain drop-shadow-[0_0_18px_rgba(76,211,76,0.18)] md:h-14 md:max-w-[13rem]"
          />
          <div>
            <div className="mb-1 inline-flex rounded-full border px-3 py-1 text-xs uppercase tracking-[0.24em]" style={{ borderColor: "var(--badge-border)", backgroundColor: "var(--badge-bg)", color: "var(--badge-text)" }}>
              KUYANUKELELA ASIDLENI! TALKIT
            </div>
            <h1 className="text-2xl font-bold md:text-3xl" style={{ color: "var(--header-text)" }}>
              Response & Escalation Assistant
            </h1>
            <p className="mt-1 max-w-2xl" style={{ color: "var(--header-muted)" }}>
              Create, edit, and send reusable support replies and Telegram-ready escalation notes.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--header-muted)" }}>
          <span className={`h-2 w-2 rounded-full ${apiStatus === "checking" ? "bg-[#f1c84b]" : apiStatus === "offline" ? "bg-[#b83838]" : "bg-[#4cd34c]"}`} />
          <span>{loading ? "Checking backend" : apiStatus === "offline" ? "Backend offline" : statusMessage || "Backend connected"}</span>
          <button
            type="button"
            onClick={() => setThemeMode((current) => (current === "night" ? "day" : "night"))}
            aria-label={`Switch to ${themeMode === "night" ? "day" : "night"} mode`}
            className="ml-2 inline-flex h-9 w-[4.75rem] items-center rounded-full border px-1 transition-colors"
            style={{ borderColor: "var(--badge-border)", backgroundColor: "var(--neutral-bg)" }}
          >
            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm shadow-sm transition-transform duration-200 ${themeMode === "night" ? "translate-x-0 bg-[#11111e] text-[#e1e1ee]" : "translate-x-12 bg-[#f4efe5] text-[#243024]"}`}>
              {themeMode === "night" ? "☾" : "☀"}
            </span>
          </button>
        </div>
      </header>

      {statusMessage && apiStatus !== "offline" ? (
        <div className="mb-4 rounded-2xl border px-4 py-3 shadow-[0_0_0_1px_rgba(76,211,76,0.05)] backdrop-blur" style={{ borderColor: "var(--status-border)", backgroundColor: "var(--status-bg)", color: "var(--app-text)" }}>
          {statusMessage}
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-2xl border px-4 py-3" style={{ borderColor: "var(--error-border)", backgroundColor: "var(--error-bg)", color: "var(--error-text)" }}>
          {error}. Make sure the FastAPI server is running and reachable at {API_BASE}.
        </div>
      ) : null}

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <section className="lg:col-span-4 rounded-3xl border p-4 shadow-[var(--panel-shadow)] backdrop-blur" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold" style={{ color: "var(--app-text)" }}>Templates</h2>
            <div className="flex gap-2">
              <button
                onClick={() => upsertTemplate(null, "New template", "Hi {customer_name}, ")}
                className="px-3 py-1 rounded-lg bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] text-sm font-semibold shadow-[0_8px_20px_rgba(15,155,0,0.25)] disabled:opacity-50"
                disabled={loading || saving}
              >
                Add template
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {templates.length === 0 ? (
              <div className="rounded-2xl border p-3 text-sm" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--field-bg)", color: "var(--text-muted)" }}>
                No templates yet. Add one to get started.
              </div>
            ) : templates.map((t) => (
              <div
                key={t.id}
                className={`p-3 rounded-2xl border flex justify-between items-start transition ${t.id === selectedId ? "ring-2 ring-[#0f9b00]/30" : ""}`}
                style={{ borderColor: t.id === selectedId ? "var(--panel-border-strong)" : "var(--panel-border)", backgroundColor: "var(--field-bg)" }}
              >
                <div onClick={() => setSelectedId(t.id)} className="cursor-pointer">
                  <div className="font-medium" style={{ color: "var(--app-text)" }}>{t.name}</div>
                  <div className="text-sm mt-1 line-clamp-2" style={{ color: "var(--text-muted)" }}>{t.body}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setSelectedId(t.id); setEditName(t.name); setEditBody(t.body); }}
                    className="px-2 py-1 rounded-lg border text-sm disabled:opacity-50"
                    style={{ borderColor: "var(--badge-border)", color: "var(--neutral-text)", backgroundColor: "var(--neutral-bg)" }}
                    disabled={loading || saving}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteTemplate(t.id)}
                    className="px-2 py-1 rounded-lg border text-sm disabled:opacity-50"
                    style={{ borderColor: "var(--error-border)", color: "var(--error-text)", backgroundColor: "var(--neutral-bg)" }}
                    disabled={loading || saving}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--panel-border)" }}>
            <h3 className="font-medium mb-2" style={{ color: "var(--app-text)" }}>Edit / Create</h3>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Template name"
              className="w-full rounded-xl border p-2 mb-2 placeholder:text-[var(--field-placeholder)]"
              style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
            />
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              placeholder="Write the template body and use placeholders like {customer_name}"
              className="w-full rounded-xl border p-2 min-h-24 placeholder:text-[var(--field-placeholder)]"
              style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => upsertTemplate(selectedId, editName, editBody)}
                className="px-3 py-2 rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] font-semibold shadow-[0_8px_20px_rgba(15,155,0,0.25)] disabled:opacity-50"
                disabled={loading || saving}
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => { setEditName(templates[0]?.name ?? ""); setEditBody(templates[0]?.body ?? ""); setSelectedId(templates[0]?.id ?? null); }}
                className="px-3 py-2 rounded-xl border disabled:opacity-50"
                style={{ borderColor: "var(--badge-border)", color: "var(--neutral-text)", backgroundColor: "var(--neutral-bg)" }}
                disabled={loading || saving}
              >
                Discard changes
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={exportTemplates}
                className="px-3 py-2 rounded-xl border disabled:opacity-50"
                style={{ borderColor: "var(--badge-border)", color: "var(--neutral-text)", backgroundColor: "var(--neutral-bg)" }}
                disabled={loading || saving}
              >
                Export JSON
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="px-3 py-2 rounded-xl border disabled:opacity-50"
                style={{ borderColor: "var(--badge-border)", color: "var(--neutral-text)", backgroundColor: "var(--neutral-bg)" }}
                disabled={loading || saving}
              >
                Import JSON
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) importTemplatesFile(file);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
        </section>

        <section className="lg:col-span-5 rounded-3xl border p-4 shadow-[var(--panel-shadow)] backdrop-blur" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}>
          <h2 className="font-semibold mb-3" style={{ color: "var(--app-text)" }}>Message Builder</h2>
          <div className="space-y-3">
            <div className="flex gap-2">
              <label className="text-sm" style={{ color: "var(--text-muted)" }}>Template:</label>
              <select value={selectedId ?? ""} onChange={(e) => setSelectedId(Number(e.target.value))} className="flex-1 rounded-xl border p-2" style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }} disabled={loading || templates.length === 0}>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {placeholders.length === 0 ? (
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>This template has no placeholders.</div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {placeholders.map((ph) => (
                  <input
                    key={ph}
                    value={values[ph] ?? ""}
                    onChange={(e) => setValues((s) => ({ ...s, [ph]: e.target.value }))}
                    placeholder={ph}
                    className="w-full rounded-xl border p-2 placeholder:text-[var(--field-placeholder)]"
                    style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                  />
                ))}
              </div>
            )}

            <div>
              <div className="text-sm mb-1" style={{ color: "var(--text-muted)" }}>Message preview</div>
              <textarea readOnly value={message} className="w-full rounded-xl border p-2 min-h-28" style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }} />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => copyText(message)}
                disabled={!message || loading}
                className="px-4 py-2 rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] font-semibold shadow-[0_8px_20px_rgba(15,155,0,0.25)] disabled:opacity-50"
              >
                Copy plain text
              </button>
              <button
                onClick={() => copyText(escapeForTelegramMarkdownV2(message))}
                disabled={!message || loading}
                className="px-4 py-2 rounded-xl border disabled:opacity-50"
                style={{ borderColor: "var(--badge-border)", color: "var(--neutral-text)", backgroundColor: "var(--neutral-bg)" }}
              >
                Copy Telegram format
              </button>
              <button
                onClick={() => setValues({})}
                className="px-4 py-2 rounded-xl border disabled:opacity-50"
                style={{ borderColor: "var(--badge-border)", color: "var(--neutral-text)", backgroundColor: "var(--neutral-bg)" }}
                disabled={loading}
              >
                Clear fields
              </button>
            </div>
          </div>
        </section>

        
      </main>
    </div>
  );
}