import { useState, useEffect, useMemo } from "react";
import {
  DEFAULT_TEMPLATES,
  fetchTemplatesApi,
  createTemplateApi,
  updateTemplateApi,
  deleteTemplateApi,
  importTemplatesApi,
  getDateAutoValues,
  formatDateTimeString,
  resolveConditionalMappings,
} from "../services/api";

export function useTemplates({ apiStatus, activeScreen, currentAgent, favoriteIds, usageCounts, recentlyUsed, showToast, privateNotes = [] }) {
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);

  // Combined list of system templates and agent private notes
  const combinedTemplates = useMemo(() => {
    return [...templates, ...(privateNotes || [])];
  }, [templates, privateNotes]);

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
  const [placeholderConfigs, setPlaceholderConfigs] = useState({});

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

  // Favorites templates list (system templates + starred private notes)
  const favoriteTemplates = useMemo(() => {
    const favList = favoriteIds || [];
    return combinedTemplates.filter((t) => favList.includes(t.id));
  }, [combinedTemplates, favoriteIds]);

  // Most used templates list
  const mostUsedTemplates = useMemo(() => {
    const counts = usageCounts || {};
    return [...combinedTemplates]
      .filter((t) => (counts[t.id] || 0) > 0 || (t.use_count || 0) > 0)
      .sort((a, b) => {
        const countA = (counts[a.id] || 0) + (a.use_count || 0);
        const countB = (counts[b.id] || 0) + (b.use_count || 0);
        return countB - countA;
      });
  }, [combinedTemplates, usageCounts]);

  // Recently used templates list
  const recentlyUsedTemplates = useMemo(() => {
    const map = new Map(combinedTemplates.map((t) => [t.id, t]));
    const list = [];
    const recents = recentlyUsed || [];
    recents.forEach((item) => {
      const t = map.get(item?.templateId);
      if (t && !list.some((existing) => existing.id === t.id)) {
        list.push(t);
      }
    });
    return list;
  }, [combinedTemplates, recentlyUsed]);

  // Active template for Quick Access screen
  const quickAccessActiveTemplate = useMemo(() => {
    const activeList =
      quickTab === "favorites"
        ? (favoriteTemplates.length > 0 ? favoriteTemplates : combinedTemplates)
        : quickTab === "most_used"
          ? (mostUsedTemplates.length > 0 ? mostUsedTemplates : combinedTemplates)
          : quickTab === "private_notes"
            ? (privateNotes.length > 0 ? privateNotes : combinedTemplates)
            : (recentlyUsedTemplates.length > 0 ? recentlyUsedTemplates : combinedTemplates);
    return combinedTemplates.find((t) => String(t.id) === String(selectedQuickId)) ?? activeList.find((t) => String(t.id) === String(selectedQuickId)) ?? activeList[0] ?? combinedTemplates[0] ?? null;
  }, [quickTab, favoriteTemplates, mostUsedTemplates, privateNotes, recentlyUsedTemplates, selectedQuickId, combinedTemplates]);

  // Selected template object for current activeScreen
  const activeTemplate = useMemo(() => {
    if (activeScreen === "tech_escalation") {
      return techTemplates.find((t) => String(t.id) === String(selectedTechId)) ?? techTemplates[0];
    }
    if (activeScreen === "customer_reply") {
      return (
        templates.find((t) => String(t.id) === String(selectedCustId)) ??
        filteredCustomerTemplates.find((t) => String(t.id) === String(selectedCustId)) ??
        filteredCustomerTemplates[0] ??
        customerTemplates[0]
      );
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

    // Parse custom placeholder_config if present
    let parsedConfig = {};
    if (activeTemplate?.placeholder_config) {
      try {
        parsedConfig = typeof activeTemplate.placeholder_config === "string"
          ? JSON.parse(activeTemplate.placeholder_config)
          : activeTemplate.placeholder_config;
      } catch (e) {
        parsedConfig = {};
      }
    }

    // Apply custom configured auto-fill defaults if value is not manually overridden
    const customConfigAutoMap = {};
    if (parsedConfig && typeof parsedConfig === "object") {
      Object.keys(parsedConfig).forEach((key) => {
        const cfg = parsedConfig[key];
        if (!cfg) return;

        if (cfg.auto_fill_type === "date_day") customConfigAutoMap[key] = dateAuto.day;
        else if (cfg.auto_fill_type === "date_month") customConfigAutoMap[key] = dateAuto.month_number;
        else if (cfg.auto_fill_type === "date_year") customConfigAutoMap[key] = dateAuto.year;
        else if (cfg.auto_fill_type === "date_time") customConfigAutoMap[key] = dateAuto.time;
        else if (cfg.auto_fill_type === "greeting" || cfg.auto_fill_type === "time_of_day") customConfigAutoMap[key] = dateAuto.greeting;
        else if (cfg.auto_fill_type === "Greeting" || cfg.auto_fill_type === "greeting_cap") customConfigAutoMap[key] = dateAuto.Greeting;
        else if (cfg.auto_fill_type === "good_greeting") customConfigAutoMap[key] = dateAuto.good_greeting;
        else if (cfg.auto_fill_type === "agent_name") customConfigAutoMap[key] = currentAgent?.agent_name ?? "";
        else if (cfg.auto_fill_type === "agent_fullname" || cfg.auto_fill_type === "agent") customConfigAutoMap[key] = (currentAgent?.agent || currentAgent?.agent_name) ?? "";
        else if (cfg.auto_fill_type === "agent_initials") customConfigAutoMap[key] = currentAgent?.agent_initials ?? "";
        else if (cfg.auto_fill_type === "custom" && cfg.custom_default !== undefined) customConfigAutoMap[key] = cfg.custom_default;
        else if (cfg.control_type === "combobox" && Array.isArray(cfg.options) && cfg.options.length > 0) {
          customConfigAutoMap[key] = cfg.options[0];
        }
      });
    }

    // Resolve conditional mappings (e.g. {animal?} -> {:game})
    const { resolvedValues } = resolveConditionalMappings(placeholders, parsedConfig, values);

    const allKeys = new Set([...Object.keys(autoMap), ...Object.keys(customConfigAutoMap), ...Object.keys(resolvedValues)]);
    for (const key of allKeys) {
      let rawVal = resolvedValues[key] ?? customConfigAutoMap[key] ?? autoMap[key] ?? "";
      const cfg = parsedConfig[key];
      const ctrlType = cfg?.control_type || (key === "date" ? "date" : key === "time" ? "time" : key === "datetime" ? "datetime" : "text");

      const keyLower = key.toLowerCase();
      const is2DigitDateComp =
        cfg?.auto_fill_type === "month_number" ||
        cfg?.auto_fill_type === "day_number" ||
        ["month_number", "month_num", "month", "mm", "day_number", "day_num", "day", "dd"].includes(keyLower);

      if (is2DigitDateComp && rawVal !== "" && !isNaN(Number(rawVal))) {
        rawVal = String(parseInt(rawVal, 10)).padStart(2, "0");
      }

      let formattedVal = formatDateTimeString(rawVal, ctrlType, cfg?.date_format);
      out = out.split(`{${key}}`).join(formattedVal);
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
    let parsedConfig = {};
    if (template.placeholder_config) {
      try {
        parsedConfig = typeof template.placeholder_config === "string"
          ? JSON.parse(template.placeholder_config)
          : template.placeholder_config;
      } catch (e) {
        parsedConfig = {};
      }
    }
    setPlaceholderConfigs(parsedConfig);
  };

  const handleResetTemplateForm = () => {
    setEditTplId(null);
    setEditTplName("");
    setEditTplBody("");
    setEditTplType("customer_reply");
    setEditTplCat("");
    setEditTplSubcat("");
    setPlaceholderConfigs({});
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
      placeholder_config: Object.keys(placeholderConfigs).length > 0 ? JSON.stringify(placeholderConfigs) : null,
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
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : "";
            if (errMsg.includes("Template not found") || errMsg.includes("404")) {
              try {
                const created = await createTemplateApi(payload);
                setTemplates((curr) => curr.map((t) => (t.id === editTplId ? created : t)));
                showToast("Template saved successfully! 📝");
                handleResetTemplateForm();
                return;
              } catch (createErr) {
                showToast(`Error: ${createErr instanceof Error ? createErr.message : "Failed to save template"} ⚠️`);
                return;
              }
            }
            if (errMsg.toLowerCase().includes("fetch") || errMsg.toLowerCase().includes("networkerror")) {
              // Fallback to local offline mode below
            } else {
              showToast(`Error: ${errMsg || "Template update failed"} ⚠️`);
              return;
            }
          }
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
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : "";
            if (errMsg.toLowerCase().includes("fetch") || errMsg.toLowerCase().includes("networkerror")) {
              // Fallback to local offline mode below
            } else {
              showToast(`Error: ${errMsg || "Failed to create template"} ⚠️`);
              return;
            }
          }
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
          setTemplates((curr) => curr.filter((t) => t.id !== templateId));
          showToast("Template deleted 🗑️");
          return;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "";
          if (errMsg.includes("Template not found") || errMsg.includes("404")) {
            setTemplates((curr) => curr.filter((t) => t.id !== templateId));
            showToast("Template deleted 🗑️");
            return;
          }
          if (errMsg.toLowerCase().includes("fetch") || errMsg.toLowerCase().includes("networkerror")) {
            // Fallback to local offline mode below
          } else {
            showToast(`Error: ${errMsg || "Failed to delete template"} ⚠️`);
            return;
          }
        }
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
        } catch (err) {
          if (err instanceof Error && err.message === "Failed to fetch") {
            // Fallback to local offline mode
          } else {
            showToast(`Error: ${err instanceof Error ? err.message : "Import failed"} ⚠️`);
            return;
          }
        }
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
    placeholderConfigs,
    setPlaceholderConfigs,
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
