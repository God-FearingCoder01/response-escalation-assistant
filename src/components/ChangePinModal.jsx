import { useEffect, useState } from "react";

export default function ChangePinModal({ isOpen, onClose, onSubmit }) {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!isOpen) return;
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    setError("");
  }, [isOpen]);
  if (!isOpen) return null;

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (![currentPin, newPin, confirmPin].every((value) => /^\d{4}$/.test(value))) return setError("Enter all PINs as 4 numeric digits.");
    if (newPin === "0000") return setError("0000 is reserved for first-time setup.");
    if (newPin !== confirmPin) return setError("The new PIN entries do not match.");
    setSaving(true);
    try {
      await onSubmit(currentPin, newPin);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update your PIN.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-3xl border p-6 shadow-2xl" style={{ borderColor: "var(--panel-border-strong)", backgroundColor: "var(--panel-bg)" }}>
        <div>
          <h2 className="text-xl font-extrabold" style={{ color: "var(--app-text)" }}>Change your PIN</h2>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>Your new PIN must be four digits. 0000 is reserved for first-time setup.</p>
        </div>
        {[["Current PIN", currentPin, setCurrentPin], ["New PIN", newPin, setNewPin], ["Confirm new PIN", confirmPin, setConfirmPin]].map(([label, value, setter]) => (
          <label key={label} className="block space-y-1 text-sm font-semibold">
            <span>{label}</span>
            <input inputMode="numeric" type="password" autoComplete="new-password" maxLength={4} value={value} onChange={(e) => { setter(e.target.value.replace(/\D/g, "")); setError(""); }} className="w-full rounded-xl border px-3 py-2 text-center text-xl tracking-[0.5em]" style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }} />
          </label>
        ))}
        {error && <p role="alert" className="rounded-xl border px-3 py-2 text-center text-xs font-semibold" style={{ borderColor: "var(--error-border)", backgroundColor: "var(--error-bg)", color: "var(--error-text)" }}>{error}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="w-1/2 rounded-xl border py-2.5 text-sm font-semibold" style={{ borderColor: "var(--field-border)", color: "var(--neutral-text)" }}>Cancel</button>
          <button type="submit" disabled={saving} className="w-1/2 rounded-xl bg-[#4cd34c] py-2.5 text-sm font-bold text-black disabled:opacity-50">{saving ? "Saving..." : "Update PIN"}</button>
        </div>
      </form>
    </div>
  );
}
