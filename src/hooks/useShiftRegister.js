import { useState, useEffect, useCallback } from "react";
import {
  fetchSirShiftsApi,
  createSirShiftApi,
  updateSirShiftApi,
  deleteSirShiftApi,
  fetchSirTargetsApi,
  createSirTargetApi,
  deleteSirTargetApi,
  fetchSirIssuesApi,
  createSirIssueApi,
  updateSirIssueApi,
  deleteSirIssueApi,
} from "../services/api";

const DEFAULT_SHIFTS = [
  { id: 1, name: "Morning Shift", start_time: "07:00", end_time: "15:00", is_active: true },
  { id: 2, name: "Afternoon Shift", start_time: "15:00", end_time: "23:00", is_active: true },
  { id: 3, name: "Night Shift (Graveyard)", start_time: "23:00", end_time: "07:00", is_active: true },
];

const DEFAULT_TARGETS = [
  { id: 1, name: "Technical Support / NOC" },
  { id: 2, name: "Billing & Accounts Team" },
  { id: 3, name: "Network Engineering" },
  { id: 4, name: "Level 2 Support Manager" },
  { id: 5, name: "ISP Provider" },
];

export function useShiftRegister({ currentAgent, activeCompanyId, apiStatus, showToast }) {
  const [issues, setIssues] = useState([]);
  const [shifts, setShifts] = useState(DEFAULT_SHIFTS);
  const [escalationTargets, setEscalationTargets] = useState(DEFAULT_TARGETS);
  const [loading, setLoading] = useState(false);
  const [activeShiftName, setActiveShiftName] = useState("");

  const companyPrefix = activeCompanyId ? `COMP_${activeCompanyId}` : "COMP_DEFAULT";
  const agentInitials = currentAgent?.agent_initials || "DEFAULT";

  // Helper to determine current active shift based on local time
  const getCurrentActiveShift = useCallback(() => {
    if (!shifts || shifts.length === 0) return "General Shift";
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    for (const s of shifts) {
      if (!s.is_active) continue;
      const [startH, startM] = (s.start_time || "00:00").split(":").map(Number);
      const [endH, endM] = (s.end_time || "23:59").split(":").map(Number);

      const startTotal = startH * 60 + (startM || 0);
      const endTotal = endH * 60 + (endM || 0);

      if (startTotal <= endTotal) {
        if (currentMins >= startTotal && currentMins < endTotal) {
          return s.name;
        }
      } else {
        if (currentMins >= startTotal || currentMins < endTotal) {
          return s.name;
        }
      }
    }
    return shifts[0]?.name || "General Shift";
  }, [shifts]);

  // Set default active shift if not explicitly selected by agent
  useEffect(() => {
    const saved = localStorage.getItem(`REA_SIR_ACTIVE_SHIFT_${agentInitials}`);
    if (saved) {
      setActiveShiftName(saved);
    } else if (!activeShiftName && shifts.length > 0) {
      setActiveShiftName(getCurrentActiveShift());
    }
  }, [shifts, getCurrentActiveShift, agentInitials]);

  const handleSelectActiveShift = (shiftName) => {
    setActiveShiftName(shiftName);
    try {
      localStorage.setItem(`REA_SIR_ACTIVE_SHIFT_${agentInitials}`, shiftName);
      showToast?.(`Selected active shift: '${shiftName}'`);
    } catch (e) {
      // Ignore
    }
  };

  // Load shifts, targets, and issues
  const loadSirData = useCallback(async () => {
    setLoading(true);
    let loadedFromApi = false;

    if (apiStatus !== "offline") {
      try {
        const [shiftsData, targetsData, issuesData] = await Promise.all([
          fetchSirShiftsApi(),
          fetchSirTargetsApi(),
          fetchSirIssuesApi(),
        ]);

        if (Array.isArray(shiftsData) && shiftsData.length > 0) setShifts(shiftsData);
        if (Array.isArray(targetsData) && targetsData.length > 0) setEscalationTargets(targetsData);
        if (Array.isArray(issuesData)) setIssues(issuesData);
        loadedFromApi = true;
      } catch (err) {
        console.warn("API fetch failed for SIR, loading from local storage:", err);
      }
    }

    if (!loadedFromApi) {
      try {
        const localShifts = localStorage.getItem(`REA_SIR_SHIFTS_${companyPrefix}`);
        if (localShifts) setShifts(JSON.parse(localShifts));

        const localTargets = localStorage.getItem(`REA_SIR_TARGETS_${companyPrefix}`);
        if (localTargets) setEscalationTargets(JSON.parse(localTargets));

        const localIssues = localStorage.getItem(`REA_SIR_ISSUES_${companyPrefix}`);
        if (localIssues) setIssues(JSON.parse(localIssues));
      } catch (e) {
        console.error("Failed to parse local SIR data", e);
      }
    }

    setLoading(false);
  }, [apiStatus, companyPrefix]);

  useEffect(() => {
    loadSirData();
  }, [loadSirData, activeCompanyId]);

  // Save to local storage sync
  useEffect(() => {
    try {
      localStorage.setItem(`REA_SIR_ISSUES_${companyPrefix}`, JSON.stringify(issues));
      localStorage.setItem(`REA_SIR_SHIFTS_${companyPrefix}`, JSON.stringify(shifts));
      localStorage.setItem(`REA_SIR_TARGETS_${companyPrefix}`, JSON.stringify(escalationTargets));
    } catch (e) {
      console.error("Local storage error for SIR", e);
    }
  }, [issues, shifts, escalationTargets, companyPrefix]);

  // Handle Issue CRUD
  const handleCreateIssue = async (payload) => {
    const currentShift = getCurrentActiveShift();
    const fullPayload = {
      ...payload,
      shift_name: payload.shift_name || currentShift,
      logged_by_name: currentAgent?.agent_name || "Support Agent",
      logged_by_initials: currentAgent?.agent_initials || "SA",
    };

    if (apiStatus !== "offline") {
      try {
        const created = await createSirIssueApi(fullPayload);
        setIssues((prev) => [created, ...prev]);
        showToast?.(`Recorded issue '${created.reference_no}'`);
        return created;
      } catch (err) {
        showToast?.(err.message || "Failed to record issue online, saving locally");
      }
    }

    // Offline Fallback
    const refNo = `SIR-${1001 + issues.length}`;
    const localObj = {
      ...fullPayload,
      id: Date.now(),
      reference_no: refNo,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setIssues((prev) => [localObj, ...prev]);
    showToast?.(`Recorded issue '${refNo}' (Offline)`);
    return localObj;
  };

  const handleUpdateIssue = async (id, payload) => {
    if (apiStatus !== "offline") {
      try {
        const updated = await updateSirIssueApi(id, payload);
        setIssues((prev) => prev.map((item) => (item.id === id ? updated : item)));
        showToast?.(`Updated issue '${updated.reference_no}'`);
        return updated;
      } catch (err) {
        showToast?.(err.message || "Failed to update issue online");
      }
    }

    // Local Fallback
    setIssues((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, ...payload, updated_at: new Date().toISOString() } : item
      )
    );
    showToast?.("Updated issue locally");
  };

  const handleDeleteIssue = async (id) => {
    if (apiStatus !== "offline") {
      try {
        await deleteSirIssueApi(id);
      } catch (err) {
        console.warn("Delete API failed, removing locally", err);
      }
    }

    setIssues((prev) => prev.filter((item) => item.id !== id));
    showToast?.("Deleted shift issue record");
  };

  // Handle Shift Config CRUD (Admin Control)
  const handleCreateShift = async (payload) => {
    if (apiStatus !== "offline") {
      try {
        const created = await createSirShiftApi(payload);
        setShifts((prev) => [...prev, created]);
        showToast?.(`Shift '${created.name}' created`);
        return created;
      } catch (err) {
        showToast?.(err.message || "Failed to create shift online");
      }
    }

    const localObj = { ...payload, id: Date.now(), is_active: payload.is_active ?? true };
    setShifts((prev) => [...prev, localObj]);
    showToast?.(`Shift '${payload.name}' saved locally`);
    return localObj;
  };

  const handleUpdateShift = async (id, payload) => {
    if (apiStatus !== "offline") {
      try {
        const updated = await updateSirShiftApi(id, payload);
        setShifts((prev) => prev.map((s) => (s.id === id ? updated : s)));
        showToast?.(`Shift '${updated.name}' updated`);
        return updated;
      } catch (err) {
        showToast?.(err.message || "Failed to update shift online");
      }
    }

    setShifts((prev) => prev.map((s) => (s.id === id ? { ...s, ...payload } : s)));
    showToast?.("Shift updated locally");
  };

  const handleDeleteShift = async (id) => {
    if (apiStatus !== "offline") {
      try {
        await deleteSirShiftApi(id);
      } catch (err) {
        console.warn("Shift delete API error", err);
      }
    }

    setShifts((prev) => prev.filter((s) => s.id !== id));
    showToast?.("Shift configuration deleted");
  };

  // Handle Escalation Target CRUD (Admin Control)
  const handleCreateTarget = async (name) => {
    if (apiStatus !== "offline") {
      try {
        const created = await createSirTargetApi({ name });
        setEscalationTargets((prev) => [...prev, created]);
        showToast?.(`Escalation target '${name}' added`);
        return created;
      } catch (err) {
        showToast?.(err.message || "Failed to add target online");
      }
    }

    const localObj = { id: Date.now(), name };
    setEscalationTargets((prev) => [...prev, localObj]);
    showToast?.(`Target '${name}' added locally`);
    return localObj;
  };

  const handleDeleteTarget = async (id) => {
    if (apiStatus !== "offline") {
      try {
        await deleteSirTargetApi(id);
      } catch (err) {
        console.warn("Target delete API error", err);
      }
    }

    setEscalationTargets((prev) => prev.filter((t) => t.id !== id));
    showToast?.("Escalation target deleted");
  };

  return {
    issues,
    shifts,
    escalationTargets,
    loading,
    activeShiftName,
    setActiveShiftName,
    handleSelectActiveShift,
    getCurrentActiveShift,
    handleCreateIssue,
    handleUpdateIssue,
    handleDeleteIssue,
    handleCreateShift,
    handleUpdateShift,
    handleDeleteShift,
    handleCreateTarget,
    handleDeleteTarget,
    loadSirData,
  };
}
