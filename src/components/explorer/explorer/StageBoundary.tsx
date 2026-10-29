"use client";

import { Component, type ReactNode } from "react";
import { useExplorer } from "../state/store";

/** If the 3D stage throws (driver bug, context failure), the explorer falls back to stills + plans. */
export class StageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("3D stage failed, falling back to stills", error);
    useExplorer.setState({ fallback: true });
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
