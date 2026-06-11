import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Global keyboard shortcuts:
 *   G + H  → Dashboard (Home)
 *   G + C  → Cases
 *   G + T  → Templates
 *   G + S  → Settings
 *   G + A  → Analytics
 *   N      → New Onboarding (quick)
 *   ?      → Toggle shortcuts overlay
 *   Escape → Close overlay
 */

export const SHORTCUTS = [
  { keys: ["G", "H"], label: "Dashboard",        path: "/" },
  { keys: ["G", "C"], label: "Vorgänge",          path: "/cases" },
  { keys: ["G", "T"], label: "Templates",         path: "/templates" },
  { keys: ["G", "S"], label: "Einstellungen",     path: "/settings" },
  { keys: ["G", "A"], label: "Analytics",         path: "/analytics" },
  { keys: ["N"],      label: "Neues Onboarding",  path: "/new-onboarding" },
  { keys: ["?"],      label: "Shortcuts anzeigen", action: "toggle" },
];

export function useKeyboardShortcuts({ onToggleHelp }) {
  const navigate = useNavigate();
  const buffer = { key: null, ts: 0 };

  const handleKey = useCallback((e) => {
    // Don't trigger inside inputs/textareas
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    const key = e.key.toUpperCase();
    const now = Date.now();

    if (key === "ESCAPE") { onToggleHelp(false); return; }
    if (key === "?") { onToggleHelp(prev => !prev); return; }

    // Two-key chord: G + X
    if (buffer.key === "G" && now - buffer.ts < 800) {
      const chord = SHORTCUTS.find(s => s.keys.length === 2 && s.keys[1] === key);
      if (chord?.path) { navigate(chord.path); }
      buffer.key = null;
      return;
    }

    if (key === "G") {
      buffer.key = "G";
      buffer.ts = now;
      return;
    }

    // Single-key shortcut
    const single = SHORTCUTS.find(s => s.keys.length === 1 && s.keys[0] === key);
    if (single?.path) navigate(single.path);
  }, [navigate, onToggleHelp]);

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);
}
