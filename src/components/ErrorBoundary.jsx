import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught UI Exception caught by ErrorBoundary:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetError = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--app-bg,#0d1117)] text-[var(--app-text,#e6edf3)] font-sans">
          <div className="max-w-md w-full rounded-2xl border p-6 shadow-2xl backdrop-blur bg-[var(--panel-bg,#161b22)] border-[var(--panel-border,#30363d)] space-y-4 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 text-2xl border border-amber-500/30">
              ⚡
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#4cd34c]">
                Screen Refresh Needed
              </h3>
              <p className="text-xs text-[var(--text-muted,#8b949e)] leading-relaxed">
                A temporary UI component state issue was intercepted safely. Click below to recover without lost data.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 rounded-xl bg-[var(--field-bg,#0d1117)] border border-[var(--field-border,#30363d)] text-left font-mono text-[11px] text-red-400 overflow-x-auto max-h-24">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleResetError}
                className="flex-1 py-2 px-3 rounded-xl border text-xs font-semibold hover:opacity-90 transition"
                style={{ borderColor: "var(--field-border,#30363d)", backgroundColor: "var(--field-bg,#21262d)" }}
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-2 px-3 rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-black font-extrabold text-xs shadow-md hover:opacity-90 transition"
              >
                Reload App 🔄
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
