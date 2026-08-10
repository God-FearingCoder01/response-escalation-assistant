export default function PinModal({
  showPinModal,
  setShowPinModal,
  setPendingAdminAgent,
  pinDigits,
  setPinDigits,
  pinError,
  setPinError,
  verifyPin,
}) {
  if (!showPinModal) return null;

  const handleVerifyPinSubmit = (e) => {
    e.preventDefault();
    verifyPin();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
      <div
        className="w-full max-w-md rounded-3xl border p-6 shadow-2xl transition-all"
        style={{ borderColor: "var(--panel-border-strong)", backgroundColor: "var(--panel-bg)" }}
      >
        <div className="text-center space-y-2 mb-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#32324a_0%,#11111e_100%)] border shadow-lg" style={{ borderColor: "var(--badge-border)" }}>
            <img src="/lock.png" alt="Security Lock" className="h-8 w-8 object-contain" />
          </div>
          <h3 className="text-xl font-extrabold" style={{ color: "var(--app-text)" }}>
            System Admin PIN Verification
          </h3>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Enter the 4-digit security PIN to access the System Admin profile.
          </p>
        </div>

        <form onSubmit={handleVerifyPinSubmit} className="space-y-5">
          <div className="flex justify-center gap-3">
            {[0, 1, 2, 3].map((idx) => (
              <input
                key={idx}
                id={`pin-box-${idx}`}
                type="password"
                maxLength={1}
                value={pinDigits[idx] || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^\d?$/.test(val)) {
                    const newDigits = [...pinDigits];
                    newDigits[idx] = val;
                    setPinDigits(newDigits);
                    if (val && idx < 3) {
                      const nextInput = document.getElementById(`pin-box-${idx + 1}`);
                      if (nextInput) nextInput.focus();
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !pinDigits[idx] && idx > 0) {
                    const prevInput = document.getElementById(`pin-box-${idx - 1}`);
                    if (prevInput) prevInput.focus();
                  }
                }}
                className="h-14 w-12 rounded-2xl border text-center text-xl font-bold transition focus:border-[#4cd34c] focus:outline-none focus:ring-2 focus:ring-[#4cd34c]/40"
                style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
              />
            ))}
          </div>

          {pinError ? (
            <div className="rounded-xl border px-3 py-2 text-center text-xs font-semibold" style={{ borderColor: "var(--error-border)", backgroundColor: "var(--error-bg)", color: "var(--error-text)" }}>
              {pinError}
            </div>
          ) : (
            <p className="text-[11px] text-center text-[var(--text-muted)] italic">
              Kindly contact system support for your default admin PIN.
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setShowPinModal(false);
                setPendingAdminAgent(null);
                setPinDigits(["", "", "", ""]);
                setPinError("");
              }}
              className="w-1/2 rounded-xl border py-2.5 text-sm font-semibold transition hover:opacity-90"
              style={{ borderColor: "var(--badge-border)", color: "var(--neutral-text)", backgroundColor: "var(--neutral-bg)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="w-1/2 rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] py-2.5 text-sm font-semibold text-[#071007] shadow-lg transition hover:opacity-90"
            >
              Verify & Access →
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
