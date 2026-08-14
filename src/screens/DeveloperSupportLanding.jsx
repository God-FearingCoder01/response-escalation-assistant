import { useState } from "react";

export default function DeveloperSupportLanding({
  themeMode,
  setThemeMode,
  themeConfig,
}) {
  const [copied, setCopied] = useState(false);
  const developerEmail = "gfc.dev@proton.me";
  const emailSubject = encodeURIComponent("[REA Support] Organization URL & Access Request");
  const emailBody = encodeURIComponent(
    `Hello Developer Support,

I am requesting assistance regarding our organization on the Response & Escalation Assistant (REA) tool.

• Organization Name: [Enter your Organization Name here]
• Contact Person / Role: [Enter your Name & Role]
• Request Details: [e.g., Need new organization URL endpoint, credential reset, or technical assistance]

Thank you!`
  );
  const mailtoLink = `mailto:${developerEmail}?subject=${emailSubject}&body=${emailBody}`;

  const handleCopyEmail = () => {
    navigator.clipboard?.writeText(developerEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      className="min-h-screen transition-colors duration-300 font-sans relative w-full"
      style={{
        backgroundImage: themeConfig?.overlay || "",
        backgroundColor: "var(--app-bg)",
        color: "var(--app-text)",
      }}
    >
      <div className="min-h-screen flex flex-col justify-between p-6 md:p-12 animate-fade-in max-w-5xl mx-auto">
        {/* HEADER */}
        <header className="flex items-center justify-between border-b pb-6" style={{ borderColor: "var(--panel-border)" }}>
          <div className="flex items-center gap-4">
            <img
              src="/REA.png"
              alt="REA Logo"
              className="h-12 w-12 shrink-0 object-contain rounded-2xl shadow-lg border border-[#4cd34c]/30"
            />
            <div>
              <div className="text-xs uppercase tracking-[0.25em] font-bold text-[#4cd34c]">
                Response & Escalation Assistant
              </div>
              <h1 className="text-xl font-black md:text-2xl" style={{ color: "var(--app-text)" }}>
                Developer & Support Portal
              </h1>
            </div>
          </div>

          {setThemeMode && (
            <button
              onClick={() => setThemeMode((c) => (c === "night" ? "day" : "night"))}
              className="flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-medium transition hover:bg-[var(--neutral-bg)] cursor-pointer"
              style={{ borderColor: "var(--badge-border)", color: "var(--app-text)" }}
              title={`Switch to ${themeMode === "night" ? "Day" : "Night"} mode`}
            >
              <img
                src={themeMode === "night" ? "/moon.png" : "/sun.png"}
                alt={themeMode === "night" ? "Night Mode" : "Day Mode"}
                className="h-4 w-4 shrink-0 object-contain"
              />
              <span>{themeMode === "night" ? "Night Mode" : "Day Mode"}</span>
            </button>
          )}
        </header>

        {/* MAIN NOTICE & HERO */}
        <main className="my-12 space-y-8">
          <div
            className="rounded-3xl border p-8 md:p-12 shadow-2xl relative overflow-hidden backdrop-blur"
            style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}
          >
            <div className="absolute -top-10 -right-10 w-72 h-72 rounded-full bg-[#4cd34c]/10 pointer-events-none blur-3xl" />

            {/* Warning / Notice Box */}
            <div
              className="rounded-2xl border p-6 backdrop-blur space-y-3 mb-8"
              style={{
                borderColor: "var(--error-border)",
                backgroundColor: "var(--error-bg)",
                color: "var(--error-text)",
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <h3 className="text-lg font-bold">
                  Organization URL Required
                </h3>
              </div>
              <p className="text-sm leading-relaxed opacity-90">
                You have accessed the general root system URL. Response & Escalation Assistant (REA) operates multi-tenant organization environments, where each company has a dedicated URL.
              </p>
              <p className="text-sm font-semibold">
                👉 If you are looking for your organization's version of the tool, please contact <strong>System Support / Developer</strong> to receive the correct URL link associated with your company.
              </p>
            </div>

            {/* DEVELOPER CONTACT CARD */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center pt-4">
              <div className="space-y-4">
                <h2 className="text-2xl font-extrabold" style={{ color: "var(--app-text)" }}>
                  Need Access or Support?
                </h2>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  Contact the system administrator or lead developer to configure your company workspace, retrieve lost URL endpoints, or manage organization credentials.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <a
                    href={mailtoLink}
                    className="flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] px-5 py-3 text-xs font-bold text-[#071007] shadow-lg hover:opacity-90 transition-all cursor-pointer"
                  >
                    <span>✉️ Email Developer Support</span>
                  </a>

                  <button
                    onClick={handleCopyEmail}
                    className="flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-semibold hover:bg-[var(--neutral-bg)] transition-colors cursor-pointer"
                    style={{ borderColor: "var(--panel-border)", color: "var(--app-text)" }}
                  >
                    <span>{copied ? "✓ Email Copied!" : "📋 Copy Email"}</span>
                  </button>
                </div>
              </div>

              <div
                className="rounded-2xl border p-6 space-y-4 backdrop-blur"
                style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--neutral-bg)" }}
              >
                <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Developer Contact Information
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between border-b pb-2" style={{ borderColor: "var(--panel-border)" }}>
                    <span style={{ color: "var(--text-muted)" }}>Support Desk:</span>
                    <a href={mailtoLink} className="font-semibold text-[#4cd34c] hover:underline cursor-pointer">{developerEmail}</a>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "var(--text-muted)" }}>System Architecture:</span>
                    <span className="font-semibold" style={{ color: "var(--app-text)" }}>Multi-Tenant REA Assistant</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* FOOTER */}
        <footer className="border-t pt-6 text-center text-xs" style={{ borderColor: "var(--panel-border)", color: "var(--text-muted)" }}>
          Response & Escalation Assistant (REA) &bull; Developer System Support Portal &bull; All Rights Reserved
        </footer>
      </div>
    </div>
  );
}
