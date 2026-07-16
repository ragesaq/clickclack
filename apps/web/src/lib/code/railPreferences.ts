// Code-workspace rail preferences: per-user, device-local UI state for the
// code room's right rail. Currently one pref: whether the rail is collapsed to
// its narrow icon strip so the text canvas owns the full width.
//
// Persistence mirrors lib/appearance.ts (localStorage, best-effort, never
// throws). The key is namespaced by user id so two accounts sharing one browser
// keep independent rail state, satisfying the "persist per-user preference"
// requirement without a server round-trip.

const RAIL_COLLAPSED_KEY_PREFIX = "clickclack:code-rail-collapsed:v1";

function railCollapsedKey(userID: string | null | undefined): string {
  const scope = userID && userID.trim() ? userID.trim() : "anon";
  return `${RAIL_COLLAPSED_KEY_PREFIX}:${scope}`;
}

export function loadRailCollapsed(userID: string | null | undefined): boolean {
  try {
    return window.localStorage.getItem(railCollapsedKey(userID)) === "1";
  } catch {
    return false;
  }
}

export function saveRailCollapsed(userID: string | null | undefined, collapsed: boolean): void {
  try {
    if (collapsed) window.localStorage.setItem(railCollapsedKey(userID), "1");
    else window.localStorage.removeItem(railCollapsedKey(userID));
  } catch {
    // Best-effort: a blocked or full localStorage must not break the layout.
  }
}
