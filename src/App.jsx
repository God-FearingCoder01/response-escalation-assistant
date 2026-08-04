import { useEffect, useState, useMemo } from "react";

const DEFAULT_TEMPLATES = [
  { id: 1, name: "Withdrawal Delay", body: "Hi {customer_name}, your withdrawal {reference_no} is under review. ETA: {eta}." },
  { id: 2, name: "KYC Pending", body: "Hi {customer_name}, your account verification is still pending. Please upload: {required_docs}." },
  { id: 3, name: "Bonus Not Received", body: "Hi {customer_name}, we checked your bonus request for promo {promo_code}. Status: {status}." }
];

const STORAGE_KEY = "rea_templates_v1";

export default function App() {
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? null);
  const [editName, setEditName] = useState("");
  const [editBody, setEditBody] = useState("");
  const [values, setValues] = useState({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setTemplates(JSON.parse(raw));
    } catch (e) {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    } catch (e) {
      /* ignore */
    }
  }, [templates]);

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

  function upsertTemplate(id, name, body) {
    if (id == null) {
      const next = { id: Date.now(), name: name || "New Template", body: body || "" };
      setTemplates((s) => [next, ...s]);
      setSelectedId(next.id);
    } else {
      setTemplates((s) => s.map((t) => (t.id === id ? { ...t, name, body } : t)));
    }
  }

  function deleteTemplate(id) {
    setTemplates((s) => s.filter((t) => t.id !== id));
    setSelectedId((prev) => {
      if (prev === id) return templates[0]?.id ?? null;
      return prev;
    });
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
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-cyan-400">
          Response & Escalation Assistant
        </h1>
        <p className="text-slate-400 mt-1">
          Starter workspace (React + Tailwind + CI)
        </p>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <section className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Templates</h2>
            <div className="flex gap-2">
              <button
                onClick={() => upsertTemplate(null, "New template", "Hi {customer_name}, ")}
                className="px-3 py-1 rounded bg-cyan-600 text-slate-900 text-sm"
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
                    className="px-2 py-1 rounded border border-slate-700 text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteTemplate(t.id)}
                    className="px-2 py-1 rounded border border-red-600 text-sm text-red-400"
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
                className="px-3 py-2 rounded bg-cyan-500 text-slate-900 font-semibold"
              >
                Save
              </button>
              <button
                onClick={() => { setEditName(templates[0]?.name ?? ""); setEditBody(templates[0]?.body ?? ""); setSelectedId(templates[0]?.id ?? null); }}
                className="px-3 py-2 rounded border border-slate-700"
              >
                Reset
              </button>
            </div>
          </div>
        </section>

        <section className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h2 className="font-semibold mb-3">Message Builder (MVP)</h2>
          <div className="space-y-3">
            <div className="flex gap-2">
              <label className="text-sm text-slate-400">Template:</label>
              <select value={selectedId ?? ""} onChange={(e) => setSelectedId(Number(e.target.value))} className="bg-slate-950 border border-slate-800 rounded-lg p-2 flex-1">
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
                disabled={!message}
                className="px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 font-semibold disabled:opacity-50"
              >
                Copy
              </button>
              <button
                onClick={() => copyText(escapeForTelegramMarkdownV2(message))}
                disabled={!message}
                className="px-4 py-2 rounded-lg border border-slate-700 disabled:opacity-50"
              >
                Copy (Telegram MarkdownV2)
              </button>
              <button
                onClick={() => { setValues({}); navigator.clipboard?.writeText(""); }}
                className="px-4 py-2 rounded-lg border border-slate-700"
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