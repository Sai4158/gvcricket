"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { primeUiAudio } from "../../lib/page-audio";
import InlineSpinner from "./InlineSpinner";
import { useRouteFeedback } from "./RouteFeedbackProvider";

function isModifiedEvent(event) {
  return Boolean(
    event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.button !== 0
  );
}

export default function PendingLink({
  href,
  children,
  className = "",
  pendingClassName = "",
  pendingLabel = "Opening...",
  prefetch = false,
  replace = false,
  scroll,
  primeAudioOnClick = false,
  onClick,
  spinner = null,
  ...props
}) {
  const router = useRouter();
  const { startNavigation } = useRouteFeedback();
  const [pending, setPending] = useState(false);

  return (
    <Link
      href={href}
      prefetch={prefetch}
      aria-disabled={pending ? "true" : undefined}
      data-pending={pending ? "true" : "false"}
      className={`press-feedback ${className} ${pending ? pendingClassName : ""}`.trim()}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || isModifiedEvent(event) || pending) {
          return;
        }

        event.preventDefault();
        if (primeAudioOnClick) {
          void primeUiAudio().catch(() => {});
        }
        setPending(true);
        startNavigation(pendingLabel);

        if (replace) {
          router.replace(href, { scroll });
        } else {
          router.push(href, { scroll });
        }
      }}
      {...props}
    >
      {typeof children === "function"
        ? children({
            pending,
            pendingLabel,
            spinner:
              spinner || <InlineSpinner size="xs" label={pendingLabel} />,
          })
        : children}
    </Link>
  );
}
