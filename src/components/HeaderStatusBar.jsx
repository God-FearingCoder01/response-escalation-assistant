export default function HeaderStatusBar({
  activeScreen,
  apiStatus,
  loading,
  currentAgent,
  statusMessage,
  error,
}) {
  return (
    <>
      {/* TOP HEADER BAR */}
      <header
        className="mb-6 flex flex-col gap-4 rounded-3xl border p-4 shadow-[var(--panel-shadow)] backdrop-blur md:flex-row md:items-center md:justify-between"
        style={{ borderColor: "var(--header-border)", backgroundColor: "var(--header-bg)" }}
      >
        <div className="flex items-center gap-4">
          <img
            src="/REA.png"
            alt="REA Logo"
            className="h-12 w-12 shrink-0 object-contain rounded-2xl shadow-md border border-[#4cd34c]/30"
          />
          <div>
            <div
              className="mb-1 inline-flex rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em]"
              style={{
                borderColor: "var(--badge-border)",
                backgroundColor: "var(--badge-bg)",
                color: "var(--badge-text)",
              }}
            >
              RESPONSE & ESCALATION ASSISTANT
            </div>
            <h1 className="text-2xl font-bold md:text-3xl" style={{ color: "var(--header-text)" }}>
              {activeScreen === "welcome"
                ? "Welcome Portal"
                : activeScreen === "tech_escalation"
                  ? "Tech Escalation Builder"
                  : activeScreen === "customer_reply"
                    ? "Customer Reply Center"
                    : activeScreen === "quick_access"
                      ? "Quick Access & Favorites"
                      : activeScreen === "suggestions"
                        ? "Template Suggestions Hub"
                        : "System Admin Dashboard"}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm" style={{ color: "var(--header-muted)" }}>
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              apiStatus === "checking"
                ? "bg-[#f1c84b]"
                : apiStatus === "offline"
                  ? "bg-[#b83838]"
                  : "bg-[#4cd34c]"
            }`}
          />
          <span>
            {loading
              ? "Connecting..."
              : apiStatus === "offline"
                ? "Offline Mode"
                : "Backend Connected"}
          </span>

          {currentAgent ? (
            <div
              className="ml-3 flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
              style={{ borderColor: "var(--badge-border)", backgroundColor: "var(--badge-bg)" }}
            >
              <span>Signed in:</span>
              <strong className="text-[#4cd34c]">
                {currentAgent.agent_name} ({currentAgent.agent_initials})
              </strong>
            </div>
          ) : null}
        </div>
      </header>

      {/* GREY-ISH STATUS BAR (Hides on Welcome Screen) */}
      {statusMessage && apiStatus !== "offline" && activeScreen !== "welcome" ? (
        <div
          className="mb-4 rounded-2xl border px-4 py-2.5 text-sm backdrop-blur"
          style={{
            borderColor: "var(--status-border)",
            backgroundColor: "var(--status-bg)",
            color: "var(--app-text)",
          }}
        >
          {statusMessage}
        </div>
      ) : null}

      {error ? (
        <div
          className="mb-4 rounded-2xl border px-4 py-3 text-sm"
          style={{
            borderColor: "var(--error-border)",
            backgroundColor: "var(--error-bg)",
            color: "var(--error-text)",
          }}
        >
          {error}
        </div>
      ) : null}
    </>
  );
}
