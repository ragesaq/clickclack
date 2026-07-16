// Device-local code workspace preferences are scoped by user so two accounts
// sharing one browser do not overwrite each other's rail state.

const RAIL_COLLAPSED_KEY_PREFIX = "clickclack:code-rail-collapsed:v1";

function railCollapsedKey(userID: string | null | undefined): string {
  const scope = userID?.trim() || "anon";
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
    const key = railCollapsedKey(userID);
    if (collapsed) window.localStorage.setItem(key, "1");
    else window.localStorage.removeItem(key);
  } catch {
    // A blocked or full localStorage must not break the code-room layout.
  }
}
