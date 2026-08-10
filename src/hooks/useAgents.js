import { useState, useEffect } from "react";
import {
  AGENT_KEY,
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
        // Fallback update
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
          } catch (err) {}
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
          } catch (err) {}
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
    if (!window.confirm("Are you sure you want to delete this agent?")) return;
    try {
      if (apiStatus !== "offline") {
        try {
          await deleteAgentApi(agentId);
        } catch (err) {}
      }
      setAgents((curr) => curr.filter((a) => a.id !== agentId));
      showToast("Agent profile deleted 🗑️");
    } catch (err) {
      alert("Failed to delete agent");
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
    pinErrorMsg,
    handleChangeAdminPin,
    // Agent CRUD
    editAgentId,
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
