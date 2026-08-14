import { useState } from "react";
import {
  verifySuperAdminPinApi,
  requestSuperAdminPinResetApi,
  resetSuperAdminPinApi,
  ADMIN_TOKEN_KEY,
  ADMIN_INITIALS_KEY,
} from "../services/api";

export default function SuperAdminPinModal({
  isOpen,
  onAuthenticated,
  onCancel,
  showToast = () => {},
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Forgot PIN state
  const [mode, setMode] = useState("pin"); // "pin", "forgot_email", "forgot_reset"
  const [resetEmail, setResetEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPin, setNewPin] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");

  if (!isOpen) return null;

  const handleKeyPress = (num) => {
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      setError("");
      if (nextPin.length === 4) {
        verifyPin(nextPin);
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError("");
  };

  const verifyPin = async (pinToTest) => {
    setLoading(true);
    setError("");
    try {
      const data = await verifySuperAdminPinApi(pinToTest);
      if (data && data.token) {
        localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
        localStorage.setItem(ADMIN_INITIALS_KEY, "SUPERADMIN");
        showToast("Super Admin Authenticated!");
        onAuthenticated(data.token, data.email);
        setPin("");
      }
    } catch (err) {
      setError(err.message || "Invalid 4-digit Super Admin PIN");
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReset = async (e) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      setError("Please enter your registered Super Admin email.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await requestSuperAdminPinResetApi(resetEmail.trim());
      if (res && res.reset_token) {
        setResetToken(res.reset_token);
        setMode("forgot_reset");
        setResetSuccess("Email verified! Please set your new 4-digit Super Admin PIN.");
      }
    } catch (err) {
      setError(err.message || "Provided email does not match registered Super Admin email.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async (e) => {
    e.preventDefault();
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setError("New PIN must be exactly 4 digits.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await resetSuperAdminPinApi(resetToken, newPin);
      showToast("Super Admin PIN reset successfully!");
      // Automatically verify and log in with new PIN
      await verifyPin(newPin);
    } catch (err) {
      setError(err.message || "Failed to reset Super Admin PIN.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToPin = () => {
    setMode("pin");
    setError("");
    setPin("");
    setResetEmail("");
    setNewPin("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-md rounded-3xl border p-6 md:p-8 shadow-2xl space-y-6 backdrop-blur text-center relative"
        style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}
      >
        {/* Header */}
        <div className="space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#4cd34c]/10 text-2xl border border-[#4cd34c]/30 text-[#4cd34c]">
            🛡️
          </div>
          <h2 className="text-2xl font-black" style={{ color: "var(--app-text)" }}>
            Super Admin Lock
          </h2>
          <p className="text-xs text-gray-400">
            {mode === "pin"
              ? "Enter your 4-digit Super Admin PIN to access the Organization Monitor (/monitor)."
              : mode === "forgot_email"
                ? "Enter your registered Super Admin personal email to authorize a PIN reset."
                : "Enter your new 4-digit Super Admin PIN."}
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-400 animate-shake">
            {error}
          </div>
        )}

        {resetSuccess && (
          <div className="rounded-xl border border-[#4cd34c]/40 bg-[#4cd34c]/10 p-3 text-xs text-[#4cd34c]">
            {resetSuccess}
          </div>
        )}

        {/* MODE 1: Standard 4-digit PIN Keypad */}
        {mode === "pin" && (
          <div className="space-y-6">
            {/* PIN Display Dots */}
            <div className="flex justify-center gap-3 my-4">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`h-4 w-4 rounded-full border transition-all duration-200 ${
                    pin.length > idx
                      ? "bg-[#4cd34c] border-[#4cd34c] shadow-[0_0_12px_#4cd34c]"
                      : "border-gray-600 bg-black/30"
                  }`}
                />
              ))}
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleKeyPress(String(num))}
                  className="flex h-12 items-center justify-center rounded-2xl border text-lg font-bold hover:bg-[#4cd34c]/20 hover:border-[#4cd34c] active:scale-95 transition-all cursor-pointer"
                  style={{ borderColor: "var(--panel-border)", color: "var(--app-text)", backgroundColor: "var(--neutral-bg)" }}
                >
                  {num}
                </button>
              ))}

              <button
                type="button"
                onClick={handleBackToPin}
                className="flex h-12 items-center justify-center rounded-2xl text-xs font-semibold text-gray-500 cursor-default"
              >
                C
              </button>

              <button
                type="button"
                onClick={() => handleKeyPress("0")}
                className="flex h-12 items-center justify-center rounded-2xl border text-lg font-bold hover:bg-[#4cd34c]/20 hover:border-[#4cd34c] active:scale-95 transition-all cursor-pointer"
                style={{ borderColor: "var(--panel-border)", color: "var(--app-text)", backgroundColor: "var(--neutral-bg)" }}
              >
                0
              </button>

              <button
                type="button"
                onClick={handleDelete}
                className="flex h-12 items-center justify-center rounded-2xl border text-sm font-bold text-red-400 hover:bg-red-500/20 active:scale-95 transition-all cursor-pointer"
                style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--neutral-bg)" }}
              >
                ⌫
              </button>
            </div>

            <div className="flex flex-col items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setMode("forgot_email");
                  setError("");
                }}
                className="text-xs font-semibold text-[#4cd34c] hover:underline cursor-pointer"
              >
                Forgot Super Admin PIN?
              </button>

              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="text-xs text-gray-400 hover:text-white cursor-pointer"
                >
                  Return to Main App
                </button>
              )}
            </div>
          </div>
        )}

        {/* MODE 2: Forgot PIN - Email Request */}
        {mode === "forgot_email" && (
          <form onSubmit={handleRequestReset} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "var(--header-muted)" }}>
                Registered Super Admin Personal Email *
              </label>
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="e.g. gfc.dev@proton.me"
                required
                className="w-full rounded-2xl border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4cd34c]"
                style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--neutral-bg)", color: "var(--app-text)" }}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleBackToPin}
                className="rounded-xl border px-4 py-2.5 text-xs font-semibold hover:bg-[var(--neutral-bg)] cursor-pointer"
                style={{ borderColor: "var(--panel-border)", color: "var(--app-text)" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] px-5 py-2.5 text-xs font-bold text-[#071007] hover:opacity-90 cursor-pointer shadow-md disabled:opacity-50"
              >
                {loading ? "Verifying Email..." : "Authorize PIN Reset"}
              </button>
            </div>
          </form>
        )}

        {/* MODE 3: Forgot PIN - Enter New 4-digit PIN */}
        {mode === "forgot_reset" && (
          <form onSubmit={handleConfirmReset} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "var(--header-muted)" }}>
                New 4-Digit Super Admin PIN *
              </label>
              <input
                type="password"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="e.g. 1234"
                required
                className="w-full rounded-2xl border p-3 text-sm font-mono text-center tracking-widest text-xl focus:outline-none focus:ring-2 focus:ring-[#4cd34c]"
                style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--neutral-bg)", color: "var(--app-text)" }}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleBackToPin}
                className="rounded-xl border px-4 py-2.5 text-xs font-semibold hover:bg-[var(--neutral-bg)] cursor-pointer"
                style={{ borderColor: "var(--panel-border)", color: "var(--app-text)" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || newPin.length !== 4}
                className="rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] px-5 py-2.5 text-xs font-bold text-[#071007] hover:opacity-90 cursor-pointer shadow-md disabled:opacity-50"
              >
                {loading ? "Updating PIN..." : "Save & Unlock"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
