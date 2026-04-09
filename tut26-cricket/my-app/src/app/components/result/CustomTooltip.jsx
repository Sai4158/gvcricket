"use client";

/**
 * File overview:
 * Purpose: Renders Result UI for the app's screens and flows.
 * Main exports: CustomTooltip.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

export default function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-zinc-800 text-white p-3 rounded-lg border border-zinc-700 shadow-lg">
      <p className="label font-bold mb-2">{label}</p>
      {payload.map((item, index) => (
        <p
          key={index}
          style={{ color: item.color || item.fill }}
        >{`${item.name}: ${item.value}`}</p>
      ))}
    </div>
  );
}


