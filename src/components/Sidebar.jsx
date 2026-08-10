import { useState } from "react";

export default function Sidebar({
  currentAgent,
  activeScreen,
  setActiveScreen,
  themeMode,
  setThemeMode,
  handleLogout,
}) {
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);

  if (!currentAgent || activeScreen === "welcome") return null;

  return (
    <aside
      onMouseEnter={() => setIsSidebarHovered(true)}
      onMouseLeave={() => setIsSidebarHovered(false)}
      className={`fixed left-0 top-0 bottom-0 z-40 flex flex-col justify-between border-r p-2.5 shadow-2xl backdrop-blur transition-all duration-300 ease-in-out ${
        isSidebarHovered ? "w-64" : "w-16"
      }`}
      style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--sidebar-bg)" }}
    >
      <div className="space-y-6">
        {/* Logo / Header */}
        <div className="flex items-center gap-3 overflow-hidden px-1">
          <img src="/REA.png" alt="REA Logo" className="h-10 w-10 shrink-0 object-contain shadow-lg" />
          {isSidebarHovered ? (
            <span className="font-bold text-lg whitespace-nowrap">
              Assistant
            </span>
          ) : null}
        </div>

        {/* Nav links */}
        <nav className="space-y-2">
          <button
            onClick={() => {
              setActiveScreen("tech_escalation");
              setIsSidebarHovered(false);
            }}
            className={`flex w-full items-center justify-start rounded-2xl p-2.5 font-medium transition-all ${
              activeScreen === "tech_escalation"
                ? "bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] shadow-md"
                : "hover:bg-[var(--neutral-bg)] text-[var(--neutral-text)]"
            }`}
            title="Tech Escalation"
          >
            <span className="flex h-6 w-6 items-center justify-center shrink-0">
              <img src="/Lightning.png" alt="Tech Escalation" className="h-5 w-5 object-contain" />
            </span>
            {isSidebarHovered ? (
              <span className="ml-3 font-semibold text-sm whitespace-nowrap">
                Tech Escalation
              </span>
            ) : null}
          </button>

          <button
            onClick={() => {
              setActiveScreen("customer_reply");
              setIsSidebarHovered(false);
            }}
            className={`flex w-full items-center justify-start rounded-2xl p-2.5 font-medium transition-all ${
              activeScreen === "customer_reply"
                ? "bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] shadow-md"
                : "hover:bg-[var(--neutral-bg)] text-[var(--neutral-text)]"
            }`}
            title="Customer Reply"
          >
            <span className="flex h-6 w-6 items-center justify-center shrink-0">
              <img src="/chat.png" alt="Customer Reply" className="h-5 w-5 object-contain" />
            </span>
            {isSidebarHovered ? (
              <span className="ml-3 font-semibold text-sm whitespace-nowrap">
                Customer Reply
              </span>
            ) : null}
          </button>

          <button
            onClick={() => {
              setActiveScreen("quick_access");
              setIsSidebarHovered(false);
            }}
            className={`flex w-full items-center justify-start rounded-2xl p-2.5 font-medium transition-all ${
              activeScreen === "quick_access"
                ? "bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] shadow-md"
                : "hover:bg-[var(--neutral-bg)] text-[var(--neutral-text)]"
            }`}
            title="Quick Access & Favorites"
          >
            <span className="flex h-6 w-6 items-center justify-center shrink-0 text-base">
              ⭐
            </span>
            {isSidebarHovered ? (
              <span className="ml-3 font-semibold text-sm whitespace-nowrap">
                Favorites & Recents
              </span>
            ) : null}
          </button>

          <button
            onClick={() => {
              setActiveScreen("suggestions");
              setIsSidebarHovered(false);
            }}
            className={`flex w-full items-center justify-start rounded-2xl p-2.5 font-medium transition-all ${
              activeScreen === "suggestions"
                ? "bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] shadow-md"
                : "hover:bg-[var(--neutral-bg)] text-[var(--neutral-text)]"
            }`}
            title="Template Suggestions Hub"
          >
            <span className="flex h-6 w-6 items-center justify-center shrink-0 text-base">
              💡
            </span>
            {isSidebarHovered ? (
              <span className="ml-3 font-semibold text-sm whitespace-nowrap">
                Suggestions Hub
              </span>
            ) : null}
          </button>

          {currentAgent?.is_admin ? (
            <button
              onClick={() => {
                setActiveScreen("admin");
                setIsSidebarHovered(false);
              }}
              className={`flex w-full items-center justify-start rounded-2xl p-2.5 font-medium transition-all ${
                activeScreen === "admin"
                  ? "bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] shadow-md"
                  : "hover:bg-[var(--neutral-bg)] text-[var(--neutral-text)]"
              }`}
              title="System Admin"
            >
              <span className="flex h-6 w-6 items-center justify-center shrink-0">
                <img src="/admin.png" alt="System Admin" className="h-5 w-5 object-contain" />
              </span>
              {isSidebarHovered ? (
                <span className="ml-3 font-semibold text-sm whitespace-nowrap">
                  System Admin
                </span>
              ) : null}
            </button>
          ) : null}
        </nav>
      </div>

      {/* Sidebar Footer Controls */}
      <div className="space-y-3 pt-4 border-t" style={{ borderColor: "var(--panel-border)" }}>
        {/* Theme Toggle */}
        <button
          onClick={() => setThemeMode((c) => (c === "night" ? "day" : "night"))}
          className="flex w-full items-center justify-start rounded-2xl p-2 transition hover:bg-[var(--neutral-bg)] text-sm"
          title={`Switch to ${themeMode === "night" ? "Day" : "Night"} mode`}
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-sm"
            style={{ borderColor: "var(--badge-border)" }}
          >
            <img
              src={themeMode === "night" ? "/moon.png" : "/sun.png"}
              alt={themeMode === "night" ? "Night Mode" : "Day Mode"}
              className="h-4 w-4 shrink-0 object-contain"
            />
          </span>
          {isSidebarHovered ? (
            <span className="ml-3 text-sm font-medium whitespace-nowrap">
              {themeMode === "night" ? "Night Mode" : "Day Mode"}
            </span>
          ) : null}
        </button>

        {/* Profile badge & logout */}
        <div className="flex items-center gap-3 overflow-hidden p-1">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#32324a_0%,#11111e_100%)] text-xs font-bold text-[#4cd34c] border"
            style={{ borderColor: "var(--badge-border)" }}
          >
            {currentAgent.agent_initials}
          </div>
          {isSidebarHovered ? (
            <div className="overflow-hidden whitespace-nowrap">
              <div className="text-xs font-semibold truncate">{currentAgent.agent_name}</div>
              <button onClick={handleLogout} className="text-[10px] text-[#4cd34c] hover:underline block mt-0.5">
                Switch Profile ↩
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
