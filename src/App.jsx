import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const THEME_KEY = "rea_theme_v1";
const AGENT_KEY = "rea_active_agent_v1";

const DEFAULT_TEMPLATES = [
  // Tech Escalation Templates
  {
    id: 1,
    name: "Self Exclusion Request",
    body: "Account {customer_name} is requesting to be removed from self exclusion. #{agent_name}",
    category_type: "tech_escalation",
    category: "Account Escalations",
    subcategory: "Self Exclusion",
  },
  {
    id: 2,
    name: "Account Verification Error 146",
    body: "Account {account_number} is facing error code 146, kindly assist. #{agent_name}",
    category_type: "tech_escalation",
    category: "Account Escalations",
    subcategory: "Verification",
  },
  {
    id: 3,
    name: "Permanent Deactivation Request",
    body: "User {account_number} has requested for the permanent deactivation of his account because {reason}. #{agent_name}",
    category_type: "tech_escalation",
    category: "Account Escalations",
    subcategory: "Deactivation",
  },
  {
    id: 4,
    name: "Withdrawal Processing Escalation",
    body: "Processing withdrawal of ${amount} from account number {account_number}; on {day}.{month}.2026 time {time}hrs. #{agent_name}",
    category_type: "tech_escalation",
    category: "Payment Escalations",
    subcategory: "Withdrawal",
  },
  // Customer Reply Templates
  {
    id: 5,
    name: "Standard Welcome Greeting",
    body: "Hi {customer_name}, my name is {agent_name} from Customer Support. How may I assist you today?",
    category_type: "customer_reply",
    category: "Agent Introductions",
    subcategory: "Welcome",
  },
  {
    id: 6,
    name: "Follow-up Response Greeting",
    body: "Hello {customer_name}, thank you for reaching back out. I'm {agent_name} and I'll be glad to continue assisting you.",
    category_type: "customer_reply",
    category: "Agent Introductions",
    subcategory: "Follow-up",
  },
  {
    id: 7,
    name: "Deposit Under Review",
    body: "Hi {customer_name}, your deposit of ${amount} is currently being processed by our financial partner. Reference: {reference_no}.",
    category_type: "customer_reply",
    category: "Transactions",
    subcategory: "Deposit",
  },
  {
    id: 8,
    name: "Withdrawal Status Update",
    body: "Hi {customer_name}, your withdrawal request for ${amount} (Ref: {reference_no}) has been approved and sent to your account.",
    category_type: "customer_reply",
    category: "Transactions",
    subcategory: "Withdrawal",
  },
  {
    id: 9,
    name: "Password Reset Instructions",
    body: "Hi {customer_name}, a password reset link has been dispatched to your registered email address. Please follow the instructions to secure your account.",
    category_type: "customer_reply",
    category: "Security",
    subcategory: "Password Reset",
  },
  {
    id: 10,
    name: "KYC Document Request",
    body: "Hi {customer_name}, to complete your account verification, please upload your proof of ID and address in the portal.",
    category_type: "customer_reply",
    category: "Security",
    subcategory: "Verification",
  },
  {
    id: 11,
    name: "Game Cache Troubleshooting",
    body: "Hi {customer_name}, if you're experiencing display issues with {game_title}, please clear your browser cache or switch to Google Chrome.",
    category_type: "customer_reply",
    category: "Games",
    subcategory: "Troubleshooting",
  },
];

const DEFAULT_AGENTS = [
  { id: 1, agent: "Vuyo Ndlovu", agent_name: "Vuyo", agent_initials: "VN", is_admin: false },
  { id: 2, agent: "Kilian D", agent_name: "Kilian", agent_initials: "KD", is_admin: false },
  { id: 3, agent: "Thembi Sibanda", agent_name: "Thembi", agent_initials: "TS", is_admin: false },
  { id: 4, agent: "Kudzi Honde", agent_name: "Kudzi", agent_initials: "KH", is_admin: false },
  { id: 5, agent: "System Admin", agent_name: "System Admin", agent_initials: "SA", is_admin: true },
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

// Auto generate initials helper from name
function generateInitials(name) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return parts.map((p) => p[0]).join("").slice(0, 3).toUpperCase();
}

export default function App() {
  const [templates, setTemplates] = useState([]);
  const [agents, setAgents] = useState([]);
  const [currentAgent, setCurrentAgent] = useState(() => {
    if (typeof window === "undefined") return null;
    const stored = window.localStorage.getItem(AGENT_KEY);
    return stored ? JSON.parse(stored) : null;
  });

  // activeScreen: "welcome" | "tech_escalation" | "customer_reply" | "admin"
  const [activeScreen, setActiveScreen] = useState(() => (currentAgent ? "tech_escalation" : "welcome"));

  // Tech Escalation selections
  const [selectedTechId, setSelectedTechId] = useState(null);

  // Customer Reply selections & filters
  const [selectedCustId, setSelectedCustId] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedSubcategory, setSelectedSubcategory] = useState("All");
  const [replyChannel, setReplyChannel] = useState("whatsapp"); // "whatsapp" | "livechat"
  const [searchQuery, setSearchQuery] = useState("");

  // Edit template form states (Admin)
  const [editTplId, setEditTplId] = useState(null);
  const [editTplName, setEditTplName] = useState("");
  const [editTplBody, setEditTplBody] = useState("");
  const [editTplType, setEditTplType] = useState("tech_escalation"); // "tech_escalation" | "customer_reply"
  const [editTplCat, setEditTplCat] = useState("");
  const [editTplSubcat, setEditTplSubcat] = useState("");

  // Edit agent form states (Admin)
  const [editAgentId, setEditAgentId] = useState(null);
  const [editAgentFullName, setEditAgentFullName] = useState("");
  const [editAgentName, setEditAgentName] = useState("");
  const [editAgentInitials, setEditAgentInitials] = useState("");
  const [editAgentIsAdmin, setEditAgentIsAdmin] = useState(false);
  const [userCustomizedInitials, setUserCustomizedInitials] = useState(false);

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

  // Non-admin redirect guard
  useEffect(() => {
    if (currentAgent && !currentAgent.is_admin && activeScreen === "admin") {
      setActiveScreen("tech_escalation");
    }
  }, [currentAgent, activeScreen]);

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
        const normalizedTpls = Array.isArray(tplData) && tplData.length > 0 ? tplData : DEFAULT_TEMPLATES;
        setTemplates(normalizedTpls);

        // Select initial Tech Escalation template
        const techTpls = normalizedTpls.filter((t) => t.category_type === "tech_escalation");
        setSelectedTechId(techTpls[0]?.id ?? normalizedTpls[0]?.id ?? null);

        // Select initial Customer Reply template
        const custTpls = normalizedTpls.filter((t) => t.category_type === "customer_reply");
        setSelectedCustId(custTpls[0]?.id ?? null);

        const normalizedAgents = Array.isArray(agentData) && agentData.length > 0 ? agentData : DEFAULT_AGENTS;
        setAgents(normalizedAgents);

        // Reset stale active agent if not in current agent list
        if (currentAgent && !normalizedAgents.some((a) => a.agent_initials === currentAgent.agent_initials)) {
          setCurrentAgent(null);
          setActiveScreen("welcome");
        }
      } catch (err) {
        if (!mounted) return;
        setApiStatus("offline");
        setStatusMessage("Backend offline. Using built-in templates & agents.");
        setTemplates(DEFAULT_TEMPLATES);
        const techTpls = DEFAULT_TEMPLATES.filter((t) => t.category_type === "tech_escalation");
        setSelectedTechId(techTpls[0]?.id ?? null);
        const custTpls = DEFAULT_TEMPLATES.filter((t) => t.category_type === "customer_reply");
        setSelectedCustId(custTpls[0]?.id ?? null);
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
    setActiveScreen("tech_escalation");
  }

  function handleLogout() {
    setCurrentAgent(null);
    setActiveScreen("welcome");
  }

  // Auto-generate initials on name change if user hasn't typed custom initials
  function handleAgentFullNameChange(val) {
    setEditAgentFullName(val);
    if (!editAgentName) {
      setEditAgentName(val.split(" ")[0] || val);
    }
    if (!userCustomizedInitials) {
      setEditAgentInitials(generateInitials(val));
    }
  }

  function handleAgentNameChange(val) {
    setEditAgentName(val);
    if (!userCustomizedInitials && !editAgentFullName) {
      setEditAgentInitials(generateInitials(val));
    }
  }

  // Refresh functions
  async function refreshTemplates() {
    if (apiStatus === "offline") return;
    const response = await fetch(`${API_BASE}/templates`);
    if (!response.ok) return;
    const data = await response.json();
    const normalized = Array.isArray(data) ? data : [];
    setTemplates(normalized);
  }

  async function refreshAgents() {
    if (apiStatus === "offline") return;
    const response = await fetch(`${API_BASE}/agents`);
    if (!response.ok) return;
    const data = await response.json();
    if (Array.isArray(data)) setAgents(data);
  }

  // Template CRUD
  async function upsertTemplate(id, name, body, category_type, category, subcategory) {
    setSaving(true);
    setError("");
    try {
      const payload = {
        name,
        body,
        category_type,
        category: category || null,
        subcategory: subcategory || null,
      };

      if (apiStatus === "offline") {
        if (id == null) {
          const next = { id: Date.now(), ...payload };
          setTemplates((curr) => [next, ...curr]);
        } else {
          setTemplates((curr) => curr.map((t) => (t.id === id ? { ...t, ...payload } : t)));
        }
        setStatusMessage("Template saved locally");
        resetTemplateForm();
        return;
      }

      if (id == null) {
        const response = await fetch(`${API_BASE}/templates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error(`Create template failed (${response.status})`);
        const created = await response.json();
        setStatusMessage(`Template created: ${created.name}`);
        await refreshTemplates();
      } else {
        const response = await fetch(`${API_BASE}/templates/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error(`Update template failed (${response.status})`);
        const updated = await response.json();
        setStatusMessage(`Template updated: ${updated.name}`);
        setTemplates((s) => s.map((t) => (t.id === id ? updated : t)));
      }
      resetTemplateForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  function resetTemplateForm() {
    setEditTplId(null);
    setEditTplName("");
    setEditTplBody("");
    setEditTplType("tech_escalation");
    setEditTplCat("");
    setEditTplSubcat("");
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
  async function upsertAgent(id, agent, agent_name, agent_initials, is_admin) {
    setSaving(true);
    setError("");
    try {
      const payload = {
        agent: agent || agent_name,
        agent_name,
        agent_initials: agent_initials.toUpperCase(),
        is_admin,
      };

      if (apiStatus === "offline") {
        if (id == null) {
          const next = { id: Date.now(), ...payload };
          setAgents((curr) => [...curr, next]);
        } else {
          setAgents((curr) => curr.map((a) => (a.id === id ? { ...a, ...payload } : a)));
        }
        setStatusMessage("Agent saved locally");
        resetAgentForm();
        return;
      }

      if (id == null) {
        const response = await fetch(`${API_BASE}/agents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error(`Create agent failed (${response.status})`);
        const created = await response.json();
        setStatusMessage(`Agent created: ${created.agent_name}`);
        await refreshAgents();
      } else {
        const response = await fetch(`${API_BASE}/agents/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error(`Update agent failed (${response.status})`);
        const updated = await response.json();
        setStatusMessage(`Agent updated: ${updated.agent_name}`);
        setAgents((s) => s.map((a) => (a.id === id ? updated : a)));
      }
      resetAgentForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save agent");
    } finally {
      setSaving(false);
    }
  }

  function resetAgentForm() {
    setEditAgentId(null);
    setEditAgentFullName("");
    setEditAgentName("");
    setEditAgentInitials("");
    setEditAgentIsAdmin(false);
    setUserCustomizedInitials(false);
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

  // Categorized template lists
  const techTemplates = useMemo(
    () => templates.filter((t) => t.category_type === "tech_escalation"),
    [templates]
  );

  const customerTemplates = useMemo(
    () => templates.filter((t) => t.category_type === "customer_reply"),
    [templates]
  );

  // Available categories & subcategories for Customer Reply screen
  const customerCategories = useMemo(() => {
    const cats = new Set();
    customerTemplates.forEach((t) => {
      if (t.category) cats.add(t.category);
    });
    return ["All", ...Array.from(cats)];
  }, [customerTemplates]);

  const customerSubcategories = useMemo(() => {
    const subcats = new Set();
    customerTemplates.forEach((t) => {
      if (selectedCategory === "All" || t.category === selectedCategory) {
        if (t.subcategory) subcats.add(t.subcategory);
      }
    });
    return ["All", ...Array.from(subcats)];
  }, [customerTemplates, selectedCategory]);

  // Filtered customer templates
  const filteredCustomerTemplates = useMemo(() => {
    return customerTemplates.filter((t) => {
      const matchCat = selectedCategory === "All" || t.category === selectedCategory;
      const matchSub = selectedSubcategory === "All" || t.subcategory === selectedSubcategory;
      const matchSearch =
        !searchQuery ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.body.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSub && matchSearch;
    });
  }, [customerTemplates, selectedCategory, selectedSubcategory, searchQuery]);

  // Selected template object
  const activeTemplate = useMemo(() => {
    if (activeScreen === "tech_escalation") {
      return techTemplates.find((t) => t.id === selectedTechId) ?? techTemplates[0];
    }
    if (activeScreen === "customer_reply") {
      return templates.find((t) => t.id === selectedCustId) ?? filteredCustomerTemplates[0] ?? customerTemplates[0];
    }
    return null;
  }, [activeScreen, selectedTechId, selectedCustId, techTemplates, templates, filteredCustomerTemplates, customerTemplates]);

  // Placeholders calculation
  const placeholders = useMemo(() => {
    if (!activeTemplate) return [];
    const set = new Set();
    const re = /\{([^}]+)\}/g;
    let m;
    while ((m = re.exec(activeTemplate.body))) set.add(m[1]);
    return Array.from(set);
  }, [activeTemplate]);

  // Message generation logic
  function generateMessage() {
    if (!activeTemplate) return "";
    let out = activeTemplate.body;

    const autoMap = {
      agent_name: currentAgent?.agent_name ?? "",
      agent: currentAgent?.agent ?? currentAgent?.agent_name ?? "",
      agent_initials: currentAgent?.agent_initials ?? "",
    };

    const allKeys = new Set([...Object.keys(autoMap), ...Object.keys(values)]);
    for (const key of allKeys) {
      const val = values[key] ?? autoMap[key] ?? "";
      const re = new RegExp(`\\{${key}\\}`, "g");
      out = out.replace(re, val);
    }

    // Tech Escalation rule: Always ends with #{agent_name}
    if (activeScreen === "tech_escalation") {
      const sig = ` #${currentAgent?.agent_name ?? ""}`;
      if (currentAgent?.agent_name && !out.endsWith(sig) && !out.includes(`#${currentAgent.agent_name}`)) {
        out = out.trim() + sig;
      }
    }

    // Customer Reply WhatsApp rule: Appends ^{agent_initials}
    if (activeScreen === "customer_reply" && replyChannel === "whatsapp") {
      const initialsSig = ` ^${currentAgent?.agent_initials ?? ""}`;
      if (currentAgent?.agent_initials && !out.endsWith(initialsSig)) {
        out = out.trim() + initialsSig;
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
          className={`fixed left-0 top-0 bottom-0 z-40 flex flex-col justify-between border-r p-3 shadow-2xl backdrop-blur transition-all duration-300 ease-in-out ${
            isSidebarHovered ? "w-64" : "w-16"
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
                onClick={() => setActiveScreen("tech_escalation")}
                className={`flex w-full items-center gap-4 rounded-2xl px-3 py-3 text-left font-medium transition-all ${
                  activeScreen === "tech_escalation"
                    ? "bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] shadow-md"
                    : "hover:bg-[var(--neutral-bg)] text-[var(--neutral-text)]"
                }`}
                title="Tech Escalation"
              >
                <span className="text-xl shrink-0">⚡</span>
                <span className={`whitespace-nowrap transition-opacity duration-200 ${isSidebarHovered ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                  Tech Escalation
                </span>
              </button>

              <button
                onClick={() => setActiveScreen("customer_reply")}
                className={`flex w-full items-center gap-4 rounded-2xl px-3 py-3 text-left font-medium transition-all ${
                  activeScreen === "customer_reply"
                    ? "bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] shadow-md"
                    : "hover:bg-[var(--neutral-bg)] text-[var(--neutral-text)]"
                }`}
                title="Customer Reply"
              >
                <span className="text-xl shrink-0">💬</span>
                <span className={`whitespace-nowrap transition-opacity duration-200 ${isSidebarHovered ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                  Customer Reply
                </span>
              </button>

              {currentAgent?.is_admin ? (
                <button
                  onClick={() => setActiveScreen("admin")}
                  className={`flex w-full items-center gap-4 rounded-2xl px-3 py-3 text-left font-medium transition-all ${
                    activeScreen === "admin"
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
              ) : null}
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
                {activeScreen === "welcome"
                  ? "Welcome Portal"
                  : activeScreen === "tech_escalation"
                  ? "Tech Escalation Builder"
                  : activeScreen === "customer_reply"
                  ? "Customer Reply Center"
                  : "System Admin Dashboard"}
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
                    {agent.agent && agent.agent !== agent.agent_name ? (
                      <div className="text-xs mb-1 text-[var(--text-muted)] font-medium">{agent.agent}</div>
                    ) : null}
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

        {/* SCREEN 2: TECH ESCALATION SCREEN (Telegram Target Only) */}
        {currentAgent && activeScreen === "tech_escalation" ? (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto">
            {/* Left Panel: Template & Inputs */}
            <div className="lg:col-span-7 rounded-3xl border p-6 shadow-[var(--panel-shadow)] backdrop-blur space-y-5" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold" style={{ color: "var(--app-text)" }}>
                    ⚡ Tech Escalation Builder
                  </h2>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    Escalation requests targeted exclusively for Telegram resolution.
                  </p>
                </div>
                <span className="text-xs uppercase font-bold text-[#4cd34c] bg-[#4cd34c]/10 border border-[#4cd34c]/30 px-3 py-1 rounded-full">
                  ✈️ Telegram Exclusive
                </span>
              </div>

              {/* Template Picker */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: "var(--text-muted)" }}>
                  Select Escalation Template:
                </label>
                <select
                  value={selectedTechId ?? ""}
                  onChange={(e) => setSelectedTechId(Number(e.target.value))}
                  className="w-full rounded-xl border p-3 font-medium text-sm"
                  style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                >
                  {techTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dynamic Parameters */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                  Escalation Parameters:
                </h3>

                {placeholders.length === 0 ? (
                  <p className="text-xs italic p-3 rounded-xl border" style={{ borderColor: "var(--field-border)", color: "var(--text-muted)" }}>
                    This template contains no customizable fields.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {placeholders.map((ph) => {
                      const isAgentField = ph === "agent_name" || ph === "agent_initials" || ph === "agent";
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
                            value={values[ph] ?? (isAgentField ? (ph === "agent_initials" ? currentAgent.agent_initials : currentAgent.agent_name) : "")}
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
                    Telegram Escalation Preview
                  </h2>
                </div>

                <div className="rounded-2xl border p-4 min-h-[12rem] whitespace-pre-wrap font-mono text-sm leading-relaxed" style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}>
                  {generatedMsg || <span style={{ color: "var(--field-placeholder)" }}>Select an escalation template...</span>}
                </div>

                <p className="text-xs italic" style={{ color: "var(--text-muted)" }}>
                  💡 Tech Escalation messages automatically end with signature <code className="text-[#4cd34c]">#{currentAgent.agent_name}</code>.
                </p>
              </div>

              <div className="space-y-2 mt-6">
                <button
                  type="button"
                  onClick={() => copyText(escapeForTelegramMarkdownV2(generatedMsg))}
                  disabled={!generatedMsg}
                  className="w-full rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] py-3 font-semibold text-[#071007] shadow-lg disabled:opacity-50 transition"
                >
                  Copy Telegram Formatted Escalation
                </button>
                <button
                  type="button"
                  onClick={() => copyText(generatedMsg)}
                  disabled={!generatedMsg}
                  className="w-full rounded-xl border py-2 text-sm font-medium transition"
                  style={{ borderColor: "var(--badge-border)", color: "var(--neutral-text)", backgroundColor: "var(--neutral-bg)" }}
                >
                  Copy Plain Text Escalation
                </button>
                <button
                  type="button"
                  onClick={() => setValues({})}
                  className="w-full rounded-xl border py-2 text-sm font-medium transition"
                  style={{ borderColor: "var(--badge-border)", color: "var(--neutral-text)", backgroundColor: "var(--neutral-bg)" }}
                >
                  Clear Parameter Inputs
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {/* SCREEN 3: CUSTOMER REPLY SCREEN (WhatsApp & Live Chat with Categorized Browser) */}
        {currentAgent && activeScreen === "customer_reply" ? (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto">
            {/* Left Panel: Hierarchical Category Browser & Inputs */}
            <div className="lg:col-span-7 rounded-3xl border p-6 shadow-[var(--panel-shadow)] backdrop-blur space-y-5" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}>
              <div>
                <h2 className="text-xl font-bold mb-1" style={{ color: "var(--app-text)" }}>
                  💬 Customer Reply Center
                </h2>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Browse categorized response templates for WhatsApp and Live Chat customer replies.
                </p>
              </div>

              {/* Target Channel Selector */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: "var(--text-muted)" }}>
                  Select Response Channel:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setReplyChannel("whatsapp")}
                    className={`rounded-xl border py-2.5 px-3 text-sm font-medium transition flex items-center justify-center gap-2 ${
                      replyChannel === "whatsapp"
                        ? "border-[#4cd34c] bg-[#4cd34c]/10 text-[#4cd34c] font-bold shadow-sm"
                        : "hover:bg-[var(--neutral-bg)]"
                    }`}
                    style={{ borderColor: replyChannel === "whatsapp" ? "#4cd34c" : "var(--field-border)" }}
                  >
                    <span>💬 WhatsApp (Appends ^{currentAgent.agent_initials})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReplyChannel("livechat")}
                    className={`rounded-xl border py-2.5 px-3 text-sm font-medium transition flex items-center justify-center gap-2 ${
                      replyChannel === "livechat"
                        ? "border-[#4cd34c] bg-[#4cd34c]/10 text-[#4cd34c] font-bold shadow-sm"
                        : "hover:bg-[var(--neutral-bg)]"
                    }`}
                    style={{ borderColor: replyChannel === "livechat" ? "#4cd34c" : "var(--field-border)" }}
                  >
                    <span>🎧 Live Chat (Clean Text)</span>
                  </button>
                </div>
              </div>

              {/* SEARCH & CATEGORY BROWSER */}
              <div className="space-y-3 pt-2 border-t" style={{ borderColor: "var(--field-border)" }}>
                {/* Search Bar */}
                <div className="relative">
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="🔍 Search customer reply templates..."
                    className="w-full rounded-xl border p-2.5 text-sm pl-9 placeholder:text-[var(--field-placeholder)]"
                    style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                  />
                </div>

                {/* Level 1: Category Pills */}
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-muted)" }}>
                    Primary Category:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {customerCategories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setSelectedCategory(cat);
                          setSelectedSubcategory("All");
                        }}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                          selectedCategory === cat
                            ? "bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] border-[#4cd34c] shadow-sm"
                            : "hover:bg-[var(--neutral-bg)] text-[var(--neutral-text)]"
                        }`}
                        style={{ borderColor: selectedCategory === cat ? "#4cd34c" : "var(--badge-border)" }}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Level 2: Subcategory Chips */}
                {customerSubcategories.length > 1 ? (
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-muted)" }}>
                      Subcategory:
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {customerSubcategories.map((subcat) => (
                        <button
                          key={subcat}
                          type="button"
                          onClick={() => setSelectedSubcategory(subcat)}
                          className={`rounded-xl border px-2.5 py-0.5 text-[11px] transition ${
                            selectedSubcategory === subcat
                              ? "border-[#4cd34c] bg-[#4cd34c]/20 text-[#4cd34c] font-bold"
                              : "hover:bg-[var(--neutral-bg)] text-[var(--text-muted)]"
                          }`}
                          style={{ borderColor: selectedSubcategory === subcat ? "#4cd34c" : "var(--field-border)" }}
                        >
                          {subcat}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Categorized Template List Cards */}
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-muted)" }}>
                    Select Response Template ({filteredCustomerTemplates.length}):
                  </label>
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                    {filteredCustomerTemplates.length === 0 ? (
                      <div className="text-xs italic p-3 rounded-xl border" style={{ borderColor: "var(--field-border)", color: "var(--text-muted)" }}>
                        No templates found matching your category filter.
                      </div>
                    ) : (
                      filteredCustomerTemplates.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => setSelectedCustId(t.id)}
                          className={`p-3 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                            t.id === (activeTemplate?.id)
                              ? "border-[#4cd34c] ring-1 ring-[#4cd34c]/30 bg-[#4cd34c]/5"
                              : "hover:border-[#4cd34c]/50"
                          }`}
                          style={{ borderColor: t.id === (activeTemplate?.id) ? "#4cd34c" : "var(--field-border)", backgroundColor: "var(--field-bg)" }}
                        >
                          <div>
                            <div className="font-semibold text-sm">{t.name}</div>
                            <div className="text-xs truncate max-w-md mt-0.5" style={{ color: "var(--text-muted)" }}>
                              {t.body}
                            </div>
                          </div>
                          <span className="text-[10px] rounded-full border px-2 py-0.5 shrink-0 ml-2" style={{ borderColor: "var(--badge-border)", color: "var(--badge-text)" }}>
                            {t.category ?? "General"}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Dynamic Parameter Inputs */}
              {placeholders.length > 0 ? (
                <div className="pt-2 border-t" style={{ borderColor: "var(--field-border)" }}>
                  <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                    Customer Response Parameters:
                  </h3>
                  <div className="space-y-3">
                    {placeholders.map((ph) => {
                      const isAgentField = ph === "agent_name" || ph === "agent_initials" || ph === "agent";
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
                            value={values[ph] ?? (isAgentField ? (ph === "agent_initials" ? currentAgent.agent_initials : currentAgent.agent_name) : "")}
                            onChange={(e) => setValues((s) => ({ ...s, [ph]: e.target.value }))}
                            placeholder={`Enter ${ph.replace("_", " ")}`}
                            className="w-full rounded-xl border p-2.5 text-sm placeholder:text-[var(--field-placeholder)]"
                            style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Right Panel: Live Message Preview */}
            <div className="lg:col-span-5 rounded-3xl border p-6 shadow-[var(--panel-shadow)] backdrop-blur flex flex-col justify-between" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold" style={{ color: "var(--app-text)" }}>
                    Customer Reply Preview
                  </h2>
                  <span className="text-xs uppercase font-bold text-[#4cd34c] bg-[#4cd34c]/10 border border-[#4cd34c]/30 px-3 py-1 rounded-full">
                    {replyChannel === "whatsapp" ? "💬 WhatsApp" : "🎧 Live Chat"}
                  </span>
                </div>

                <div className="rounded-2xl border p-4 min-h-[12rem] whitespace-pre-wrap font-mono text-sm leading-relaxed" style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}>
                  {generatedMsg || <span style={{ color: "var(--field-placeholder)" }}>Select a response template...</span>}
                </div>

                {replyChannel === "whatsapp" ? (
                  <p className="text-xs italic" style={{ color: "var(--text-muted)" }}>
                    💡 WhatsApp channel format automatically appends agent initials signature <code className="text-[#4cd34c]">^{currentAgent.agent_initials}</code>.
                  </p>
                ) : (
                  <p className="text-xs italic" style={{ color: "var(--text-muted)" }}>
                    💡 Live Chat format presents clean customer-facing response text.
                  </p>
                )}
              </div>

              <div className="space-y-2 mt-6">
                <button
                  type="button"
                  onClick={() => copyText(generatedMsg)}
                  disabled={!generatedMsg}
                  className="w-full rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] py-3 font-semibold text-[#071007] shadow-lg disabled:opacity-50 transition"
                >
                  Copy Response Message
                </button>
                <button
                  type="button"
                  onClick={() => setValues({})}
                  className="w-full rounded-xl border py-2 text-sm font-medium transition"
                  style={{ borderColor: "var(--badge-border)", color: "var(--neutral-text)", backgroundColor: "var(--neutral-bg)" }}
                >
                  Clear Parameter Inputs
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {/* SCREEN 4: SYSTEM ADMIN SCREEN */}
        {currentAgent && activeScreen === "admin" ? (
          <section className="max-w-7xl mx-auto space-y-8">
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--panel-border)" }}>
              <div>
                <h2 className="text-2xl font-bold" style={{ color: "var(--app-text)" }}>
                  System Admin Control Panel
                </h2>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Manage global response templates, categories, and agent credentials.
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

              {/* Create/Edit Template Form */}
              <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--field-bg)" }}>
                <h4 className="text-xs uppercase font-semibold" style={{ color: "var(--text-muted)" }}>
                  {editTplId ? `Edit Template #${editTplId}` : "Create New Response Template"}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] block mb-1" style={{ color: "var(--text-muted)" }}>Category Type:</label>
                    <select
                      value={editTplType}
                      onChange={(e) => setEditTplType(e.target.value)}
                      className="w-full rounded-xl border p-2.5 text-sm"
                      style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                    >
                      <option value="tech_escalation">⚡ Tech Escalation (Telegram)</option>
                      <option value="customer_reply">💬 Customer Reply (WhatsApp & Live Chat)</option>
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
                      value={editTplBody}
                      onChange={(e) => setEditTplBody(e.target.value)}
                      placeholder="Write message template..."
                      className="w-full rounded-xl border p-2.5 min-h-[5rem] text-sm"
                      style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => upsertTemplate(editTplId, editTplName, editTplBody, editTplType, editTplCat, editTplSubcat)}
                    disabled={!editTplName || !editTplBody || saving}
                    className="px-4 py-2 rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] text-sm font-semibold shadow-md disabled:opacity-50"
                  >
                    {saving ? "Saving..." : editTplId ? "Save Changes" : "Add Template"}
                  </button>
                  {editTplId ? (
                    <button
                      onClick={resetTemplateForm}
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
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base">{t.name}</span>
                        <span className="text-[10px] rounded-full border px-2 py-0.5" style={{ borderColor: "var(--badge-border)", color: "var(--badge-text)" }}>
                          {t.category_type === "tech_escalation" ? "⚡ Tech Escalation" : "💬 Customer Reply"}
                        </span>
                        {t.category ? (
                          <span className="text-[10px] rounded-full border px-2 py-0.5" style={{ borderColor: "var(--badge-border)", color: "var(--badge-text)" }}>
                            {t.category} {t.subcategory ? `> ${t.subcategory}` : ""}
                          </span>
                        ) : null}
                      </div>
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
                          setEditTplType(t.category_type ?? "tech_escalation");
                          setEditTplCat(t.category ?? "");
                          setEditTplSubcat(t.subcategory ?? "");
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

            {/* SECTION 2: AGENT PROFILE CONTROL MANAGEMENT */}
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
                  <div>
                    <label className="text-[11px] block mb-1" style={{ color: "var(--text-muted)" }}>Agent Full Name (Agent):</label>
                    <input
                      value={editAgentFullName}
                      onChange={(e) => handleAgentFullNameChange(e.target.value)}
                      placeholder="e.g. Vuyo Ndlovu"
                      className="w-full rounded-xl border p-2.5 text-sm"
                      style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] block mb-1" style={{ color: "var(--text-muted)" }}>Display Name (Agent Name):</label>
                    <input
                      value={editAgentName}
                      onChange={(e) => handleAgentNameChange(e.target.value)}
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
                  <button
                    onClick={() => upsertAgent(editAgentId, editAgentFullName || editAgentName, editAgentName, editAgentInitials, editAgentIsAdmin)}
                    disabled={!editAgentName || !editAgentInitials || saving}
                    className="px-4 py-2 rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] text-sm font-semibold shadow-md disabled:opacity-50"
                  >
                    {saving ? "Saving..." : editAgentId ? "Save Agent Changes" : "Create Agent Profile"}
                  </button>
                  {editAgentId ? (
                    <button
                      onClick={resetAgentForm}
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
                        onClick={() => {
                          setEditAgentId(agent.id);
                          setEditAgentFullName(agent.agent ?? agent.agent_name);
                          setEditAgentName(agent.agent_name);
                          setEditAgentInitials(agent.agent_initials);
                          setEditAgentIsAdmin(agent.is_admin);
                          setUserCustomizedInitials(true);
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