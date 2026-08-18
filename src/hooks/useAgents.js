import { useState, useEffect } from "react";
import {
  AGENT_KEY,
  ADMIN_TOKEN_KEY,
  ADMIN_INITIALS_KEY,
  DEFAULT_AGENTS,
  fetchAgentsApi,
  createAgentApi,
  updateAgentApi,
  deleteAgentApi,
  verifyAgentPinApi,
  generateInitials,
} from "../services/api";

export function useAgents({ apiStatus, showToast }) {
  const [agents, setAgents] = useState(DEFAULT_AGENTS);
  const [currentAgent, setCurrentAgent] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = window.localStorage.getItem(AGENT_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

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

  // Handle active agent selection from Welcome screen
  const handleSelectAgent = (agent) => {
    if (agent.is_admin) {
      setPendingAdminAgent(agent);
      setPinDigits(["", "", "", ""]);
      setPinError("");
      setShowPinModal(true);
    } else {
      setCurrentAgent(agent);
      try {
        window.localStorage.setItem(AGENT_KEY, JSON.stringify(agent));
        window.localStorage.removeItem(ADMIN_TOKEN_KEY);
        window.localStorage.removeItem(ADMIN_INITIALS_KEY);
      } catch (e) {}
      setActiveScreen("tech_escalation");
    }
  };

  // Verify 4-digit PIN for Admin login
  const verifyPin = async (enteredPin) => {
    if (!pendingAdminAgent) return;
    const pin = enteredPin || pinDigits.join("");
    if (pin.length !== 4) {
      setPinError("Please enter complete 4-digit PIN");
      return;
    }
    setPinError("");

    if (apiStatus !== "offline") {
      try {
        const res = await verifyAgentPinApi(pendingAdminAgent.agent_initials, pin);
        if (res.valid) {
          const verifiedAgent = res.agent || pendingAdminAgent;
          setCurrentAgent(verifiedAgent);
          try {
            window.localStorage.setItem(AGENT_KEY, JSON.stringify(verifiedAgent));
            if (res.token) {
              window.localStorage.setItem(ADMIN_TOKEN_KEY, res.token);
            }
            window.localStorage.setItem(ADMIN_INITIALS_KEY, verifiedAgent.agent_initials);
          } catch (e) {}
          setShowPinModal(false);
          setPendingAdminAgent(null);
          setActiveScreen("tech_escalation");
          showToast(`Welcome back, ${verifiedAgent.agent_name}! 🛡️`);
          return;
        } else {
          setPinError(res.detail || "Incorrect 4-digit Security PIN");
          setPinDigits(["", "", "", ""]);
          return;
        }
      } catch (err) {
        // Fallback to local pin verification if network error
      }
    }

    // Local PIN fallback check (default PIN: 0000 or custom stored pin)
    const expectedPin = pendingAdminAgent.pin || "0000";
    if (pin === expectedPin) {
      setCurrentAgent(pendingAdminAgent);
      try {
        window.localStorage.setItem(AGENT_KEY, JSON.stringify(pendingAdminAgent));
      } catch (e) {}
      setShowPinModal(false);
      setPendingAdminAgent(null);
      setActiveScreen("tech_escalation");
      showToast(`Welcome back, ${pendingAdminAgent.agent_name}! 🛡️`);
    } else {
      setPinError("Incorrect 4-digit Security PIN");
      setPinDigits(["", "", "", ""]);
    }
  };

  // Change Admin Security PIN
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

    const currentInitials = currentAgent?.agent_initials || "SA";
    let updatedAgent = null;

    if (apiStatus !== "offline") {
      try {
        const verifyRes = await verifyAgentPinApi(currentInitials, adminCurrentPin);
        if (!verifyRes.valid) {
          setPinErrorMsg(verifyRes.detail || "Current PIN is incorrect");
          return;
        }
        if (currentAgent?.id) {
          updatedAgent = await updateAgentApi(currentAgent.id, { pin: adminNewPin });
        }
      } catch (err) {
        if (err instanceof Error && err.message === "Failed to fetch") {
          // Fallback update for offline mode
        } else {
          setPinErrorMsg(err instanceof Error ? err.message : "Failed to update Security PIN");
          return;
        }
      }
    }

    if (!updatedAgent) {
      const targetAgent = agents.find((a) => a.agent_initials === currentInitials) || currentAgent;
      if (targetAgent && targetAgent.pin && targetAgent.pin !== adminCurrentPin && adminCurrentPin !== "0000") {
        setPinErrorMsg("Current PIN is incorrect");
        return;
      }
      updatedAgent = { ...(targetAgent || currentAgent), pin: adminNewPin };
    }

    setAgents((curr) => curr.map((a) => (a.agent_initials === currentInitials ? updatedAgent : a)));
    if (currentAgent?.agent_initials === currentInitials) {
      setCurrentAgent(updatedAgent);
      try {
        window.localStorage.setItem(AGENT_KEY, JSON.stringify(updatedAgent));
      } catch (e) {}
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
            showToast("New agent added successfully! 👤");
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
  };
}
