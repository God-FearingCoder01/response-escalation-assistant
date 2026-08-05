import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

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
        setError(err instanceof Error ? err.message : "Failed to load templates");
        setApiStatus("offline");
        setStatusMessage("");
        setTemplates([]);
        setSelectedId(null);
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
    <div className="min-h-screen bg-[#081008] text-[#f4f7f4] p-6">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(76,211,76,0.12),_transparent_40%),radial-gradient(circle_at_bottom_right,_rgba(15,155,0,0.12),_transparent_35%),linear-gradient(180deg,_#091009_0%,_#040804_100%)]" />
      <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-[#234023] bg-[#0b130b]/85 p-4 shadow-[0_0_0_1px_rgba(76,211,76,0.06),0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <img
            src="/casino-logo.DetIqsS6.svg"
            alt="Casino logo"
            className="h-12 w-auto max-w-[11rem] object-contain drop-shadow-[0_0_18px_rgba(76,211,76,0.18)] md:h-14 md:max-w-[13rem]"
          />
          <div>
            <div className="mb-1 inline-flex rounded-full border border-[#365336] bg-[#081008] px-3 py-1 text-xs uppercase tracking-[0.24em] text-[#9bd49b]">
              Brand matched theme
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#f3fff3]">
              Response & Escalation Assistant
            </h1>
            <p className="mt-1 max-w-2xl text-[#c3d1c3]">
              Create, edit, and send reusable support replies and Telegram-ready escalation notes.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-[#c2d0c2]">
          <span className={`h-2 w-2 rounded-full ${apiStatus === "checking" ? "bg-[#f1c84b]" : apiStatus === "offline" ? "bg-[#b83838]" : "bg-[#4cd34c]"}`} />
          <span>{loading ? "Checking backend" : apiStatus === "offline" ? "Backend offline" : statusMessage || "Backend connected"}</span>
        </div>
      </header>

      {statusMessage && apiStatus !== "offline" ? (
        <div className="mb-4 rounded-2xl border border-[#2b5a2b] bg-[#102110]/80 px-4 py-3 text-[#dff4df] shadow-[0_0_0_1px_rgba(76,211,76,0.06)] backdrop-blur">
          {statusMessage}
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-2xl border border-[#8b5b19] bg-[#2a1f0e]/85 px-4 py-3 text-[#f5e3bf]">
          {error}. Make sure the FastAPI server is running and reachable at {API_BASE}.
        </div>
      ) : null}

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <section className="lg:col-span-4 rounded-3xl border border-[#263a26] bg-[#0b130b]/85 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-[#e9f5e9]">Templates</h2>
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
              <div className="rounded-2xl border border-[#263a26] bg-[#081008] p-3 text-sm text-[#b9c6b9]">
                No templates yet. Add one to get started.
              </div>
            ) : templates.map((t) => (
              <div
                key={t.id}
                className={`p-3 rounded-2xl border bg-[#081008] flex justify-between items-start transition ${t.id === selectedId ? "border-[#4cd34c] ring-2 ring-[#0f9b00]/30" : "border-[#263a26]"}`}
              >
                <div onClick={() => setSelectedId(t.id)} className="cursor-pointer">
                  <div className="font-medium text-[#f4f7f4]">{t.name}</div>
                  <div className="text-sm text-[#aab8aa] mt-1 line-clamp-2">{t.body}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setSelectedId(t.id); setEditName(t.name); setEditBody(t.body); }}
                    className="px-2 py-1 rounded-lg border border-[#3b583b] text-sm text-[#dbe8db] disabled:opacity-50"
                    disabled={loading || saving}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteTemplate(t.id)}
                    className="px-2 py-1 rounded-lg border border-[#8b5b19] text-sm text-[#f5c16c] disabled:opacity-50"
                    disabled={loading || saving}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800">
            <h3 className="font-medium mb-2 text-[#e9f5e9]">Edit / Create</h3>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Template name"
              className="w-full rounded-xl border border-[#263a26] bg-[#081008] p-2 mb-2 text-[#f4f7f4] placeholder:text-[#6f806f]"
            />
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              placeholder="Write the template body and use placeholders like {customer_name}"
              className="w-full rounded-xl border border-[#263a26] bg-[#081008] p-2 min-h-24 text-[#f4f7f4] placeholder:text-[#6f806f]"
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
                className="px-3 py-2 rounded-xl border border-[#3b583b] text-[#dbe8db] disabled:opacity-50"
                disabled={loading || saving}
              >
                Discard changes
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={exportTemplates}
                className="px-3 py-2 rounded-xl border border-[#3b583b] text-[#dbe8db] disabled:opacity-50"
                disabled={loading || saving}
              >
                Export JSON
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="px-3 py-2 rounded-xl border border-[#3b583b] text-[#dbe8db] disabled:opacity-50"
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

        <section className="lg:col-span-5 rounded-3xl border border-[#263a26] bg-[#0b130b]/85 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur">
          <h2 className="font-semibold mb-3 text-[#e9f5e9]">Message Builder</h2>
          <div className="space-y-3">
            <div className="flex gap-2">
              <label className="text-sm text-[#b9c6b9]">Template:</label>
              <select value={selectedId ?? ""} onChange={(e) => setSelectedId(Number(e.target.value))} className="flex-1 rounded-xl border border-[#263a26] bg-[#081008] p-2 text-[#f4f7f4]" disabled={loading || templates.length === 0}>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {placeholders.length === 0 ? (
              <div className="text-sm text-[#b9c6b9]">This template has no placeholders.</div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {placeholders.map((ph) => (
                  <input
                    key={ph}
                    value={values[ph] ?? ""}
                    onChange={(e) => setValues((s) => ({ ...s, [ph]: e.target.value }))}
                    placeholder={ph}
                    className="w-full rounded-xl border border-[#263a26] bg-[#081008] p-2 text-[#f4f7f4] placeholder:text-[#6f806f]"
                  />
                ))}
              </div>
            )}

            <div>
              <div className="text-sm text-[#b9c6b9] mb-1">Message preview</div>
              <textarea readOnly value={message} className="w-full rounded-xl border border-[#263a26] bg-[#081008] p-2 min-h-28 text-[#f4f7f4]" />
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
                className="px-4 py-2 rounded-xl border border-[#3b583b] text-[#dbe8db] disabled:opacity-50"
              >
                Copy Telegram format
              </button>
              <button
                onClick={() => setValues({})}
                className="px-4 py-2 rounded-xl border border-[#3b583b] text-[#dbe8db] disabled:opacity-50"
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