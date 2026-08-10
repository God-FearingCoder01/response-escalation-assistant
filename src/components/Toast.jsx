export default function Toast({ toast }) {
  if (!toast?.show) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-bounce">
      <div
        className="flex items-center gap-3 rounded-2xl border px-5 py-3.5 shadow-2xl backdrop-blur-md"
        style={{
          borderColor: "var(--panel-border-strong)",
          backgroundColor: "var(--panel-bg)",
          color: "var(--app-text)",
        }}
      >
        <span className="flex h-3 w-3 rounded-full bg-[#4cd34c] animate-ping" />
        <span className="text-sm font-semibold">{toast.message}</span>
      </div>
    </div>
  );
}
