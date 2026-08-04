import { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_TEMPLATES = [
  { id: 1, name: "Withdrawal Delay", body: "Hi {customer_name}, your withdrawal {reference_no} is under review. ETA: {eta}." },
  { id: 2, name: "KYC Pending", body: "Hi {customer_name}, your account verification is still pending. Please upload: {required_docs}." },
  { id: 3, name: "Bonus Not Received", body: "Hi {customer_name}, we checked your bonus request for promo {promo_code}. Status: {status}." }
];

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

  useEffect(() => {
    let mounted = true;
    async function loadTemplates() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${API_BASE}/templates`);
        if (!response.ok) throw new Error(`Failed to load templates (${response.status})`);
        const data = await response.json();
        if (!mounted) return;
        const normalized = Array.isArray(data) ? data : [];
        if (normalized.length > 0) {
          setTemplates(normalized);
          setSelectedId(normalized[0].id ?? null);
        } else {
          await fetch(`${API_BASE}/import`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(DEFAULT_TEMPLATES.map(({ name, body }) => ({ name, body }))),
          });
          const seededResponse = await fetch(`${API_BASE}/templates`);
          const seededData = await seededResponse.json();
          const seededTemplates = Array.isArray(seededData) ? seededData : [];
          setTemplates(seededTemplates);
          setSelectedId(seededTemplates[0]?.id ?? null);
        }
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load templates");
        setTemplates(DEFAULT_TEMPLATES.map((template, index) => ({ ...template, id: -(index + 1) })));
        setSelectedId(-1);
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
        await refreshTemplates(created.id);
      } else {
        const response = await fetch(`${API_BASE}/templates/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, body }),
        });
        if (!response.ok) throw new Error(`Update failed (${response.status})`);
        const updated = await response.json();
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
          .then((r) => {
            if (!r.ok) throw new Error(`Import failed (${r.status})`);
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
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-cyan-400">
            Response & Escalation Assistant
          </h1>
          <p className="text-slate-400 mt-1">
            Backend-driven template and message builder for support and escalation workflows.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span className={`h-2 w-2 rounded-full ${loading ? "bg-amber-400" : error ? "bg-red-500" : "bg-emerald-400"}`} />
          <span>{loading ? "Loading templates" : error ? "Using fallback data" : "Connected to API"}</span>
        </div>
      </header>

      {error ? (
        <div className="mb-4 rounded-lg border border-amber-700 bg-amber-950/60 px-4 py-3 text-amber-100">
          {error}
        </div>
      ) : null}

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <section className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Templates</h2>
            <div className="flex gap-2">
              <button
                onClick={() => upsertTemplate(null, "New template", "Hi {customer_name}, ")}
                className="px-3 py-1 rounded bg-cyan-600 text-slate-900 text-sm disabled:opacity-50"
                disabled={loading || saving}
              >
                New
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {templates.map((t) => (
              <div
                key={t.id}
                className={`p-3 rounded-lg border border-slate-800 bg-slate-950 flex justify-between items-start ${t.id === selectedId ? "ring-2 ring-cyan-600" : ""}`}
              >
                <div onClick={() => setSelectedId(t.id)} className="cursor-pointer">
                  <div className="font-medium">{t.name}</div>
                  <div className="text-sm text-slate-400 mt-1 line-clamp-2">{t.body}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setSelectedId(t.id); setEditName(t.name); setEditBody(t.body); }}
                    className="px-2 py-1 rounded border border-slate-700 text-sm disabled:opacity-50"
                    disabled={loading || saving}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteTemplate(t.id)}
                    className="px-2 py-1 rounded border border-red-600 text-sm text-red-400 disabled:opacity-50"
                    disabled={loading || saving}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800">
            <h3 className="font-medium mb-2">Edit / Create</h3>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Template name"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 mb-2"
            />
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              placeholder="Template body with placeholders like {customer_name}"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 min-h-24"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => upsertTemplate(selectedId, editName, editBody)}
                className="px-3 py-2 rounded bg-cyan-500 text-slate-900 font-semibold disabled:opacity-50"
                disabled={loading || saving}
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => { setEditName(templates[0]?.name ?? ""); setEditBody(templates[0]?.body ?? ""); setSelectedId(templates[0]?.id ?? null); }}
                className="px-3 py-2 rounded border border-slate-700 disabled:opacity-50"
                disabled={loading || saving}
              >
                Reset
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={exportTemplates}
                className="px-3 py-2 rounded border border-slate-700 disabled:opacity-50"
                disabled={loading || saving}
              >
                Export JSON
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="px-3 py-2 rounded border border-slate-700 disabled:opacity-50"
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

        <section className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h2 className="font-semibold mb-3">Message Builder (MVP)</h2>
          <div className="space-y-3">
            <div className="flex gap-2">
              <label className="text-sm text-slate-400">Template:</label>
              <select value={selectedId ?? ""} onChange={(e) => setSelectedId(Number(e.target.value))} className="bg-slate-950 border border-slate-800 rounded-lg p-2 flex-1" disabled={loading || templates.length === 0}>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {placeholders.length === 0 ? (
              <div className="text-sm text-slate-400">No placeholders detected in template.</div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {placeholders.map((ph) => (
                  <input
                    key={ph}
                    value={values[ph] ?? ""}
                    onChange={(e) => setValues((s) => ({ ...s, [ph]: e.target.value }))}
                    placeholder={ph}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2"
                  />
                ))}
              </div>
            )}

            <div>
              <div className="text-sm text-slate-400 mb-1">Preview</div>
              <textarea readOnly value={message} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 min-h-28" />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => copyText(message)}
                disabled={!message || loading}
                className="px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 font-semibold disabled:opacity-50"
              >
                Copy
              </button>
              <button
                onClick={() => copyText(escapeForTelegramMarkdownV2(message))}
                disabled={!message || loading}
                className="px-4 py-2 rounded-lg border border-slate-700 disabled:opacity-50"
              >
                Copy (Telegram MarkdownV2)
              </button>
              <button
                onClick={() => setValues({})}
                className="px-4 py-2 rounded-lg border border-slate-700 disabled:opacity-50"
                disabled={loading}
              >
                Clear
              </button>
            </div>
          </div>
        </section>

        
      </main>
    </div>
  );
}