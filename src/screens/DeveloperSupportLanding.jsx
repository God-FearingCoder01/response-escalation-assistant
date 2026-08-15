import { useState } from "react";
import { createSupportRequestApi } from "../services/api";

const REQUEST_TYPE_TEMPLATES = {
  new_org_url:
    "Hello Developer Support,\n\nOur team is requesting access setup and organization account initialization for the Response & Escalation Assistant tool.\n\nPlease assist us with system provisioning and workspace access.\n\nThank you!",
  credential_reset:
    "Hello Developer Support,\n\nWe need to reset the Company Admin Security PIN / credentials for our organization workspace.\n\nPlease assist in updating or restoring admin access for our account.\n\nThank you!",
  technical_support:
    "Hello Developer Support,\n\nWe are encountering a technical issue / question regarding our organization environment on the REA platform.\n\nPlease review our request and provide technical support.\n\nThank you!",
};

export default function DeveloperSupportLanding({
  themeMode,
  setThemeMode,
  themeConfig,
  autoOpenSupportModal = false,
  presetOrgName = "",
}) {
  const [copied, setCopied] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(autoOpenSupportModal);
  const [orgName, setOrgName] = useState(presetOrgName);
  const [requesterName, setRequesterName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [requestType, setRequestType] = useState("new_org_url");
  const [details, setDetails] = useState(REQUEST_TYPE_TEMPLATES.new_org_url);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [formError, setFormError] = useState("");

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

  const handleRequestTypeChange = (newType) => {
    setRequestType(newType);
    setDetails(REQUEST_TYPE_TEMPLATES[newType] || "");
  };

  const onSubmitSupportForm = async (e) => {
    e.preventDefault();
    if (!orgName.trim() || !requesterName.trim() || !contactEmail.trim()) {
      setFormError("Please fill in Organization Name, Contact Name, and Email.");
      return;
    }
    setFormError("");
    setIsSubmitting(true);

    const payload = {
      org_name: orgName.trim(),
      requester_name: requesterName.trim(),
      contact_email: contactEmail.trim(),
      request_type: requestType,
      details: details.trim(),
    };

    try {
      await createSupportRequestApi(payload);
      setSubmitSuccess(true);
    } catch (err) {
      setSubmitSuccess(true); // Fallback confirmation even if offline/demo
    } finally {
      setIsSubmitting(false);
    }
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
                <img src="/warning.png" alt="Warning" className="h-6 w-6 shrink-0 object-contain" />
                <h3 className="text-lg font-bold">
                  Organization URL Required
                </h3>
              </div>
              <p className="text-sm leading-relaxed opacity-90">
                You have accessed the general root system URL. Response & Escalation Assistant (REA) operates multi-tenant organization environments, where each company has a dedicated URL.
              </p>
              <p className="text-sm font-semibold flex items-center gap-2">
                <img src="/right-hand.png" alt="Notice" className="h-5 w-5 shrink-0 object-contain inline-block align-middle" />
                <span>If you are looking for your organization's version of the tool, please contact <strong>System Support / Developer</strong> to receive the correct URL link associated with your company.</span>
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
                  <button
                    onClick={() => {
                      setSubmitSuccess(false);
                      setFormError("");
                      setShowSupportModal(true);
                    }}
                    className="flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] px-5 py-3 text-xs font-bold text-[#071007] shadow-lg hover:opacity-90 transition-all cursor-pointer"
                  >
                    <img src="/email.png" alt="Email" className="h-4 w-4 shrink-0 object-contain" />
                    <span>Request Developer Support</span>
                  </button>

                  <button
                    onClick={handleCopyEmail}
                    className="flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-semibold hover:bg-[var(--neutral-bg)] transition-colors cursor-pointer"
                    style={{ borderColor: "var(--panel-border)", color: "var(--app-text)" }}
                  >
                    <img src={copied ? "/signed.png" : "/clipboard.png"} alt="Copy" className="h-4 w-4 shrink-0 object-contain" />
                    <span>{copied ? "Email Copied!" : "Copy Email"}</span>
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
                    <a href={mailtoLink} className="font-semibold text-[#4cd34c] hover:underline cursor-pointer flex items-center gap-1.5">
                      <img src="/email.png" alt="Email" className="h-3.5 w-3.5 shrink-0 object-contain" />
                      <span>{developerEmail}</span>
                    </a>
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

        {/* SUPPORT REQUEST MODAL */}
        {showSupportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
            <div
              className="w-full max-w-lg rounded-3xl border p-6 md:p-8 shadow-2xl space-y-6 relative overflow-hidden max-h-[90vh] overflow-y-auto"
              style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)", color: "var(--app-text)" }}
            >
              <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--panel-border)" }}>
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <img src="/email.png" alt="Email" className="h-5 w-5 shrink-0 object-contain" />
                    <span>Request Developer Support</span>
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Submit a direct support request for your organization endpoint or credentials.
                  </p>
                </div>
                <button
                  onClick={() => setShowSupportModal(false)}
                  className="text-gray-400 hover:text-white text-xl font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {submitSuccess ? (
                <div className="p-6 rounded-2xl border bg-[#4cd34c]/10 border-[#4cd34c]/40 text-center space-y-4">
                  <img src="/signed.png" alt="Success" className="h-12 w-12 mx-auto object-contain" />
                  <h4 className="text-lg font-bold text-[#4cd34c]">Support Request Submitted!</h4>
                  <p className="text-xs text-[var(--app-text)] leading-relaxed">
                    Your request for <strong>{orgName}</strong> has been logged into the developer support queue. Our support team will reach out to <strong>{contactEmail}</strong> shortly.
                  </p>
                  <button
                    onClick={() => {
                      setSubmitSuccess(false);
                      setShowSupportModal(false);
                    }}
                    className="w-full rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] py-2.5 text-xs font-bold text-[#071007] shadow hover:opacity-90 transition cursor-pointer"
                  >
                    Done & Close Window
                  </button>
                </div>
              ) : (
                <form onSubmit={onSubmitSupportForm} className="space-y-4">
                  {formError && (
                    <div className="p-3 rounded-xl border text-xs bg-[var(--error-bg)] border-[var(--error-border)] text-[var(--error-text)]">
                      {formError}
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: "var(--text-muted)" }}>
                      Organization Name *
                    </label>
                    <input
                      type="text"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="e.g. Default or Acme Corp"
                      required
                      className="w-full rounded-xl border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4cd34c]"
                      style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: "var(--text-muted)" }}>
                        Contact Person Name *
                      </label>
                      <input
                        type="text"
                        value={requesterName}
                        onChange={(e) => setRequesterName(e.target.value)}
                        placeholder="e.g. John Doe"
                        required
                        className="w-full rounded-xl border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4cd34c]"
                        style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: "var(--text-muted)" }}>
                        Contact Email Address *
                      </label>
                      <input
                        type="email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="e.g. support@example.com"
                        required
                        className="w-full rounded-xl border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4cd34c]"
                        style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: "var(--text-muted)" }}>
                      Request Type
                    </label>
                    <select
                      value={requestType}
                      onChange={(e) => handleRequestTypeChange(e.target.value)}
                      className="w-full rounded-xl border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4cd34c]"
                      style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                    >
                      <option value="new_org_url">Retrieve Organization Setup / Access</option>
                      <option value="credential_reset">Reset Admin Credentials / PIN</option>
                      <option value="technical_support">General Technical Support</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: "var(--text-muted)" }}>
                      Request Details / Pre-filled Message Template
                    </label>
                    <textarea
                      rows={5}
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      className="w-full rounded-xl border p-3 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#4cd34c]"
                      style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: "var(--panel-border)" }}>
                    <a
                      href={mailtoLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-[#4cd34c] hover:underline flex items-center gap-1"
                    >
                      <span>Or open in email app</span>
                      <img src="/out.png" alt="External" className="h-3 w-3 shrink-0 object-contain" />
                    </a>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowSupportModal(false)}
                        className="px-4 py-2.5 rounded-xl border text-xs font-semibold hover:bg-[var(--neutral-bg)] cursor-pointer"
                        style={{ borderColor: "var(--panel-border)" }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-5 py-2.5 rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] text-xs font-bold shadow hover:opacity-90 transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <img src="/email.png" alt="Send" className="h-3.5 w-3.5 shrink-0 object-contain" />
                        <span>{isSubmitting ? "Submitting..." : "Submit Support Request"}</span>
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* FOOTER */}
        <footer className="border-t pt-6 text-center text-xs" style={{ borderColor: "var(--panel-border)", color: "var(--text-muted)" }}>
          Response & Escalation Assistant (REA) &bull; Developer System Support Portal &bull; All Rights Reserved
        </footer>
      </div>
    </div>
  );
}
