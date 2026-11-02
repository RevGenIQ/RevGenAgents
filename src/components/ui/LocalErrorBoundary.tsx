"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface LocalErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface LocalErrorBoundaryState {
  hasError: boolean;
}

export class LocalErrorBoundary extends Component<
  LocalErrorBoundaryProps,
  LocalErrorBoundaryState
> {
  constructor(props: LocalErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): LocalErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      "LocalErrorBoundary intercepted error safely (isolated from page):",
      error,
      errorInfo
    );
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
