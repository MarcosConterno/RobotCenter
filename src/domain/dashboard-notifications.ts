export const DASHBOARD_UNREAD_STORAGE_KEY = "robot-center:dashboard-unread-updates";
export const DASHBOARD_UNREAD_EVENT = "robot-center:dashboard-unread-change";

export function readDashboardUnreadCount() {
  const count = Number.parseInt(window.sessionStorage.getItem(DASHBOARD_UNREAD_STORAGE_KEY) ?? "0", 10);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

export function announceDashboardUnreadCount(count: number) {
  window.dispatchEvent(new CustomEvent<number>(DASHBOARD_UNREAD_EVENT, { detail: count }));
}
