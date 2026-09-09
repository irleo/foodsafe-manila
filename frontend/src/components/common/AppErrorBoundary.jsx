import { Component } from "react";
import ErrorState from "./ErrorState";

function clientErrorId() {
  const suffix = globalThis.crypto?.randomUUID?.().replaceAll("-", "").slice(0, 8)
    || Math.random().toString(16).slice(2, 10);
  return `CLIENT-${suffix.toUpperCase()}`;
}

export default class AppErrorBoundary extends Component {
  state = { failed: false, reference: null };

  static getDerivedStateFromError() {
    return { failed: true, reference: clientErrorId() };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      console.error("Unexpected React render error", error, info);
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-lg">
          <ErrorState
            title="FoodSafe could not display this page"
            message="Reload the application to recover. If the problem continues, provide the reference below to the administrator."
            reference={this.state.reference}
            onRetry={() => window.location.reload()}
            retryLabel="Reload application"
          />
        </div>
      </main>
    );
  }
}
