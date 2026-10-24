import { useState } from "react";

export default function PinSetupModal({ isOpen, agent, onSubmit, error, setError }) {
  const [pin, setPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  if (!isOpen) return null;

  const submit = async (event) => {
    event.preventDefault();
    if (!/^\d{4}$/.test(pin)) return setError("Enter a new 4-digit PIN.");
    if (pin === "0000") return setError("Choose a new PIN. 0000 is only for first-time setup.");
    if (pin !== confirmation) return setError("The PIN entries do not match.");
    await onSubmit(pin);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-3xl border p-6 shadow-2xl" style={{ borderColor: "var(--panel-border-strong)", backgroundColor: "var(--panel-bg)" }}>
        <div className="text-center space-y-2">
          <img src="/lock.png" alt="" className="mx-auto h-10 w-10 object-contain" />
          <h2 className="text-xl font-extrabold" style={{ color: "var(--app-text)" }}>Set your personal PIN</h2>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{agent?.agent_name || "Your profile"} is using the temporary setup PIN. Create a new 4-digit PIN to continue.</p>
        </div>
        <label className="block space-y-1 text-sm font-semibold">
          <span>New PIN</span>
          <input autoFocus inputMode="numeric" autoComplete="new-password" type="password" maxLength={4} value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setError(""); }} className="w-full rounded-xl border px-3 py-2 text-center text-xl tracking-[0.5em]" style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }} />
        </label>
        <label className="block space-y-1 text-sm font-semibold">
          <span>Confirm PIN</span>
          <input inputMode="numeric" autoComplete="new-password" type="password" maxLength={4} value={confirmation} onChange={(e) => { setConfirmation(e.target.value.replace(/\D/g, "")); setError(""); }} className="w-full rounded-xl border px-3 py-2 text-center text-xl tracking-[0.5em]" style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }} />
        </label>
        {error && <p role="alert" className="rounded-xl border px-3 py-2 text-center text-xs font-semibold" style={{ borderColor: "var(--error-border)", backgroundColor: "var(--error-bg)", color: "var(--error-text)" }}>{error}</p>}
        <button type="submit" className="w-full rounded-xl bg-[#4cd34c] py-2.5 text-sm font-bold text-black hover:opacity-90">Save PIN and continue</button>
      </form>
    </div>
  );
}
