import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const THEME_KEY = "rea_theme_v1";
const AGENT_KEY = "rea_active_agent_v1";

const DEFAULT_TEMPLATES = [
  {
    id: 1,
    name: "Self Exclusion",
    body: "Account {customer_name} is requesting to be removed from self exclusion.",
  },
  {
    id: 2,
    name: "Account Verification",
    body: "Account {account_number} is facing error code 146, kindly assist.",
  },
  {
    id: 3,
    name: "Permanent Deactivation",
    body: "User {account_number} has requested for the permanent deactivation of his account because {reason}.",
  },
  {
    id: 4,
    name: "Processing Withdrawal",
    body: "Processing withdrawal of ${amount} from account number {account_number}; on {day}.{month}.2026 time {time}hrs.",
  },
];

const DEFAULT_AGENTS = [
  { id: 1, agent: "Vuyo Ndlovu", agent_name: "Vuyo", agent_initials: "VN", is_admin: true },
  { id: 2, agent: "Kilian D", agent_name: "Kilian", agent_initials: "KD", is_admin: false },
  { id: 3, agent: "Thembi Sibanda", agent_name: "Thembi", agent_initials: "TS", is_admin: false },
  { id: 4, agent: "Kudzi Honde", agent_name: "Kudzi", agent_initials: "KH", is_admin: false },
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
      "--sidebar-bg": "rgba(8,16,8,0.95)",
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
      "--sidebar-bg": "rgba(247,243,234,0.95)",
    },
  },
};

export default function App() {
  const [templates, setTemplates] = useState([]);
  const [agents, setAgents] = useState([]);
  const [currentAgent, setCurrentAgent] = useState(() => {
    if (typeof window === "undefined") return null;
    const stored = window.localStorage.getItem(AGENT_KEY);
    return stored ? JSON.parse(stored) : null;
  });
  const [activeScreen, setActiveScreen] = useState(() => (currentAgent ? "builder" : "welcome"));

  const [selectedId, setSelectedId] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState("whatsapp"); // whatsapp | livechat | telegram

  // Edit template form states (Admin)
  const [editTplId, setEditTplId] = useState(null);
  const [editTplName, setEditTplName] = useState("");
  const [editTplBody, setEditTplBody] = useState("");

  // Edit agent form states (Admin)
  const [editAgentId, setEditAgentId] = useState(null);
  const [editAgentName, setEditAgentName] = useState("");
  const [editAgentInitials, setEditAgentInitials] = useState("");
  const [editAgentIsAdmin, setEditAgentIsAdmin] = useState(false);

  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [apiStatus, setApiStatus] = useState("checking");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);

  const [themeMode, setThemeMode] = useState(() => {
    if (typeof window === "undefined") return "night";
    return window.localStorage.getItem(THEME_KEY) ?? "night";
  });

  const theme = THEMES[themeMode] ?? THEMES.night;
  const fileRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(THEME_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (currentAgent) {
      window.localStorage.setItem(AGENT_KEY, JSON.stringify(currentAgent));
    } else {
      window.localStorage.removeItem(AGENT_KEY);
    }
  }, [currentAgent]);

  // Initial Data Fetch
  useEffect(() => {
    let mounted = true;
    async function loadData() {
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

        // Fetch templates & agents
        const [tplRes, agentRes] = await Promise.all([
          fetch(`${API_BASE}/templates`),
          fetch(`${API_BASE}/agents`),
        ]);

        if (!tplRes.ok) throw new Error(`Failed to load templates (${tplRes.status})`);
        const tplData = await tplRes.json();

        let agentData = [];
        if (agentRes.ok) {
          agentData = await agentRes.json();
        }

        if (!mounted) return;
        const normalizedTpls = Array.isArray(tplData) ? tplData : [];
        setTemplates(normalizedTpls);
        setSelectedId(normalizedTpls[0]?.id ?? null);

        const normalizedAgents = Array.isArray(agentData) && agentData.length > 0 ? agentData : DEFAULT_AGENTS;
        setAgents(normalizedAgents);
      } catch (err) {
        if (!mounted) return;
        setApiStatus("offline");
        setStatusMessage("Backend offline. Using built-in templates & agents.");
        setTemplates(DEFAULT_TEMPLATES);
        setSelectedId(DEFAULT_TEMPLATES[0]?.id ?? null);
        setAgents(DEFAULT_AGENTS);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  // Update selected agent profile & navigate
  function handleSelectAgent(agent) {
    setCurrentAgent(agent);
    setActiveScreen("builder");
  }

  function handleLogout() {
    setCurrentAgent(null);
    setActiveScreen("welcome");
  }

  // Refresh functions
  async function refreshTemplates(nextSelectedId = null) {
    if (apiStatus === "offline") return;
    const response = await fetch(`${API_BASE}/templates`);
    if (!response.ok) return;
    const data = await response.json();
    const normalized = Array.isArray(data) ? data : [];
    setTemplates(normalized);
    if (normalized.length > 0) {
      const activeId = nextSelectedId ?? selectedId;
      const exists = normalized.some((t) => t.id === activeId);
      setSelectedId(exists ? activeId : normalized[0].id);
    }
  }

  async function refreshAgents() {
    if (apiStatus === "offline") return;
    const response = await fetch(`${API_BASE}/agents`);
    if (!response.ok) return;
    const data = await response.json();
    if (Array.isArray(data)) setAgents(data);
  }

  // Template CRUD
  async function upsertTemplate(id, name, body) {
    setSaving(true);
    setError("");
    try {
      if (apiStatus === "offline") {
        if (id == null) {
          const next = { id: Date.now(), name, body };
          setTemplates((curr) => [next, ...curr]);
          setSelectedId(next.id);
        } else {
          setTemplates((curr) => curr.map((t) => (t.id === id ? { ...t, name, body } : t)));
        }
        setStatusMessage("Template saved locally");
        setEditTplId(null);
        setEditTplName("");
        setEditTplBody("");
        return;
      }

      if (id == null) {
        const response = await fetch(`${API_BASE}/templates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, body }),
        });
        if (!response.ok) throw new Error(`Create template failed (${response.status})`);
        const created = await response.json();
        setStatusMessage(`Template created: ${created.name}`);
        await refreshTemplates(created.id);
      } else {
        const response = await fetch(`${API_BASE}/templates/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, body }),
        });
        if (!response.ok) throw new Error(`Update template failed (${response.status})`);
        const updated = await response.json();
        setStatusMessage(`Template updated: ${updated.name}`);
        setTemplates((s) => s.map((t) => (t.id === id ? updated : t)));
      }
      setEditTplId(null);
      setEditTplName("");
      setEditTplBody("");
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
        setTemplates((curr) => curr.filter((t) => t.id !== id));
        setStatusMessage("Template deleted locally");
        return;
      }
      const response = await fetch(`${API_BASE}/templates/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(`Delete template failed (${response.status})`);
      setStatusMessage("Template deleted");
      await refreshTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete template");
    } finally {
      setSaving(false);
    }
  }

  // Agent CRUD
  async function upsertAgent(id, agent_name, agent_initials, is_admin) {
    setSaving(true);
    setError("");
    try {
      if (apiStatus === "offline") {
        if (id == null) {
          const next = { id: Date.now(), agent_name, agent_initials, is_admin };
          setAgents((curr) => [...curr, next]);
        } else {
          setAgents((curr) => curr.map((a) => (a.id === id ? { ...a, agent_name, agent_initials, is_admin } : a)));
        }
        setStatusMessage("Agent saved locally");
        setEditAgentId(null);
        setEditAgentName("");
        setEditAgentInitials("");
        setEditAgentIsAdmin(false);
        return;
      }

      if (id == null) {
        const response = await fetch(`${API_BASE}/agents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agent_name, agent_initials, is_admin }),
        });
        if (!response.ok) throw new Error(`Create agent failed (${response.status})`);
        const created = await response.json();
        setStatusMessage(`Agent created: ${created.agent_name}`);
        await refreshAgents();
      } else {
        const response = await fetch(`${API_BASE}/agents/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agent_name, agent_initials, is_admin }),
        });
        if (!response.ok) throw new Error(`Update agent failed (${response.status})`);
        const updated = await response.json();
        setStatusMessage(`Agent updated: ${updated.agent_name}`);
        setAgents((s) => s.map((a) => (a.id === id ? updated : a)));
      }
      setEditAgentId(null);
      setEditAgentName("");
      setEditAgentInitials("");
      setEditAgentIsAdmin(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save agent");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAgent(id) {
    setSaving(true);
    setError("");
    try {
      if (apiStatus === "offline") {
        setAgents((curr) => curr.filter((a) => a.id !== id));
        setStatusMessage("Agent deleted locally");
        return;
      }
      const response = await fetch(`${API_BASE}/agents/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(`Delete agent failed (${response.status})`);
      setStatusMessage("Agent deleted");
      await refreshAgents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete agent");
    } finally {
      setSaving(false);
    }
  }

  // Import/Export
  async function exportTemplates() {
    try {
      const blob = new Blob([JSON.stringify(templates, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "templates.json";
      a.click();
      URL.revokeObjectURL(url);
      setStatusMessage(`Exported ${templates.length} template(s)`);
    } catch (err) {
      setError("Failed to export templates");
    }
  }

  async function importTemplatesFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const items = JSON.parse(reader.result);
        if (apiStatus === "offline") {
          setTemplates(Array.isArray(items) ? items : []);
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
            const res = await r.json();
            setStatusMessage(res.message ?? "Imported templates");
            return refreshTemplates();
          })
          .catch((err) => setError(err instanceof Error ? err.message : "Import failed"));
      } catch (e) {
        setError("Invalid JSON file");
      }
    };
    reader.readAsText(file);
  }

  // Message builder calculations
  const placeholders = useMemo(() => {
    const t = templates.find((p) => p.id === selectedId);
    if (!t) return [];
    const set = new Set();
    const re = /\{([^}]+)\}/g;
    let m;
    while ((m = re.exec(t.body))) set.add(m[1]);
    return Array.from(set);
  }, [selectedId, templates]);

  function generateMessage() {
    const t = templates.find((p) => p.id === selectedId);
    if (!t) return "";
    let out = t.body;

    // Auto replacement map
    const autoMap = {
      agent_name: currentAgent?.agent_name ?? "",
      agent_initials: currentAgent?.agent_initials ?? "",
    };

    // Replace placeholders
    const allKeys = new Set([...Object.keys(autoMap), ...Object.keys(values)]);
    for (const key of allKeys) {
      const val = values[key] ?? autoMap[key] ?? "";
      const re = new RegExp(`\\{${key}\\}`, "g");
      out = out.replace(re, val);
    }

    // Channel specific rules from .ideas
    if (selectedChannel === "whatsapp") {
      const initials = currentAgent?.agent_initials ? ` - ${currentAgent.agent_initials}` : "";
      if (!out.endsWith(initials) && initials) {
        out = out.trim() + `${initials}`;
      }
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
    return s.replace(/([_\*\[\]\(\)`~>#+=\-|{}.!])/g, "\\$1");
  }

  const generatedMsg = generateMessage();

  return (
    <div
      className="relative min-h-screen overflow-x-hidden text-[var(--app-text)] transition-colors duration-300 flex"
      style={{ backgroundColor: "var(--app-bg)", ...theme.rootStyle }}
    >
      <div className="absolute inset-0 -z-10" style={{ backgroundImage: theme.overlay }} />

      {/* AUTO-EXPANDING HOVER SIDEBAR NAVIGATION */}
      {currentAgent && activeScreen !== "welcome" ? (
        <aside
          onMouseEnter={() => setIsSidebarHovered(true)}
          onMouseLeave={() => setIsSidebarHovered(false)}
          className={`fixed left-0 top-0 bottom-0 z-40 flex flex-col justify-between border-r p-3 shadow-2xl backdrop-blur transition-all duration-300 ease-in-out ${isSidebarHovered ? "w-64" : "w-16"
            }`}
          style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--sidebar-bg)" }}
        >
          <div className="space-y-6">
            {/* Logo / Header */}
            <div className="flex items-center gap-3 overflow-hidden px-1">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] font-bold text-[#071007] shadow-lg">
                REA
              </div>
              <span className={`font-bold text-lg whitespace-nowrap transition-opacity duration-200 ${isSidebarHovered ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                Assistant
              </span>
            </div>

            {/* Nav links */}
            <nav className="space-y-2">
              <button
                onClick={() => setActiveScreen("builder")}
                className={`flex w-full items-center gap-4 rounded-2xl px-3 py-3 text-left font-medium transition-all ${activeScreen === "builder"
                    ? "bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] shadow-md"
                    : "hover:bg-[var(--neutral-bg)] text-[var(--neutral-text)]"
                  }`}
                title="Message Builder"
              >
                <span className="text-xl shrink-0">💬</span>
                <span className={`whitespace-nowrap transition-opacity duration-200 ${isSidebarHovered ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                  Message Builder
                </span>
              </button>

              <button
                onClick={() => setActiveScreen("admin")}
                className={`flex w-full items-center gap-4 rounded-2xl px-3 py-3 text-left font-medium transition-all ${activeScreen === "admin"
                    ? "bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] shadow-md"
                    : "hover:bg-[var(--neutral-bg)] text-[var(--neutral-text)]"
                  }`}
                title="System Admin"
              >
                <span className="text-xl shrink-0">🛠️</span>
                <span className={`whitespace-nowrap transition-opacity duration-200 ${isSidebarHovered ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                  System Admin
                </span>
              </button>
            </nav>
          </div>

          {/* Sidebar Footer Controls */}
          <div className="space-y-3 pt-4 border-t" style={{ borderColor: "var(--panel-border)" }}>
            {/* Theme Toggle */}
            <button
              onClick={() => setThemeMode((c) => (c === "night" ? "day" : "night"))}
              className="flex w-full items-center gap-4 rounded-2xl p-2 transition hover:bg-[var(--neutral-bg)] text-sm"
              title={`Switch to ${themeMode === "night" ? "Day" : "Night"} mode`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-sm" style={{ borderColor: "var(--badge-border)" }}>
                {themeMode === "night" ? "🌙" : "☀️"}
              </span>
              <span className={`whitespace-nowrap transition-opacity duration-200 ${isSidebarHovered ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                {themeMode === "night" ? "Night Mode" : "Day Mode"}
              </span>
            </button>

            {/* Profile badge & logout */}
            <div className="flex items-center gap-3 overflow-hidden p-1">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#32324a_0%,#11111e_100%)] text-xs font-bold text-[#4cd34c] border" style={{ borderColor: "var(--badge-border)" }}>
                {currentAgent.agent_initials}
              </div>
              <div className={`overflow-hidden whitespace-nowrap transition-opacity duration-200 ${isSidebarHovered ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                <div className="text-xs font-semibold truncate">{currentAgent.agent_name}</div>
                <button onClick={handleLogout} className="text-[10px] text-[#4cd34c] hover:underline block mt-0.5">
                  Switch Profile ↩
                </button>
              </div>
            </div>
          </div>
        </aside>
      ) : null}

      {/* MAIN CONTENT CONTAINER */}
      <div className={`flex-1 p-6 transition-all duration-300 ${currentAgent && activeScreen !== "welcome" ? "ml-16" : ""}`}>
        {/* TOP STATUS BAR */}
        <header className="mb-6 flex flex-col gap-4 rounded-3xl border p-4 shadow-[var(--panel-shadow)] backdrop-blur md:flex-row md:items-center md:justify-between" style={{ borderColor: "var(--header-border)", backgroundColor: "var(--header-bg)" }}>
          <div className="flex items-center gap-4">
            <div>
              <div className="mb-1 inline-flex rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em]" style={{ borderColor: "var(--badge-border)", backgroundColor: "var(--badge-bg)", color: "var(--badge-text)" }}>
                RESPONSE & ESCALATION ASSISTANT
              </div>
              <h1 className="text-2xl font-bold md:text-3xl" style={{ color: "var(--header-text)" }}>
                {activeScreen === "welcome" ? "Welcome Portal" : activeScreen === "admin" ? "System Admin Dashboard" : "Message Builder"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm" style={{ color: "var(--header-muted)" }}>
            <span className={`h-2.5 w-2.5 rounded-full ${apiStatus === "checking" ? "bg-[#f1c84b]" : apiStatus === "offline" ? "bg-[#b83838]" : "bg-[#4cd34c]"}`} />
            <span>{loading ? "Connecting..." : apiStatus === "offline" ? "Offline Mode" : "Backend Connected"}</span>

            {currentAgent ? (
              <div className="ml-3 flex items-center gap-2 rounded-full border px-3 py-1 text-xs" style={{ borderColor: "var(--badge-border)", backgroundColor: "var(--badge-bg)" }}>
                <span>Signed in:</span>
                <strong className="text-[#4cd34c]">{currentAgent.agent_name} ({currentAgent.agent_initials})</strong>
              </div>
            ) : null}
          </div>
        </header>

        {statusMessage && apiStatus !== "offline" ? (
          <div className="mb-4 rounded-2xl border px-4 py-2.5 text-sm backdrop-blur" style={{ borderColor: "var(--status-border)", backgroundColor: "var(--status-bg)", color: "var(--app-text)" }}>
            {statusMessage}
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--error-border)", backgroundColor: "var(--error-bg)", color: "var(--error-text)" }}>
            {error}
          </div>
        ) : null}

        {/* SCREEN 1: WELCOME & AGENT SELECTION SCREEN */}
        {activeScreen === "welcome" || !currentAgent ? (
          <section className="max-w-6xl mx-auto py-8">
            <div className="text-center mb-10">
              <span className="inline-block rounded-full border px-4 py-1 text-xs uppercase tracking-widest mb-3" style={{ borderColor: "var(--badge-border)", backgroundColor: "var(--badge-bg)", color: "var(--badge-text)" }}>
                AGENT AUTHENTICATION
              </span>
              <h2 className="text-3xl font-extrabold md:text-4xl mb-3" style={{ color: "var(--app-text)" }}>
                Select Your Agent Profile
              </h2>
              <p className="max-w-xl mx-auto text-base" style={{ color: "var(--text-muted)" }}>
                Welcome to the Escalation Assistant. Please choose your agent profile below to enter the system.
              </p>
            </div>

            {/* BLOCK CARDS: THREE IN A ROW GRID */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  onClick={() => handleSelectAgent(agent)}
                  className="group cursor-pointer rounded-3xl border p-6 shadow-[var(--panel-shadow)] backdrop-blur transition-all duration-300 hover:-translate-y-1.5 hover:border-[#4cd34c] flex flex-col justify-between relative overflow-hidden"
                  style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}
                >
                  <div className="absolute top-0 right-0 h-24 w-24 bg-[radial-gradient(circle,rgba(76,211,76,0.15)_0%,transparent_70%)] pointer-events-none group-hover:scale-150 transition-transform" />

                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#32324a_0%,#11111e_100%)] text-lg font-bold text-[#4cd34c] border shadow-md group-hover:scale-110 transition-transform" style={{ borderColor: "var(--badge-border)" }}>
                        {agent.agent_initials}
                      </div>
                      {agent.is_admin ? (
                        <span className="rounded-full border px-2.5 py-0.5 text-[10px] uppercase font-bold tracking-wider text-[#f1c84b] border-[#f1c84b]/40 bg-[#f1c84b]/10">
                          System Admin
                        </span>
                      ) : (
                        <span className="rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-[var(--text-muted)]" style={{ borderColor: "var(--badge-border)" }}>
                          Support Agent
                        </span>
                      )}
                    </div>

                    <h3 className="text-xl font-bold mb-1" style={{ color: "var(--app-text)" }}>
                      {agent.agent_name}
                    </h3>
                    <p className="text-xs mb-6" style={{ color: "var(--text-muted)" }}>
                      Initials Code: <code className="text-[#4cd34c] font-semibold">{agent.agent_initials}</code>
                    </p>
                  </div>

                  <button
                    type="button"
                    className="w-full rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] py-2.5 text-center text-sm font-semibold text-[#071007] shadow-lg group-hover:shadow-[0_8px_25px_rgba(15,155,0,0.4)] transition-all"
                  >
                    Sign In as Profile →
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* SCREEN 2: MESSAGE BUILDER SCREEN */}
        {currentAgent && activeScreen === "builder" ? (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto">
            {/* Left Panel: Template & Inputs */}
            <div className="lg:col-span-7 rounded-3xl border p-6 shadow-[var(--panel-shadow)] backdrop-blur space-y-5" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold" style={{ color: "var(--app-text)" }}>
                  Build Escalation Response
                </h2>
                <div className="text-xs rounded-full border px-3 py-1" style={{ borderColor: "var(--badge-border)", color: "var(--badge-text)" }}>
                  Agent: <strong className="text-[#4cd34c]">{currentAgent.agent_name} ({currentAgent.agent_initials})</strong>
                </div>
              </div>

              {/* Channel Selector */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: "var(--text-muted)" }}>
                  Select Output Target Channel:
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedChannel("whatsapp")}
                    className={`rounded-xl border py-2.5 px-3 text-sm font-medium transition flex items-center justify-center gap-2 ${selectedChannel === "whatsapp"
                        ? "border-[#4cd34c] bg-[#4cd34c]/10 text-[#4cd34c] font-bold shadow-sm"
                        : "hover:bg-[var(--neutral-bg)]"
                      }`}
                    style={{ borderColor: selectedChannel === "whatsapp" ? "#4cd34c" : "var(--field-border)" }}
                  >
                    <span>💬 WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedChannel("livechat")}
                    className={`rounded-xl border py-2.5 px-3 text-sm font-medium transition flex items-center justify-center gap-2 ${selectedChannel === "livechat"
                        ? "border-[#4cd34c] bg-[#4cd34c]/10 text-[#4cd34c] font-bold shadow-sm"
                        : "hover:bg-[var(--neutral-bg)]"
                      }`}
                    style={{ borderColor: selectedChannel === "livechat" ? "#4cd34c" : "var(--field-border)" }}
                  >
                    <span>🎧 Live Chat</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedChannel("telegram")}
                    className={`rounded-xl border py-2.5 px-3 text-sm font-medium transition flex items-center justify-center gap-2 ${selectedChannel === "telegram"
                        ? "border-[#4cd34c] bg-[#4cd34c]/10 text-[#4cd34c] font-bold shadow-sm"
                        : "hover:bg-[var(--neutral-bg)]"
                      }`}
                    style={{ borderColor: selectedChannel === "telegram" ? "#4cd34c" : "var(--field-border)" }}
                  >
                    <span>✈️ Telegram</span>
                  </button>
                </div>
              </div>

              {/* Template Picker */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: "var(--text-muted)" }}>
                  Select Response Template:
                </label>
                <select
                  value={selectedId ?? ""}
                  onChange={(e) => setSelectedId(Number(e.target.value))}
                  className="w-full rounded-xl border p-3 font-medium text-sm"
                  style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dynamic Placeholders */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                  Message Parameters:
                </h3>

                {placeholders.length === 0 ? (
                  <p className="text-xs italic p-3 rounded-xl border" style={{ borderColor: "var(--field-border)", color: "var(--text-muted)" }}>
                    This template contains no customizable fields.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {placeholders.map((ph) => {
                      const isAgentField = ph === "agent_name" || ph === "agent_initials";
                      return (
                        <div key={ph}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs capitalize" style={{ color: "var(--text-muted)" }}>
                              {ph.replace("_", " ")}:
                            </span>
                            {isAgentField ? (
                              <span className="text-[10px] text-[#4cd34c] font-semibold">Auto-filled from profile</span>
                            ) : null}
                          </div>
                          <input
                            value={values[ph] ?? (isAgentField ? (ph === "agent_name" ? currentAgent.agent_name : currentAgent.agent_initials) : "")}
                            onChange={(e) => setValues((s) => ({ ...s, [ph]: e.target.value }))}
                            placeholder={`Enter ${ph.replace("_", " ")}`}
                            className="w-full rounded-xl border p-2.5 text-sm placeholder:text-[var(--field-placeholder)]"
                            style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel: Live Message Preview */}
            <div className="lg:col-span-5 rounded-3xl border p-6 shadow-[var(--panel-shadow)] backdrop-blur flex flex-col justify-between" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold" style={{ color: "var(--app-text)" }}>
                    Live Preview
                  </h2>
                  <span className="text-xs uppercase font-semibold text-[#4cd34c] bg-[#4cd34c]/10 border border-[#4cd34c]/30 px-2.5 py-0.5 rounded-full">
                    {selectedChannel} Target
                  </span>
                </div>

                <div className="rounded-2xl border p-4 min-h-[12rem] whitespace-pre-wrap font-mono text-sm leading-relaxed" style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}>
                  {generatedMsg || <span style={{ color: "var(--field-placeholder)" }}>Select a template to preview message...</span>}
                </div>

                {selectedChannel === "whatsapp" ? (
                  <p className="text-xs italic" style={{ color: "var(--text-muted)" }}>
                    💡 WhatsApp channel format automatically appends agent initials signature <code className="text-[#4cd34c]">{currentAgent.agent_initials}</code>.
                  </p>
                ) : selectedChannel === "telegram" ? (
                  <p className="text-xs italic" style={{ color: "var(--text-muted)" }}>
                    💡 Telegram channel format applies MarkdownV2 special character escaping.
                  </p>
                ) : null}
              </div>

              <div className="space-y-2 mt-6">
                <button
                  type="button"
                  onClick={() => copyText(selectedChannel === "telegram" ? escapeForTelegramMarkdownV2(generatedMsg) : generatedMsg)}
                  disabled={!generatedMsg}
                  className="w-full rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] py-3 font-semibold text-[#071007] shadow-lg disabled:opacity-50 transition"
                >
                  Copy Formatted Message
                </button>
                <button
                  type="button"
                  onClick={() => setValues({})}
                  className="w-full rounded-xl border py-2.5 text-sm font-medium transition"
                  style={{ borderColor: "var(--badge-border)", color: "var(--neutral-text)", backgroundColor: "var(--neutral-bg)" }}
                >
                  Clear Parameter Inputs
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {/* SCREEN 3: SYSTEM ADMIN SCREEN */}
        {currentAgent && activeScreen === "admin" ? (
          <section className="max-w-7xl mx-auto space-y-8">
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--panel-border)" }}>
              <div>
                <h2 className="text-2xl font-bold" style={{ color: "var(--app-text)" }}>
                  System Admin Control Panel
                </h2>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Manage global response templates and agent credentials.
                </p>
              </div>
              <span className="rounded-full border px-3 py-1 text-xs uppercase font-bold tracking-wider text-[#f1c84b] border-[#f1c84b]/40 bg-[#f1c84b]/10">
                Admin Privilege Mode
              </span>
            </div>

            {/* SECTION 1: TEMPLATE MANAGEMENT */}
            <div className="rounded-3xl border p-6 shadow-[var(--panel-shadow)] backdrop-blur space-y-6" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold" style={{ color: "var(--app-text)" }}>
                  1. Message Template Management
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={exportTemplates}
                    className="px-3 py-1.5 rounded-xl border text-xs font-semibold"
                    style={{ borderColor: "var(--badge-border)", color: "var(--neutral-text)", backgroundColor: "var(--neutral-bg)" }}
                  >
                    Export JSON
                  </button>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl border text-xs font-semibold"
                    style={{ borderColor: "var(--badge-border)", color: "var(--neutral-text)", backgroundColor: "var(--neutral-bg)" }}
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

              {/* Create/Edit Form */}
              <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--field-bg)" }}>
                <h4 className="text-xs uppercase font-semibold" style={{ color: "var(--text-muted)" }}>
                  {editTplId ? `Edit Template #${editTplId}` : "Create New Template"}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    value={editTplName}
                    onChange={(e) => setEditTplName(e.target.value)}
                    placeholder="Template Name (e.g., Withdrawal Delay)"
                    className="w-full rounded-xl border p-2.5 text-sm"
                    style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                  />
                  <input
                    value={editTplBody}
                    onChange={(e) => setEditTplBody(e.target.value)}
                    placeholder="Body text with {placeholders}"
                    className="w-full md:col-span-2 rounded-xl border p-2.5 text-sm"
                    style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => upsertTemplate(editTplId, editTplName, editTplBody)}
                    disabled={!editTplName || !editTplBody || saving}
                    className="px-4 py-2 rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] text-sm font-semibold shadow-md disabled:opacity-50"
                  >
                    {saving ? "Saving..." : editTplId ? "Save Changes" : "Add Template"}
                  </button>
                  {editTplId ? (
                    <button
                      onClick={() => {
                        setEditTplId(null);
                        setEditTplName("");
                        setEditTplBody("");
                      }}
                      className="px-4 py-2 rounded-xl border text-sm"
                      style={{ borderColor: "var(--badge-border)" }}
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Template List */}
              <div className="space-y-3">
                {templates.map((t) => (
                  <div key={t.id} className="rounded-2xl border p-4 flex items-center justify-between transition hover:border-[#4cd34c]/50" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--field-bg)" }}>
                    <div>
                      <div className="font-bold text-base">{t.name}</div>
                      <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                        {t.body}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setEditTplId(t.id);
                          setEditTplName(t.name);
                          setEditTplBody(t.body);
                        }}
                        className="px-3 py-1.5 rounded-xl border text-xs font-semibold"
                        style={{ borderColor: "var(--badge-border)" }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteTemplate(t.id)}
                        className="px-3 py-1.5 rounded-xl border text-xs font-semibold"
                        style={{ borderColor: "var(--error-border)", color: "var(--error-text)" }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 2: AGENT CONTROL MANAGEMENT */}
            <div className="rounded-3xl border p-6 shadow-[var(--panel-shadow)] backdrop-blur space-y-6" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}>
              <h3 className="text-lg font-bold" style={{ color: "var(--app-text)" }}>
                2. Agent Profile Control
              </h3>

              {/* Create/Edit Agent Form */}
              <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--field-bg)" }}>
                <h4 className="text-xs uppercase font-semibold" style={{ color: "var(--text-muted)" }}>
                  {editAgentId ? `Edit Agent Profile #${editAgentId}` : "Add New Agent Profile"}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    value={editAgentName}
                    onChange={(e) => setEditAgentName(e.target.value)}
                    placeholder="Full Agent Name (e.g., Sarah Smith)"
                    className="w-full rounded-xl border p-2.5 text-sm"
                    style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                  />
                  <input
                    value={editAgentInitials}
                    onChange={(e) => setEditAgentInitials(e.target.value)}
                    placeholder="Initials (e.g., SS)"
                    className="w-full rounded-xl border p-2.5 text-sm uppercase"
                    maxLength={4}
                    style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                  />
                  <label className="flex items-center gap-2 text-sm cursor-pointer px-2">
                    <input
                      type="checkbox"
                      checked={editAgentIsAdmin}
                      onChange={(e) => setEditAgentIsAdmin(e.target.checked)}
                      className="rounded accent-[#4cd34c] h-4 w-4"
                    />
                    <span>Grant System Admin Privileges</span>
                  </label>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => upsertAgent(editAgentId, editAgentName, editAgentInitials, editAgentIsAdmin)}
                    disabled={!editAgentName || !editAgentInitials || saving}
                    className="px-4 py-2 rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] text-sm font-semibold shadow-md disabled:opacity-50"
                  >
                    {saving ? "Saving..." : editAgentId ? "Save Agent Changes" : "Create Agent"}
                  </button>
                  {editAgentId ? (
                    <button
                      onClick={() => {
                        setEditAgentId(null);
                        setEditAgentName("");
                        setEditAgentInitials("");
                        setEditAgentIsAdmin(false);
                      }}
                      className="px-4 py-2 rounded-xl border text-sm"
                      style={{ borderColor: "var(--badge-border)" }}
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Agent List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {agents.map((agent) => (
                  <div key={agent.id} className="rounded-2xl border p-4 flex items-center justify-between" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--field-bg)" }}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#32324a_0%,#11111e_100%)] text-xs font-bold text-[#4cd34c] border" style={{ borderColor: "var(--badge-border)" }}>
                        {agent.agent_initials}
                      </div>
                      <div>
                        <div className="font-bold text-sm">{agent.agent_name}</div>
                        <div className="text-xs text-[#4cd34c]">{agent.is_admin ? "System Admin" : "Support Agent"}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditAgentId(agent.id);
                          setEditAgentName(agent.agent_name);
                          setEditAgentInitials(agent.agent_initials);
                          setEditAgentIsAdmin(agent.is_admin);
                        }}
                        className="px-3 py-1.5 rounded-xl border text-xs font-semibold"
                        style={{ borderColor: "var(--badge-border)" }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteAgent(agent.id)}
                        className="px-3 py-1.5 rounded-xl border text-xs font-semibold"
                        style={{ borderColor: "var(--error-border)", color: "var(--error-text)" }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}