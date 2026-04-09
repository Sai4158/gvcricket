"use client";

/**
 * File overview:
 * Purpose: Renders Shared UI for the app's screens and flows.
 * Main exports: LoadingButton.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */


import { motion } from "framer-motion";
import InlineSpinner from "./InlineSpinner";

export default function LoadingButton({
  children,
  pendingLabel = "Loading...",
  loading = false,
  disabled = false,
  className = "",
  spinnerClassName = "",
  type = "button",
  onClick,
  leadingIcon = null,
  trailingIcon = null,
  loadingIcon = null,
  loadingIconPosition = "leading",
  ...props
}) {
  const isDisabled = disabled || loading;
  const spinner =
    loadingIcon || (
      <InlineSpinner
        size="sm"
        label={pendingLabel}
        className={spinnerClassName}
      />
    );

  return (
    <motion.button
      whileTap={isDisabled ? undefined : { scale: 0.985, y: 1 }}
      type={type}
      disabled={isDisabled}
      data-pending={loading ? "true" : "false"}
      onClick={onClick}
      className={`press-feedback ${className}`}
      {...props}
    >
      {loading && loadingIconPosition === "leading" ? spinner : null}
      {!loading && leadingIcon ? leadingIcon : null}
      {loading ? <span>{pendingLabel}</span> : children}
      {loading && loadingIconPosition === "trailing" ? spinner : null}
      {!loading && trailingIcon ? trailingIcon : null}
    </motion.button>
  );
}


