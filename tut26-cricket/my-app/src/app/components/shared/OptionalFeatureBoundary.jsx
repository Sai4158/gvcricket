"use client";

import { Component } from "react";

function DefaultFallback({ label = "Feature unavailable." }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-zinc-400">
      {label}
    </div>
  );
}

export default class OptionalFeatureBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Optional feature crashed:", error, info);
  }

  render() {
    if (this.state.hasError) {
      const fallback = this.props.fallback;
      if (fallback) {
        return fallback;
      }

      return <DefaultFallback label={this.props.label} />;
    }

    return this.props.children;
  }
}
