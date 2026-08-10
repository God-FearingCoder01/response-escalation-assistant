import { DEFAULT_AGENTS } from "../services/api";

export default function WelcomeScreen({
  activeScreen,
  currentAgent,
  agents,
  handleSelectAgent,
}) {
  if (currentAgent && activeScreen !== "welcome") return null;

  const agentList = Array.isArray(agents) && agents.length > 0 ? agents : DEFAULT_AGENTS;

  return (
    <section className="max-w-6xl mx-auto py-8">
      <div className="text-center mb-10 flex flex-col items-center justify-center">
        <img
          src="/REA.png"
          alt="REA Logo"
          className="h-16 w-16 mb-4 object-contain rounded-2xl shadow-xl border border-[#4cd34c]/30"
        />
        <span
          className="inline-block rounded-full border px-4 py-1 text-xs uppercase tracking-widest mb-3"
          style={{
            borderColor: "var(--badge-border)",
            backgroundColor: "var(--badge-bg)",
            color: "var(--badge-text)",
          }}
        >
          AGENT AUTHENTICATION
        </span>
        <h2 className="text-3xl font-extrabold md:text-4xl mb-3" style={{ color: "var(--app-text)" }}>
          Select Your Agent Profile
        </h2>
        <p className="max-w-xl mx-auto text-base" style={{ color: "var(--text-muted)" }}>
          Welcome to Response & Escalation Assistant. Please choose your agent profile below to enter the system.
        </p>
      </div>

      {/* BLOCK CARDS: THREE IN A ROW GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {agentList.map((agent) => (
          <div
            key={agent.id}
            onClick={() => handleSelectAgent(agent)}
            className="group cursor-pointer rounded-3xl border p-6 shadow-[var(--panel-shadow)] backdrop-blur transition-all duration-300 hover:-translate-y-1.5 hover:border-[#4cd34c] flex flex-col justify-between relative overflow-hidden"
            style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}
          >
            <div className="absolute top-0 right-0 h-24 w-24 bg-[radial-gradient(circle,rgba(76,211,76,0.15)_0%,transparent_70%)] pointer-events-none group-hover:scale-150 transition-transform" />

            <div>
              <div className="flex items-center justify-between mb-4">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#32324a_0%,#11111e_100%)] text-lg font-bold text-[#4cd34c] border shadow-md group-hover:scale-110 transition-transform"
                  style={{ borderColor: "var(--badge-border)" }}
                >
                  {agent.agent_initials}
                </div>
                {agent.is_admin ? (
                  <span className="rounded-full border px-2.5 py-0.5 text-[10px] uppercase font-bold tracking-wider text-[#f1c84b] border-[#f1c84b]/40 bg-[#f1c84b]/10 flex items-center gap-1">
                    System Admin
                    <img src="/lock.png" alt="Lock" className="h-3 w-3 shrink-0 object-contain" />
                  </span>
                ) : (
                  <span
                    className="rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-[var(--text-muted)]"
                    style={{ borderColor: "var(--badge-border)" }}
                  >
                    Support Agent
                  </span>
                )}
              </div>

              <h3 className="text-xl font-bold mb-6" style={{ color: "var(--app-text)" }}>
                {agent.agent_name}
              </h3>
            </div>

            <button
              type="button"
              className="w-full rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] py-2.5 text-center text-sm font-semibold text-[#071007] shadow-lg group-hover:shadow-[0_8px_25px_rgba(15,155,0,0.4)] transition-all"
            >
              {agent.is_admin ? "Authenticate PIN →" : "Sign In as Profile →"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
