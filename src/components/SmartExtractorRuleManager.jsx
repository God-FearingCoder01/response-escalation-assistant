import { useState, useEffect, useCallback } from "react";
import {
  fetchExtractionRules,
  createExtractionRule,
  updateExtractionRule,
  deleteExtractionRule,
  testExtractionRuleApi,
} from "../services/smartExtractorService";

export default function SmartExtractorRuleManager({ companyId = 1, showToast = () => { } }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Rule Form State
  const [showModal, setShowModal] = useState(false);
  const [editRuleId, setEditRuleId] = useState(null);
  const [ruleName, setRuleName] = useState("");
  const [resultField, setResultField] = useState("");
  const [extractionMethod, setExtractionMethod] = useState("regex");
  const [pattern, setPattern] = useState("");
  const [description, setDescription] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Tester State
  const [testPattern, setTestPattern] = useState("MP\\d{6}\\.\\d{4}\\.T\\d{7}");
  const [testInput, setTestInput] = useState("Transaction successful. Ref: MP260831.1923.T7382831 Amount: $25.00");
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  const loadRules = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await fetchExtractionRules(companyId, false);
      setRules(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load extraction rules:", err);
      setLoadError(err.message || "Failed to load extraction rules.");
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const handleOpenAddModal = () => {
    setEditRuleId(null);
    setRuleName("");
    setResultField("");
    setExtractionMethod("regex");
    setPattern("");
    setDescription("");
    setIsEnabled(true);
    setFormError("");
    setShowModal(true);
  };

  const handleOpenEditModal = (rule) => {
    setEditRuleId(rule.id);
    setRuleName(rule.name || "");
    setResultField(rule.result_field || "");
    setExtractionMethod(rule.extraction_method || "regex");
    setPattern(rule.pattern || "");
    setDescription(rule.description || "");
    setIsEnabled(rule.is_enabled !== false);
    setFormError("");
    setShowModal(true);
  };

  const handleSaveRule = async (e) => {
    e.preventDefault();
    if (!ruleName.trim() || !resultField.trim() || !pattern.trim()) {
      setFormError("Rule name, result field, and pattern are required.");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const payload = {
        name: ruleName.trim(),
        result_field: resultField.replace(/[{}]/g, "").trim().toLowerCase(),
        extraction_method: extractionMethod,
        pattern: pattern.trim(),
        description: description.trim() || null,
        is_enabled: isEnabled,
        company_id: companyId,
      };

      if (editRuleId) {
        await updateExtractionRule(editRuleId, payload, companyId);
        showToast("Extraction rule updated successfully!");
      } else {
        await createExtractionRule(payload);
        showToast("New extraction rule created successfully!");
      }

      setShowModal(false);
      loadRules();
    } catch (err) {
      setFormError(err.message || "Failed to save extraction rule.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRuleStatus = async (rule) => {
    try {
      await updateExtractionRule(rule.id, { is_enabled: !rule.is_enabled }, companyId);
      showToast(`Rule '${rule.name}' ${!rule.is_enabled ? "enabled" : "disabled"}.`);
      loadRules();
    } catch (err) {
      showToast(`Error toggling rule: ${err.message}`, "error");
    }
  };

  const handleDeleteRule = async (ruleId) => {
    if (!window.confirm("Are you sure you want to delete this extraction rule?")) return;
    try {
      await deleteExtractionRule(ruleId, companyId);
      showToast("Extraction rule deleted.");
      loadRules();
    } catch (err) {
      showToast(`Delete failed: ${err.message}`, "error");
    }
  };

  const handleRunTest = async (e) => {
    e.preventDefault();
    if (!testPattern || !testInput) return;
    setTesting(true);
    setTestResult(null);

    try {
      const res = await testExtractionRuleApi(testPattern, testInput);
      setTestResult(res);
    } catch (err) {
      setTestResult({ matched: false, value: null, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const filteredRules = rules.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.result_field.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.pattern.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* SECTION HEADER & ADD BUTTON */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 border-white/10">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <span>⚙️</span> Smart Extractor Rules
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            Configure rules for extracting reference numbers, amounts, dates, and custom fields from screenshots & text.
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center gap-2 rounded-xl bg-[#4cd34c] px-4 py-2.5 text-xs font-bold text-black shadow-lg hover:bg-[#42be42] transition cursor-pointer"
        >
          <span>+ Add Extraction Rule</span>
        </button>
      </div>

      {/* SEARCH BAR */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search extraction rules by name, field key, or pattern..."
          className="flex-1 rounded-xl border bg-black/30 px-4 py-2.5 text-xs text-white placeholder-gray-500 border-white/10 focus:outline-none focus:ring-2 focus:ring-[#4cd34c]/50"
        />
      </div>

      {/* RULES LIST */}
      {loading ? (
        <div className="p-8 text-center text-xs text-gray-400">Loading extraction rules...</div>
      ) : loadError ? (
        <div className="rounded-2xl border p-8 text-center bg-black/20 border-red-500/20 text-red-300 text-xs">
          {loadError}. Check the production database connection and try again.
        </div>
      ) : filteredRules.length === 0 ? (
        <div className="rounded-2xl border p-8 text-center bg-black/20 border-white/10 text-gray-400 text-xs">
          No extraction rules found matching your filter.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredRules.map((rule) => (
            <div
              key={rule.id}
              className={`rounded-2xl border p-5 transition space-y-3 bg-black/30 border-white/10 hover:border-white/20 ${!rule.is_enabled ? "opacity-60" : ""
                }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">{rule.name}</h4>
                  <span className="text-[11px] font-mono text-[#4cd34c]">{`{${rule.result_field}}`}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleRuleStatus(rule)}
                    className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-full border transition ${rule.is_enabled
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        : "border-gray-500/30 bg-gray-500/10 text-gray-400"
                      }`}
                  >
                    {rule.is_enabled ? "Enabled ✓" : "Disabled"}
                  </button>
                </div>
              </div>

              {rule.description && <p className="text-xs text-gray-400 line-clamp-2">{rule.description}</p>}

              <div className="rounded-xl bg-black/50 p-2.5 border border-white/10 font-mono text-xs text-amber-300 break-all">
                {rule.pattern}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <button
                  onClick={() => {
                    setTestPattern(rule.pattern);
                    showToast(`Loaded pattern for rule '${rule.name}' into Rule Tester below.`);
                  }}
                  className="text-xs text-gray-400 hover:text-[#4cd34c] transition"
                >
                  🧪 Test Pattern
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenEditModal(rule)}
                    className="rounded-lg border px-2.5 py-1 text-xs text-gray-300 hover:bg-white/10 border-white/10"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="rounded-lg border border-red-500/30 px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* RULE TESTER PANEL */}
      <div className="rounded-2xl border p-6 bg-black/30 border-white/10 space-y-4">
        <h4 className="text-sm font-bold text-white flex items-center gap-2">
          <span>🧪</span> Live Extraction Rule Tester
        </h4>
        <p className="text-xs text-gray-400">Test regex extraction rules against sample customer text before enabling them in production.</p>

        <form onSubmit={handleRunTest} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">Regex Pattern to Test:</label>
            <input
              type="text"
              value={testPattern}
              onChange={(e) => setTestPattern(e.target.value)}
              placeholder="e.g. MP\d{6}\.\d{4}\.T\d{7}"
              className="w-full rounded-xl border bg-black/40 px-3 py-2 text-xs font-mono text-amber-300 border-white/10 focus:outline-none focus:ring-1 focus:ring-[#4cd34c]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">Sample Test Input Text:</label>
            <textarea
              rows={3}
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder="Paste sample receipt text or customer ticket text..."
              className="w-full rounded-xl border bg-black/40 p-3 text-xs text-white border-white/10 focus:outline-none focus:ring-1 focus:ring-[#4cd34c]"
            />
          </div>

          <button
            type="submit"
            disabled={testing}
            className="rounded-xl bg-[#4cd34c]/20 px-4 py-2 text-xs font-bold text-[#4cd34c] border border-[#4cd34c]/30 hover:bg-[#4cd34c]/30 transition"
          >
            {testing ? "Testing..." : "Test Extraction Rule"}
          </button>
        </form>

        {testResult && (
          <div
            className={`rounded-xl border p-4 text-xs space-y-1 ${testResult.matched
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-amber-500/30 bg-amber-500/10 text-amber-300"
              }`}
          >
            <p className="font-bold">{testResult.matched ? "✓ Pattern Matched Successfully!" : "❌ No Match Found"}</p>
            {testResult.matched && (
              <p className="font-mono text-sm text-white">Extracted Match: <span className="text-[#4cd34c]">{testResult.value}</span></p>
            )}
            {testResult.error && <p className="text-red-400">{testResult.error}</p>}
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border p-6 shadow-2xl space-y-4 bg-gray-900 border-gray-700 text-white">
            <h4 className="text-base font-bold text-white">{editRuleId ? "Edit Extraction Rule" : "Add Extraction Rule"}</h4>

            {formError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveRule} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Rule Name:</label>
                <input
                  type="text"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="e.g. Transaction Reference"
                  className="w-full rounded-xl border bg-black/50 p-2.5 text-xs text-white border-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4cd34c]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Result Field Key:</label>
                <input
                  type="text"
                  value={resultField}
                  onChange={(e) => setResultField(e.target.value)}
                  placeholder="e.g. reference_number"
                  className="w-full rounded-xl border bg-black/50 p-2.5 text-xs font-mono text-[#4cd34c] border-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4cd34c]"
                  required
                />
                <p className="text-[10px] text-gray-400 mt-1">Template parameter name (e.g. reference_number for {"{reference_number}"})</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Regex Pattern:</label>
                <input
                  type="text"
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  placeholder="e.g. MP\d{6}\.\d{4}\.T\d{7}"
                  className="w-full rounded-xl border bg-black/50 p-2.5 text-xs font-mono text-amber-300 border-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4cd34c]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Description (Optional):</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe when this extraction rule applies..."
                  className="w-full rounded-xl border bg-black/50 p-2 text-xs text-white border-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4cd34c]"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isEnabledCheck"
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-700 text-[#4cd34c] focus:ring-[#4cd34c]"
                />
                <label htmlFor="isEnabledCheck" className="text-xs text-gray-300 cursor-pointer">
                  Rule Enabled (Active in Smart Extractor)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-gray-700 px-4 py-2 text-xs text-gray-300 hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#4cd34c] px-4 py-2 text-xs font-bold text-black hover:bg-[#42be42]"
                >
                  {saving ? "Saving..." : "Save Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
