import { useState, useEffect, useMemo } from "react";
import {
  DEFAULT_TEMPLATES,
  fetchTemplatesApi,
  createTemplateApi,
  updateTemplateApi,
  deleteTemplateApi,
  importTemplatesApi,
  getDateAutoValues,
} from "../services/api";

export function useTemplates({ apiStatus, activeScreen, currentAgent, favoriteIds, usageCounts, recentlyUsed, showToast }) {
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);

  // Tech Escalation screen state
  const [selectedTechId, setSelectedTechId] = useState(null);

  // Customer Reply screen states
  const [selectedCustId, setSelectedCustId] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedSubcategory, setSelectedSubcategory] = useState("All");
  const [replyChannel, setReplyChannel] = useState("signed"); // "signed" | "unsigned"
  const [searchQuery, setSearchQuery] = useState("");

  // Quick Access screen states
  const [selectedQuickId, setSelectedQuickId] = useState(null);
  const [quickTab, setQuickTab] = useState("favorites"); // "favorites" | "most_used" | "recently_used"

  // System Admin Template Accordion Expansion State (CategoryName -> boolean)
  const [expandedAdminCats, setExpandedAdminCats] = useState({});
  const [adminSubcatFilter, setAdminSubcatFilter] = useState({});

  // Edit template form states (Admin Dashboard)
  const [editTplId, setEditTplId] = useState(null);
  const [editTplName, setEditTplName] = useState("");
  const [editTplBody, setEditTplBody] = useState("");
  const [editTplType, setEditTplType] = useState("tech_escalation");
  const [editTplCat, setEditTplCat] = useState("");
  const [editTplSubcat, setEditTplSubcat] = useState("");

  const refreshTemplates = async () => {
    try {
      const data = await fetchTemplatesApi();
      if (Array.isArray(data) && data.length > 0) {
        setTemplates(data);
        return;
      }
    } catch (e) {}
    setTemplates(DEFAULT_TEMPLATES);
  };

  useEffect(() => {
    refreshTemplates();
  }, [apiStatus]);

  // Categorized template lists
  const techTemplates = useMemo(
    () =>
      templates
        .filter((t) => t.category_type === "tech_escalation")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [templates]
  );

  const customerTemplates = useMemo(
    () => templates.filter((t) => t.category_type === "customer_reply"),
    [templates]
  );

  // Grouped category structure for System Admin template management accordion
  const groupedAdminCategories = useMemo(() => {
    const map = new Map();
    templates.forEach((t) => {
      const catName = (t.category ?? "General").trim() || "General";
      if (!map.has(catName)) {
        map.set(catName, {
          categoryName: catName,
          categoryType: t.category_type ?? "customer_reply",
          subcategories: new Set(["All"]),
          templates: [],
        });
      }
      const entry = map.get(catName);
      if (t.subcategory && t.subcategory.trim()) {
        entry.subcategories.add(t.subcategory.trim());
      }
      entry.templates.push(t);
    });

    return Array.from(map.values()).map((entry) => ({
      ...entry,
      subcategories: Array.from(entry.subcategories),
      totalCount: entry.templates.length,
    }));
  }, [templates]);

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

  // Favorites templates list
  const favoriteTemplates = useMemo(() => {
    const favList = favoriteIds || [];
    return templates.filter((t) => favList.includes(t.id));
  }, [templates, favoriteIds]);

  // Most used templates list
  const mostUsedTemplates = useMemo(() => {
    const counts = usageCounts || {};
    return [...templates]
      .filter((t) => (counts[t.id] || 0) > 0)
      .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));
  }, [templates, usageCounts]);

  // Recently used templates list
  const recentlyUsedTemplates = useMemo(() => {
    const map = new Map(templates.map((t) => [t.id, t]));
    const list = [];
    const recents = recentlyUsed || [];
    recents.forEach((item) => {
      const t = map.get(item?.templateId);
      if (t && !list.some((existing) => existing.id === t.id)) {
        list.push(t);
      }
    });
    return list;
  }, [templates, recentlyUsed]);

  // Active template for Quick Access screen
  const quickAccessActiveTemplate = useMemo(() => {
    const activeList =
      quickTab === "favorites"
        ? (favoriteTemplates.length > 0 ? favoriteTemplates : templates)
        : quickTab === "most_used"
          ? (mostUsedTemplates.length > 0 ? mostUsedTemplates : templates)
          : (recentlyUsedTemplates.length > 0 ? recentlyUsedTemplates : templates);
    return activeList.find((t) => t.id === selectedQuickId) ?? activeList[0] ?? templates[0] ?? null;
  }, [quickTab, favoriteTemplates, mostUsedTemplates, recentlyUsedTemplates, selectedQuickId, templates]);

  // Selected template object for current activeScreen
  const activeTemplate = useMemo(() => {
    if (activeScreen === "tech_escalation") {
      return techTemplates.find((t) => t.id === selectedTechId) ?? techTemplates[0];
    }
    if (activeScreen === "customer_reply") {
      return templates.find((t) => t.id === selectedCustId) ?? filteredCustomerTemplates[0] ?? customerTemplates[0];
    }
    if (activeScreen === "quick_access") {
      return quickAccessActiveTemplate;
    }
    return null;
  }, [activeScreen, selectedTechId, selectedCustId, techTemplates, templates, filteredCustomerTemplates, customerTemplates, quickAccessActiveTemplate]);

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
  function generateMessage(values = {}) {
    if (!activeTemplate) return "";
    let out = activeTemplate.body;

    const dateAuto = getDateAutoValues();
    const autoMap = {
      agent_name: currentAgent?.agent_name ?? "",
      agent: currentAgent?.agent ?? currentAgent?.agent_name ?? "",
      agent_initials: currentAgent?.agent_initials ?? "",
      time_units: "hour(s)",
      time_unit: "hour(s)",
      time_units_list: "hour(s)",
      ...dateAuto,
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

    // Customer Reply rule: WhatsApp/Signed appends ^{agent_initials} only if template body does NOT already include an agent signature placeholder
    if (activeScreen === "customer_reply" && replyChannel === "signed") {
      const hasAgentPlaceholder = activeTemplate?.body && /\{agent(_name|_initials)?\}/.test(activeTemplate.body);
      if (!hasAgentPlaceholder && currentAgent?.agent_initials) {
        const initialsSig = ` ^${currentAgent.agent_initials}`;
        if (!out.endsWith(initialsSig)) {
          out = out.trim() + initialsSig;
        }
      }
    }

    return out;
  }

  // Admin Template CRUD Handlers
  const handleEditTemplateClick = (template) => {
    setEditTplId(template.id);
    setEditTplName(template.name || "");
    setEditTplBody(template.body || "");
    setEditTplType(template.category_type || "customer_reply");
    setEditTplCat(template.category || "");
    setEditTplSubcat(template.subcategory || "");
  };

  const handleResetTemplateForm = () => {
    setEditTplId(null);
    setEditTplName("");
    setEditTplBody("");
    setEditTplType("customer_reply");
    setEditTplCat("");
    setEditTplSubcat("");
  };

  const handleCreateOrUpdateTemplate = async (e) => {
    if (e) e.preventDefault();
    if (!editTplName.trim() || !editTplBody.trim()) {
      alert("Please enter a template name and body text");
      return;
    }

    const payload = {
      name: editTplName.trim(),
      body: editTplBody.trim(),
      category_type: editTplType,
      category: editTplCat.trim() || null,
      subcategory: editTplSubcat.trim() || null,
    };

    try {
      if (editTplId) {
        if (apiStatus !== "offline") {
          try {
            const updated = await updateTemplateApi(editTplId, payload);
            setTemplates((curr) => curr.map((t) => (t.id === editTplId ? updated : t)));
            showToast("Template updated successfully! 📝");
            handleResetTemplateForm();
            return;
          } catch (err) {}
        }
        setTemplates((curr) =>
          curr.map((t) => (t.id === editTplId ? { ...t, ...payload } : t))
        );
        showToast("Template updated locally 📝");
      } else {
        if (apiStatus !== "offline") {
          try {
            const created = await createTemplateApi(payload);
            setTemplates((curr) => [created, ...curr]);
            showToast("New template created! 📝");
            handleResetTemplateForm();
            return;
          } catch (err) {}
        }
        const newTpl = { id: Date.now(), ...payload };
        setTemplates((curr) => [newTpl, ...curr]);
        showToast("New template created locally 📝");
      }
      handleResetTemplateForm();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Template action failed");
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm("Are you sure you want to delete this template?")) return;
    try {
      if (apiStatus !== "offline") {
        try {
          await deleteTemplateApi(templateId);
        } catch (err) {}
      }
      setTemplates((curr) => curr.filter((t) => t.id !== templateId));
      showToast("Template deleted 🗑️");
    } catch (err) {
      alert("Failed to delete template");
    }
  };

  const handleExportTemplates = () => {
    const jsonStr = JSON.stringify(templates, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rea_templates_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Template library exported to JSON! 📥");
  };

  const handleImportTemplatesFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const importedData = JSON.parse(text);
      if (!Array.isArray(importedData)) {
        alert("Invalid JSON format. Expected array of template objects.");
        return;
      }
      if (apiStatus !== "offline") {
        try {
          const res = await importTemplatesApi(importedData);
          setTemplates(res);
          showToast("Template library imported successfully! 📤");
          return;
        } catch (err) {}
      }
      setTemplates(importedData);
      showToast("Template library imported locally 📤");
    } catch (err) {
      alert("Failed to parse JSON file");
    }
  };

  const handleDeduplicateTemplates = () => {
    const seen = new Set();
    const deduplicated = [];
    templates.forEach((t) => {
      const key = `${(t.category_type || "").trim()}|${(t.category || "").trim()}|${(t.name || "").trim()}|${(t.body || "").trim()}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(t);
      }
    });
    setTemplates(deduplicated);
    showToast(`Template library deduplicated (${templates.length - deduplicated.length} duplicates removed)! 🧹`);
  };

  return {
    templates,
    setTemplates,
    refreshTemplates,
    selectedTechId,
    setSelectedTechId,
    selectedCustId,
    setSelectedCustId,
    selectedCategory,
    setSelectedCategory,
    selectedSubcategory,
    setSelectedSubcategory,
    replyChannel,
    setReplyChannel,
    searchQuery,
    setSearchQuery,
    selectedQuickId,
    setSelectedQuickId,
    quickTab,
    setQuickTab,
    expandedAdminCats,
    setExpandedAdminCats,
    adminSubcatFilter,
    setAdminSubcatFilter,
    // Admin Edit Template
    editTplId,
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
    handleExportTemplates,
    handleImportTemplatesFile,
    handleDeduplicateTemplates,
    // Computed template lists
    techTemplates,
    customerTemplates,
    groupedAdminCategories,
    customerCategories,
    customerSubcategories,
    filteredCustomerTemplates,
    favoriteTemplates,
    mostUsedTemplates,
    recentlyUsedTemplates,
    activeTemplate,
    placeholders,
    generateMessage,
  };
}
