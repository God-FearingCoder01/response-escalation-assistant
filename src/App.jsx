import { useEffect, useState, useCallback } from "react";
import { AGENT_KEY, fetchHealthApi } from "./services/api";
import { useTheme } from "./hooks/useTheme";
import { useAgents } from "./hooks/useAgents";
import { useCompany } from "./hooks/useCompany";
import { useUserInteractions } from "./hooks/useUserInteractions";
import { useTemplates } from "./hooks/useTemplates";
import { useSuggestions } from "./hooks/useSuggestions";
import { useTranslator } from "./hooks/useTranslator";

import Sidebar from "./components/Sidebar";
import PinModal from "./components/PinModal";
import SuperAdminPinModal from "./components/SuperAdminPinModal";
import Toast from "./components/Toast";
import HeaderStatusBar from "./components/HeaderStatusBar";

import WelcomeScreen from "./screens/WelcomeScreen";
import TechEscalation from "./screens/TechEscalation";
import CustomerReply from "./screens/CustomerReply";
import AdminDashboard from "./screens/AdminDashboard";
import SuggestionsHub from "./screens/SuggestionsHub";
import QuickAccess from "./screens/QuickAccess";
import TranslatorScreen from "./screens/TranslatorScreen";
import MonitorScreen from "./screens/MonitorScreen";
import DeveloperSupportLanding from "./screens/DeveloperSupportLanding";

export default function App() {
  const { themeMode, setThemeMode, themeConfig } = useTheme();
  const {
    companies,
    activeCompanyId,
    activeCompany,
    switchCompany,
    handleCreateCompany,
    handleUpdateCompany,
  } = useCompany();

  const [loading, setLoading] = useState(true);
  const [saving] = useState(false);
  const [error, setError] = useState("");
  const [apiStatus, setApiStatus] = useState("checking");
  const [statusMessage, setStatusMessage] = useState("");
  const [values, setValues] = useState({});

  // Super Admin Authentication State
  const [isSuperAdminAuth, setIsSuperAdminAuth] = useState(false);
  const [superAdminEmail, setSuperAdminEmail] = useState("gfc.dev@proton.me");

  // Track current location path
  const [currentPath, setCurrentPath] = useState(() => {
    return typeof window !== "undefined" ? window.location.pathname : "/";
  });

  // 1. Agents hook
  const agentState = useAgents({
    apiStatus,
    showToast: (msg) => userInteractions?.showToast?.(msg),
  });

  const {
    agents = [],
    currentAgent = null,
    setCurrentAgent,
    activeScreen = "welcome",
    setActiveScreen,
    handleSelectAgent,
    showPinModal = false,
    setShowPinModal,
    setPendingAdminAgent,
    pinDigits = ["", "", "", ""],
    setPinDigits,
    pinError = "",
    setPinError,
    verifyPin,
    adminCurrentPin = "",
    setAdminCurrentPin,
    adminNewPin = "",
    setAdminNewPin,
    adminConfirmPin = "",
    setAdminConfirmPin,
    pinSuccessMsg = "",
    pinErrorMsg = "",
    handleChangeAdminPin,
    editAgentId = null,
    setEditAgentId,
    editAgentFullName = "",
    setEditAgentFullName,
    editAgentName = "",
    setEditAgentName,
    editAgentInitials = "",
    setEditAgentInitials,
    editAgentIsAdmin = false,
    setEditAgentIsAdmin,
    setUserCustomizedInitials,
    handleEditAgentClick,
    handleResetAgentForm,
    handleCreateOrUpdateAgent,
    handleDeleteAgent,
  } = agentState || {};

  // URL route sync effect
  const syncRouteWithState = useCallback(() => {
    if (typeof window === "undefined") return;
    const path = window.location.pathname;
    setCurrentPath(path);

    if (path === "/monitor" || path.startsWith("/monitor")) {
      setActiveScreen("monitor");
    } else {
      setIsSuperAdminAuth(false);
      if (path !== "/" && activeCompany) {
        const parts = path.split("/").filter(Boolean);
        if (parts.length >= 2) {
          const subRoute = parts[1];
          if (["tech-escalation", "customer-reply", "suggestions", "quick-access", "admin", "translator"].includes(subRoute)) {
            const mapRoute = subRoute.replace("-", "_");
            setActiveScreen(mapRoute);
          }
        }
      }
    }
  }, [activeCompany, setActiveScreen]);

  useEffect(() => {
    syncRouteWithState();
    window.addEventListener("popstate", syncRouteWithState);
    return () => window.removeEventListener("popstate", syncRouteWithState);
  }, [syncRouteWithState]);

  // Navigate helper that syncs URL history
  const handleNavigate = (screen) => {
    if (screen !== "monitor") {
      setIsSuperAdminAuth(false);
    }
    setActiveScreen(screen);
    if (typeof window !== "undefined") {
      let newPath = "/";
      if (screen === "monitor") {
        newPath = "/monitor";
      } else if (screen === "root" || screen === "landing") {
        newPath = "/";
      } else {
        const slug = activeCompany?.slug || "corp-a";
        newPath = `/${slug}`;
      }
      if (window.location.pathname !== newPath) {
        window.history.pushState({}, "", newPath);
        setCurrentPath(newPath);
      }
    }
  };

  const handleSwitchCompanyAndEnter = (companyIdOrSlug) => {
    switchCompany(companyIdOrSlug);
    if (activeScreen === "monitor") {
      setActiveScreen(currentAgent ? "tech_escalation" : "welcome");
    }
  };

  // 2. User Interactions hook
  const userInteractions = useUserInteractions({ currentAgent, apiStatus });
  const {
    showToast = () => {},
    toast = { show: false, message: "" },
    favoriteIds = [],
    usageCounts = {},
    recentlyUsed = [],
    toggleFavorite = () => {},
    copyText = () => {},
  } = userInteractions || {};

  // 3. Templates hook
  const templateState = useTemplates({
    apiStatus,
    activeScreen,
    currentAgent,
    favoriteIds,
    usageCounts,
    recentlyUsed,
    showToast,
  });

  const {
    templates = [],
    refreshTemplates = () => {},
    selectedTechId = null,
    setSelectedTechId,
    selectedCustId = null,
    setSelectedCustId,
    selectedCategory = "All",
    setSelectedCategory,
    selectedSubcategory = "All",
    setSelectedSubcategory,
    replyChannel = "signed",
    setReplyChannel,
    searchQuery = "",
    setSearchQuery,
    selectedQuickId = null,
    setSelectedQuickId,
    quickTab = "favorites",
    setQuickTab,
    expandedAdminCats = {},
    setExpandedAdminCats,
    adminSubcatFilter = {},
    setAdminSubcatFilter,
    editTplId = null,
    setEditTplId,
    editTplName = "",
    setEditTplName,
    editTplBody = "",
    setEditTplBody,
    editTplType = "tech_escalation",
    setEditTplType,
    editTplCat = "",
    setEditTplCat,
    editTplSubcat = "",
    setEditTplSubcat,
    handleEditTemplateClick,
    handleResetTemplateForm,
    handleCreateOrUpdateTemplate,
    handleDeleteTemplate,
    handleExportTemplates,
    handleImportTemplatesFile,
    handleDeduplicateTemplates,
    techTemplates = [],
    customerCategories = [],
    customerSubcategories = [],
    filteredCustomerTemplates = [],
    favoriteTemplates = [],
    mostUsedTemplates = [],
    recentlyUsedTemplates = [],
    groupedAdminCategories = [],
    activeTemplate = null,
    placeholders = [],
    generateMessage = () => "",
  } = templateState || {};

  // 4. Suggestions hook
  const suggestionState = useSuggestions({
    activeScreen,
    apiStatus,
    currentAgent,
    refreshTemplates,
    showToast,
    setError,
  });

  const {
    suggestions = [],
    sugName = "",
    setSugName,
    sugBody = "",
    setSugBody,
    sugType = "customer_reply",
    setSugType,
    sugCat = "",
    setSugCat,
    sugSubcat = "",
    setSugSubcat,
    sugSubmitting = false,
    sugFilterStatus = "all",
    setSugFilterStatus,
    handleSubmitSuggestion,
    handleApproveSuggestion,
    handleRejectSuggestion,
  } = suggestionState || {};

  // 5. Translator hook
  const translatorState = useTranslator({ currentAgent, showToast });

  // Check health status on app initialization
  useEffect(() => {
    async function checkHealth() {
      try {
        const data = await fetchHealthApi();
        if (data && data.status === "ok") {
          setApiStatus("online");
          setStatusMessage(data.message || "Backend connected");
        } else {
          setApiStatus("offline");
          setStatusMessage("Backend server offline. Running in local fallback mode.");
        }
      } catch {
        setApiStatus("offline");
        setStatusMessage("Backend server offline. Running in local fallback mode.");
      } finally {
        setLoading(false);
      }
    }
    checkHealth();
  }, []);

  const handleLogout = () => {
    setCurrentAgent(null);
    try {
      window.localStorage.removeItem(AGENT_KEY);
    } catch (e) {}
    handleNavigate("welcome");
  };

  const generatedMsg = generateMessage(values);

  // Route matching analysis
  const pathParts = currentPath.split("/").filter(Boolean);
  const isRoot = currentPath === "/" || pathParts.length === 0;
  const isMonitorRoute = currentPath === "/monitor" || pathParts[0] === "monitor";

  // Check if current URL slug matches a known company
  const slugFromUrl = pathParts.length > 0 && !isMonitorRoute ? pathParts[0].toLowerCase() : null;
  const matchedCompany = slugFromUrl ? companies.find((c) => c.slug.toLowerCase() === slugFromUrl) : null;
  const isCompanyRoute = !!matchedCompany;
  const isCompanyInactive = matchedCompany && matchedCompany.is_active === false;

  // Render Root or Unregistered URL Landing page
  if (isRoot || (!isMonitorRoute && !isCompanyRoute)) {
    return (
      <DeveloperSupportLanding
        themeMode={themeMode}
        setThemeMode={setThemeMode}
        themeConfig={themeConfig}
      />
    );
  }

  // Render Inactive Organization Page if company is deactivated
  if (isCompanyRoute && isCompanyInactive) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-black/80 backdrop-blur animate-fade-in text-center">
        <div className="max-w-xl w-full rounded-3xl border border-red-500/30 p-8 shadow-2xl space-y-6 bg-[#12121a]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-3xl text-red-400 border border-red-500/30">
            🚫
          </div>
          <h2 className="text-2xl font-black text-white">
            Organization Space Inactive
          </h2>
          <p className="text-sm text-gray-300 leading-relaxed">
            The organization space for <strong className="text-red-400">/{matchedCompany.name}</strong> (<code className="text-white font-mono">/{matchedCompany.slug}</code>) is currently set to <strong>Inactive</strong> by the system super administrator.
          </p>
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-xs text-red-300">
            Please contact <strong>System Support / Developer</strong> to reactivate this organization space or update your company URL.
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => handleNavigate("monitor")}
              className="rounded-xl border border-gray-700 px-4 py-2.5 text-xs font-semibold text-gray-300 hover:bg-gray-800 cursor-pointer"
            >
              Super Admin Dashboard (/monitor)
            </button>
            <a
              href="mailto:gfc.dev@proton.me"
              className="rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] px-5 py-2.5 text-xs font-bold text-[#071007] hover:opacity-90 shadow-md cursor-pointer"
            >
              Contact Developer
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen transition-colors duration-300 font-sans relative flex"
      style={{
        backgroundImage: themeConfig?.overlay || "",
        backgroundColor: "var(--app-bg)",
        color: "var(--app-text)",
      }}
    >
      <Sidebar
        currentAgent={currentAgent}
        activeScreen={activeScreen}
        setActiveScreen={handleNavigate}
        themeMode={themeMode}
        setThemeMode={setThemeMode}
        handleLogout={handleLogout}
      />

      <PinModal
        showPinModal={showPinModal}
        setShowPinModal={setShowPinModal}
        setPendingAdminAgent={setPendingAdminAgent}
        pinDigits={pinDigits}
        setPinDigits={setPinDigits}
        pinError={pinError}
        setPinError={setPinError}
        verifyPin={verifyPin}
      />

      {/* Super Admin 4-digit PIN lock for /monitor */}
      {activeScreen === "monitor" && !isSuperAdminAuth && (
        <SuperAdminPinModal
          isOpen={true}
          onAuthenticated={(token, email) => {
            setIsSuperAdminAuth(true);
            if (email) setSuperAdminEmail(email);
          }}
          onCancel={() => handleNavigate("root")}
          showToast={showToast}
        />
      )}

      <div className={`flex-1 p-6 transition-all duration-300 ${currentAgent && activeScreen !== "welcome" && activeScreen !== "monitor" ? "ml-16" : ""}`}>
        <HeaderStatusBar
          activeScreen={activeScreen}
          apiStatus={apiStatus}
          loading={loading}
          currentAgent={currentAgent}
          statusMessage={statusMessage}
          error={error}
          companies={companies}
          activeCompanyId={activeCompanyId}
          switchCompany={handleSwitchCompanyAndEnter}
          handleNavigate={handleNavigate}
        />

        {activeScreen === "monitor" && isSuperAdminAuth && (
          <MonitorScreen
            activeScreen={activeScreen}
            currentAgent={currentAgent}
            companies={companies}
            activeCompanyId={activeCompanyId}
            switchCompany={handleSwitchCompanyAndEnter}
            handleCreateCompany={handleCreateCompany}
            handleUpdateCompany={handleUpdateCompany}
            handleNavigate={handleNavigate}
            superAdminEmail={superAdminEmail}
            themeMode={themeMode}
            setThemeMode={setThemeMode}
            showToast={showToast}
          />
        )}

        <WelcomeScreen
          activeScreen={activeScreen}
          currentAgent={currentAgent}
          agents={agents}
          handleSelectAgent={handleSelectAgent}
        />

        <TechEscalation
          activeScreen={activeScreen}
          currentAgent={currentAgent}
          techTemplates={techTemplates}
          selectedTechId={selectedTechId}
          setSelectedTechId={setSelectedTechId}
          favoriteIds={favoriteIds}
          toggleFavorite={toggleFavorite}
          activeTemplate={activeTemplate}
          placeholders={placeholders}
          values={values}
          setValues={setValues}
          generatedMsg={generatedMsg}
          copyText={copyText}
        />

        <CustomerReply
          activeScreen={activeScreen}
          currentAgent={currentAgent}
          replyChannel={replyChannel}
          setReplyChannel={setReplyChannel}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          customerCategories={customerCategories}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          customerSubcategories={customerSubcategories}
          selectedSubcategory={selectedSubcategory}
          setSelectedSubcategory={setSelectedSubcategory}
          filteredCustomerTemplates={filteredCustomerTemplates}
          setSelectedCustId={setSelectedCustId}
          activeTemplate={activeTemplate}
          favoriteIds={favoriteIds}
          toggleFavorite={toggleFavorite}
          placeholders={placeholders}
          values={values}
          setValues={setValues}
          generatedMsg={generatedMsg}
          copyText={copyText}
        />

        <AdminDashboard
          activeScreen={activeScreen}
          currentAgent={currentAgent}
          saving={saving}
          templates={templates}
          exportTemplates={handleExportTemplates}
          importTemplatesFile={handleImportTemplatesFile}
          handleDeduplicateTemplates={handleDeduplicateTemplates}
          editTplId={editTplId}
          setEditTplId={setEditTplId}
          editTplName={editTplName}
          setEditTplName={setEditTplName}
          editTplBody={editTplBody}
          setEditTplBody={setEditTplBody}
          editTplType={editTplType}
          setEditTplType={setEditTplType}
          editTplCat={editTplCat}
          setEditTplCat={setEditTplCat}
          editTplSubcat={editTplSubcat}
          setEditTplSubcat={setEditTplSubcat}
          handleEditTemplateClick={handleEditTemplateClick}
          handleResetTemplateForm={handleResetTemplateForm}
          handleCreateOrUpdateTemplate={handleCreateOrUpdateTemplate}
          handleDeleteTemplate={handleDeleteTemplate}
          groupedAdminCategories={groupedAdminCategories}
          expandedAdminCats={expandedAdminCats}
          setExpandedAdminCats={setExpandedAdminCats}
          adminSubcatFilter={adminSubcatFilter}
          setAdminSubcatFilter={setAdminSubcatFilter}
          agents={agents}
          editAgentId={editAgentId}
          setEditAgentId={setEditAgentId}
          editAgentFullName={editAgentFullName}
          setEditAgentFullName={setEditAgentFullName}
          editAgentName={editAgentName}
          setEditAgentName={setEditAgentName}
          editAgentInitials={editAgentInitials}
          setEditAgentInitials={setEditAgentInitials}
          editAgentIsAdmin={editAgentIsAdmin}
          setEditAgentIsAdmin={setEditAgentIsAdmin}
          setUserCustomizedInitials={setUserCustomizedInitials}
          handleEditAgentClick={handleEditAgentClick}
          handleResetAgentForm={handleResetAgentForm}
          handleCreateOrUpdateAgent={handleCreateOrUpdateAgent}
          handleDeleteAgent={handleDeleteAgent}
          adminCurrentPin={adminCurrentPin}
          setAdminCurrentPin={setAdminCurrentPin}
          adminNewPin={adminNewPin}
          setAdminNewPin={setAdminNewPin}
          adminConfirmPin={adminConfirmPin}
          setAdminConfirmPin={setAdminConfirmPin}
          pinSuccessMsg={pinSuccessMsg}
          pinErrorMsg={pinErrorMsg}
          handleChangeAdminPin={handleChangeAdminPin}
        />

        <SuggestionsHub
          activeScreen={activeScreen}
          currentAgent={currentAgent}
          suggestions={suggestions}
          sugName={sugName}
          setSugName={setSugName}
          sugBody={sugBody}
          setSugBody={setSugBody}
          sugType={sugType}
          setSugType={setSugType}
          sugCat={sugCat}
          setSugCat={setSugCat}
          sugSubcat={sugSubcat}
          setSugSubcat={setSugSubcat}
          sugSubmitting={sugSubmitting}
          sugFilterStatus={sugFilterStatus}
          setSugFilterStatus={setSugFilterStatus}
          handleSubmitSuggestion={handleSubmitSuggestion}
          handleApproveSuggestion={handleApproveSuggestion}
          handleRejectSuggestion={handleRejectSuggestion}
        />

        <QuickAccess
          activeScreen={activeScreen}
          currentAgent={currentAgent}
          quickTab={quickTab}
          setQuickTab={setQuickTab}
          favoriteTemplates={favoriteTemplates}
          mostUsedTemplates={mostUsedTemplates}
          recentlyUsedTemplates={recentlyUsedTemplates}
          templates={templates}
          setSelectedQuickId={setSelectedQuickId}
          activeTemplate={activeTemplate}
          toggleFavorite={toggleFavorite}
          favoriteIds={favoriteIds}
          usageCounts={usageCounts}
          placeholders={placeholders}
          values={values}
          setValues={setValues}
          generatedMsg={generatedMsg}
          copyText={copyText}
        />

        {activeScreen === "translator" && (
          <TranslatorScreen
            translatorState={translatorState}
            copyText={copyText}
            showToast={showToast}
          />
        )}
      </div>

      <Toast toast={toast} />
    </div>
  );
}