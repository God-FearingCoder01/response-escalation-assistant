import { useState, useEffect } from "react";
import {
  AGENT_KEY,
  AGENT_TOKEN_KEY,
  ADMIN_TOKEN_KEY,
  ADMIN_INITIALS_KEY,
  DEFAULT_AGENTS,
  fetchAgentsApi,
  createAgentApi,
  updateAgentApi,
  deleteAgentApi,
  resetAgentPinApi,
  verifyAgentPinApi,
  changeAgentPinApi,
  fetchAgentSessionApi,
  generateInitials,
} from "../services/api";

function getSessionExpiryMs(token) {
  try {
    const encoded = token.split(".")[0].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(window.atob(encoded)).exp * 1000;
  } catch {
    return Date.now() + 8 * 60 * 60 * 1000;
  }
}

export function useAgents({ apiStatus, showToast }) {
  const [agents, setAgents] = useState(DEFAULT_AGENTS);
  const [currentAgent, setCurrentAgent] = useState(null);

  const [activeScreen, setActiveScreen] = useState(() =>
    currentAgent ? "tech_escalation" : "welcome"
  );

  // Redirection safety check: redirect non-admin agents away from admin dashboard
  useEffect(() => {
    if (activeScreen === "admin" && currentAgent && !currentAgent.is_admin) {
      setActiveScreen("tech_escalation");
    }
  }, [activeScreen, currentAgent]);

  // Edit agent form states (Admin Dashboard)
  const [editAgentId, setEditAgentId] = useState(null);
  const [editAgentFullName, setEditAgentFullName] = useState("");
  const [editAgentName, setEditAgentName] = useState("");
  const [editAgentInitials, setEditAgentInitials] = useState("");
  const [editAgentIsAdmin, setEditAgentIsAdmin] = useState(false);
  const [userCustomizedInitials, setUserCustomizedInitials] = useState(false);

  // PIN Security Modal States
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingAdminAgent, setPendingAdminAgent] = useState(null);
  const [showPinSetupModal, setShowPinSetupModal] = useState(false);
  const [pinSetupError, setPinSetupError] = useState("");
  const [pinDigits, setPinDigits] = useState(["", "", "", ""]);
  const [pinError, setPinError] = useState("");

  // Admin Dashboard PIN Change States
  const [adminCurrentPin, setAdminCurrentPin] = useState("");
  const [adminNewPin, setAdminNewPin] = useState("");
  const [adminConfirmPin, setAdminConfirmPin] = useState("");
  const [pinSuccessMsg, setPinSuccessMsg] = useState("");
  const [pinErrorMsg, setPinErrorMsg] = useState("");

  // Auto-clear PIN change notifications after 4-5 seconds
  useEffect(() => {
    if (pinSuccessMsg) {
      const timer = setTimeout(() => setPinSuccessMsg(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [pinSuccessMsg]);

  useEffect(() => {
    if (pinErrorMsg) {
      const timer = setTimeout(() => setPinErrorMsg(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [pinErrorMsg]);

  // Auto-generate initials from agent full name unless manually customized
  useEffect(() => {
    if (!userCustomizedInitials && editAgentFullName) {
      setEditAgentInitials(generateInitials(editAgentFullName));
    }
  }, [editAgentFullName, userCustomizedInitials]);

  const loadAgents = async () => {
    try {
      const data = await fetchAgentsApi();
      if (Array.isArray(data) && data.length > 0) {
        setAgents(data);
        return;
      }
    } catch (e) {}
    setAgents(DEFAULT_AGENTS);
  };

  useEffect(() => {
    loadAgents();
  }, [apiStatus]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(AGENT_KEY);
    const storedToken = window.sessionStorage.getItem(AGENT_TOKEN_KEY);
    let storedAgent = null;
    try { storedAgent = JSON.parse(window.sessionStorage.getItem(AGENT_KEY) || "null"); } catch (e) {}
    if (!storedToken || !storedAgent) {
      window.sessionStorage.removeItem(AGENT_TOKEN_KEY);
      window.sessionStorage.removeItem(AGENT_KEY);
      return;
    }
    let active = true;
    fetchAgentSessionApi().then((session) => {
      if (!active) return;
      if (session?.valid) {
        setCurrentAgent(storedAgent);
        setActiveScreen("tech_escalation");
      } else {
        window.sessionStorage.removeItem(AGENT_TOKEN_KEY);
        window.sessionStorage.removeItem(AGENT_KEY);
      }
    }).catch(() => {
      if (!active) return;
      window.sessionStorage.removeItem(AGENT_TOKEN_KEY);
      window.sessionStorage.removeItem(AGENT_KEY);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!currentAgent || typeof window === "undefined") return;
    let idleTimer;
    const expiresAt = getSessionExpiryMs(window.sessionStorage.getItem(AGENT_TOKEN_KEY) || "");
    const lockSession = () => {
      window.sessionStorage.removeItem(AGENT_KEY);
      window.sessionStorage.removeItem(AGENT_TOKEN_KEY);
      setCurrentAgent(null);
      setActiveScreen("welcome");
    };
    const resetTimer = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(lockSession, 15 * 60 * 1000);
    };
    const maxSessionTimer = window.setTimeout(lockSession, Math.max(0, expiresAt - Date.now()));
    ["pointerdown", "keydown", "touchstart", "mousemove"].forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      window.clearTimeout(idleTimer);
      window.clearTimeout(maxSessionTimer);
      ["pointerdown", "keydown", "touchstart", "mousemove"].forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [currentAgent]);

  // Agent profiles all require server-side PIN verification before protected data can load.
  const handleSelectAgent = (agent) => {
    setPendingAdminAgent(agent);
    setPinDigits(["", "", "", ""]);
    setPinError("");
    setShowPinModal(true);
  };

  // Verify every agent PIN and establish a company-scoped API session.
  const verifyPin = async (enteredPin) => {
    if (!pendingAdminAgent) return;
    const pin = enteredPin || pinDigits.join("");
    if (!/^\d{4}$/.test(pin)) {
      setPinError("Please enter a complete 4-digit PIN.");
      return;
    }
    setPinError("");
    try {
      if (apiStatus === "offline") throw new Error("The server is unavailable. Connect to the network and try again.");
      const res = await verifyAgentPinApi(pendingAdminAgent.agent_initials, pin);
      if (!res.valid) throw new Error(res.detail || "Incorrect 4-digit PIN.");
      if (res.pin_change_required) {
        window.sessionStorage.setItem(AGENT_TOKEN_KEY, res.setup_token);
        window.sessionStorage.setItem(AGENT_KEY, JSON.stringify(res.agent || pendingAdminAgent));
        setShowPinModal(false);
        setPinSetupError("");
        setShowPinSetupModal(true);
        return;
      }
      finishAgentLogin(res.agent || pendingAdminAgent, res.token);
    } catch (err) {
      setPinError(err instanceof Error ? err.message : "PIN verification failed.");
      setPinDigits(["", "", "", ""]);
    }
  };

  const finishAgentLogin = (agent, token) => {
    if (!token) throw new Error("The server did not establish an authenticated session.");
    setCurrentAgent(agent);
    window.sessionStorage.setItem(AGENT_KEY, JSON.stringify(agent));
    window.sessionStorage.setItem(AGENT_TOKEN_KEY, token);
    window.sessionStorage.removeItem("rea_agent_setup_session_v1");
    window.localStorage.removeItem(AGENT_KEY);
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    window.localStorage.removeItem(ADMIN_INITIALS_KEY);
    setShowPinModal(false);
    setShowPinSetupModal(false);
    setPendingAdminAgent(null);
    setPinDigits(["", "", "", ""]);
    setActiveScreen("tech_escalation");
    showToast(`Welcome, ${agent.agent_name}! 🔒`);
  };

  const completePinSetup = async (newPin) => {
    setPinSetupError("");
    try {
      const agent = pendingAdminAgent;
      const setupToken = window.sessionStorage.getItem(AGENT_TOKEN_KEY);
      const result = await changeAgentPinApi(agent.agent_initials, "", newPin, setupToken);
      finishAgentLogin(result.agent || agent, result.token);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save your PIN.";
      if (/expired|no longer valid|already been used/i.test(message)) {
        window.sessionStorage.removeItem(AGENT_TOKEN_KEY);
        window.sessionStorage.removeItem(AGENT_KEY);
        setShowPinSetupModal(false);
        setPinDigits(["", "", "", ""]);
        setPinError("Setup session expired. Sign in again to continue.");
        setShowPinModal(true);
      } else {
        setPinSetupError(message);
      }
    }
  };

  const changeCurrentAgentPin = async (currentPin, newPin) => {
    if (!currentAgent?.agent_initials) throw new Error("Sign in before changing your PIN.");
    if (apiStatus === "offline") throw new Error("The server is unavailable. Connect to the network and try again.");
    const result = await changeAgentPinApi(currentAgent.agent_initials, currentPin, newPin);
    if (!result.token || !result.agent) throw new Error("The server could not update your PIN.");
    window.sessionStorage.setItem(AGENT_TOKEN_KEY, result.token);
    window.sessionStorage.setItem(AGENT_KEY, JSON.stringify(result.agent));
    setCurrentAgent(result.agent);
    setAgents((curr) => curr.map((agent) => agent.agent_initials === result.agent.agent_initials ? result.agent : agent));
    return result.agent;
  };

  // Change the current profile PIN.
  const handleChangeAdminPin = async (e) => {
    if (e) e.preventDefault();
    setPinSuccessMsg("");
    setPinErrorMsg("");

    if (adminNewPin.length !== 4 || !/^\d{4}$/.test(adminNewPin)) {
      setPinErrorMsg("New PIN must be exactly 4 numeric digits");
      return;
    }
    if (adminNewPin !== adminConfirmPin) {
      setPinErrorMsg("New PIN and Confirm PIN do not match");
      return;
    }

    try {
      await changeCurrentAgentPin(adminCurrentPin, adminNewPin);
    } catch (err) {
      setPinErrorMsg(err instanceof Error ? err.message : "Failed to update PIN");
      return;
    }

    setAdminCurrentPin("");
    setAdminNewPin("");
    setAdminConfirmPin("");
    setPinSuccessMsg("Security PIN updated successfully! 🔒");
    showToast("Security PIN updated successfully! 🔒");
  };

  // Admin Agent CRUD Handlers
  const handleEditAgentClick = (agent) => {
    setEditAgentId(agent.id);
    setEditAgentFullName(agent.agent || "");
    setEditAgentName(agent.agent_name || "");
    setEditAgentInitials(agent.agent_initials || "");
    setEditAgentIsAdmin(agent.is_admin || false);
    setUserCustomizedInitials(true);
  };

  const handleResetAgentForm = () => {
    setEditAgentId(null);
    setEditAgentFullName("");
    setEditAgentName("");
    setEditAgentInitials("");
    setEditAgentIsAdmin(false);
    setUserCustomizedInitials(false);
  };

  const handleCreateOrUpdateAgent = async (e) => {
    if (e) e.preventDefault();
    if (!editAgentFullName.trim() || !editAgentName.trim() || !editAgentInitials.trim()) {
      alert("Please fill in full name, display name, and initials");
      return;
    }

    const payload = {
      agent: editAgentFullName.trim(),
      agent_name: editAgentName.trim(),
      agent_initials: editAgentInitials.trim().toUpperCase(),
      is_admin: editAgentIsAdmin,
    };

    try {
      if (editAgentId) {
        if (apiStatus !== "offline") {
          try {
            const updated = await updateAgentApi(editAgentId, payload);
            setAgents((curr) => curr.map((a) => (a.id === editAgentId ? updated : a)));
            showToast("Agent profile updated successfully! 👤");
            handleResetAgentForm();
            return;
          } catch (err) {
            if (err instanceof Error && err.message === "Failed to fetch") {
              // Fallback to local offline mode
            } else {
              showToast(`Error: ${err instanceof Error ? err.message : "Agent update failed"} ⚠️`);
              return;
            }
          }
        }
        setAgents((curr) =>
          curr.map((a) => (a.id === editAgentId ? { ...a, ...payload } : a))
        );
        showToast("Agent profile updated locally 👤");
      } else {
        if (apiStatus !== "offline") {
          try {
            const created = await createAgentApi(payload);
            setAgents((curr) => [...curr, created]);
            if (created.setup_pin) {
              window.alert(`One-time setup PIN for ${created.agent_name}: ${created.setup_pin}\n\nShare it with the agent privately. They must choose a new PIN at first sign-in.`);
            } else {
              showToast("New agent added successfully! 👤");
            }
            handleResetAgentForm();
            return;
          } catch (err) {
            if (err instanceof Error && err.message === "Failed to fetch") {
              // Fallback to local offline mode
            } else {
              showToast(`Error: ${err instanceof Error ? err.message : "Failed to create agent"} ⚠️`);
              return;
            }
          }
        }
        const newAgent = { id: Date.now(), ...payload };
        setAgents((curr) => [...curr, newAgent]);
        showToast("New agent added locally 👤");
      }
      handleResetAgentForm();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Agent update failed");
    }
  };

  const handleDeleteAgent = async (agentId) => {
    const targetAgent = agents.find((a) => a.id === agentId);
    if (targetAgent && (targetAgent.agent_initials === "SA" || targetAgent.agent_name === "Sys_Admin")) {
      showToast("Security Protection: The System Admin profile (Sys_Admin / SA) cannot be deleted. 🛡️");
      return;
    }
    const adminCount = agents.filter((a) => a.is_admin).length;
    if (targetAgent?.is_admin && adminCount <= 1) {
      showToast("Security Protection: Cannot delete the last remaining System Admin profile. 🛡️");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this agent?")) return;
    try {
      if (apiStatus !== "offline") {
        try {
          await deleteAgentApi(agentId);
          setAgents((curr) => curr.filter((a) => a.id !== agentId));
          showToast("Agent profile deleted 🗑️");
          return;
        } catch (err) {
          if (err instanceof Error && err.message === "Failed to fetch") {
            // Fallback to local offline mode
          } else {
            showToast(`Error: ${err instanceof Error ? err.message : "Failed to delete agent"} ⚠️`);
            return;
          }
        }
      }
      setAgents((curr) => curr.filter((a) => a.id !== agentId));
      showToast("Agent profile deleted 🗑️");
    } catch (err) {
      alert("Failed to delete agent");
    }
  };

  const handleResetAgentPin = async (agentId) => {
    const targetAgent = agents.find((agent) => agent.id === agentId);
    if (!targetAgent || targetAgent.is_admin) return;
    const confirmed = window.confirm(`Reset ${targetAgent.agent_name}'s PIN? They will need to choose a new PIN at next sign-in.`);
    if (!confirmed) return;
    try {
      const result = await resetAgentPinApi(agentId);
      if (result?.agent) {
        setAgents((curr) => curr.map((agent) => agent.id === agentId ? result.agent : agent));
      }
      if (result?.setup_pin) {
        window.alert(`One-time setup PIN for ${targetAgent.agent_name}: ${result.setup_pin}\n\nShare it with the agent privately. They must choose a new PIN at next sign-in.`);
      } else {
        showToast(`PIN reset for ${targetAgent.agent_name}. They must set a new PIN at next sign-in.`);
      }
    } catch (err) {
      showToast(`Error: ${err instanceof Error ? err.message : "Failed to reset agent PIN"} ⚠️`);
    }
  };

  const handleToggleAgentActive = async (agentId) => {
    const targetAgent = (agents || []).find((a) => a.id === agentId);
    if (!targetAgent) return;

    if (targetAgent.agent_initials === "SA" || targetAgent.agent_name === "Sys_Admin") {
      showToast("Security Protection: System Admin profile (Sys_Admin / SA) cannot be deactivated. 🛡️");
      return;
    }

    const newActiveState = targetAgent.is_active === false ? true : false;
    const payload = { is_active: newActiveState };

    try {
      if (apiStatus !== "offline") {
        try {
          const updated = await updateAgentApi(agentId, payload);
          setAgents((curr) => curr.map((a) => (a.id === agentId ? updated : a)));
          showToast(newActiveState ? "Agent profile activated 🟢" : "Agent profile deactivated (hidden from Welcome) 🔴");
          return;
        } catch (err) {
          if (err instanceof Error && err.message === "Failed to fetch") {
            // Fallback to local offline mode
          } else {
            showToast(`Error: ${err instanceof Error ? err.message : "Failed to toggle active status"} ⚠️`);
            return;
          }
        }
      }
      setAgents((curr) =>
        curr.map((a) => (a.id === agentId ? { ...a, is_active: newActiveState } : a))
      );
      showToast(newActiveState ? "Agent profile activated 🟢" : "Agent profile deactivated (hidden from Welcome) 🔴");
    } catch (err) {
      alert("Failed to toggle agent active status");
    }
  };

  return {
    agents,
    setAgents,
    currentAgent,
    setCurrentAgent,
    activeScreen,
    setActiveScreen,
    handleSelectAgent,
    handleToggleAgentActive,
    // PIN Modal
    showPinModal,
    setShowPinModal,
    pendingAdminAgent,
    setPendingAdminAgent,
    showPinSetupModal,
    pinSetupError,
    setPinSetupError,
    completePinSetup,
    changeCurrentAgentPin,
    pinDigits,
    setPinDigits,
    pinError,
    setPinError,
    verifyPin,
    // Admin PIN control
    adminCurrentPin,
    setAdminCurrentPin,
    adminNewPin,
    setAdminNewPin,
    adminConfirmPin,
    setAdminConfirmPin,
    pinSuccessMsg,
    setPinSuccessMsg,
    pinErrorMsg,
    setPinErrorMsg,
    handleChangeAdminPin,
    // Agent CRUD
    editAgentId,
    setEditAgentId,
    editAgentFullName,
    setEditAgentFullName,
    editAgentName,
    setEditAgentName,
    editAgentInitials,
    setEditAgentInitials,
    editAgentIsAdmin,
    setEditAgentIsAdmin,
    userCustomizedInitials,
    setUserCustomizedInitials,
    handleEditAgentClick,
    handleResetAgentForm,
    handleCreateOrUpdateAgent,
    handleDeleteAgent,
    handleResetAgentPin,
  };
}
