import { useEffect, useState } from "react";
import { AGENT_KEY, fetchHealthApi } from "./services/api";
import { useTheme } from "./hooks/useTheme";
import { useAgents } from "./hooks/useAgents";
import { useUserInteractions } from "./hooks/useUserInteractions";
import { useTemplates } from "./hooks/useTemplates";
import { useSuggestions } from "./hooks/useSuggestions";

import Sidebar from "./components/Sidebar";
import PinModal from "./components/PinModal";
import Toast from "./components/Toast";
import HeaderStatusBar from "./components/HeaderStatusBar";

import WelcomeScreen from "./screens/WelcomeScreen";
import TechEscalation from "./screens/TechEscalation";
import CustomerReply from "./screens/CustomerReply";
import AdminDashboard from "./screens/AdminDashboard";
import SuggestionsHub from "./screens/SuggestionsHub";
import QuickAccess from "./screens/QuickAccess";

export default function App() {
  const { themeMode, setThemeMode, themeConfig } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving] = useState(false);
  const [error, setError] = useState("");
  const [apiStatus, setApiStatus] = useState("checking");
  const [statusMessage, setStatusMessage] = useState("");
  const [values, setValues] = useState({});

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

  // 2. User Interactions hook (toasts, favorites, history, copy actions)
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

  // 3. Templates hook (templates, category filtering, placeholder extraction, message generation, template CRUD)
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

  // 4. Suggestions hook (suggestions, live 5s polling, submissions, approvals, rejections)
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
    setActiveScreen("welcome");
  };

  const generatedMsg = generateMessage(values);

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
        setActiveScreen={setActiveScreen}
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

      <div className={`flex-1 p-6 transition-all duration-300 ${currentAgent && activeScreen !== "welcome" ? "ml-16" : ""}`}>
        <HeaderStatusBar
          activeScreen={activeScreen}
          apiStatus={apiStatus}
          loading={loading}
          currentAgent={currentAgent}
          statusMessage={statusMessage}
          error={error}
        />

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
      </div>

      <Toast toast={toast} />
    </div>
  );
}