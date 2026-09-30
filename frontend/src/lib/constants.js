export const PRIORITY_COLORS = {
  P1: { bg: "#FEE2E2", text: "#991B1B", dot: "#DC2626", label: "Critical" },
  P2: { bg: "#FEF3C7", text: "#92400E", dot: "#D97706", label: "High" },
  P3: { bg: "#DBEAFE", text: "#1E40AF", dot: "#2563EB", label: "Medium" },
  P4: { bg: "#E5E7EB", text: "#374151", dot: "#6B7280", label: "Low" },
};

export const SYSTEM_COLORS = {
  WMS: { bg: "#E0F2FE", text: "#0369A1" },
  Ecommerce: { bg: "#FEF08A", text: "#854D0E" },
  HRIS: { bg: "#D1FAE5", text: "#047857" },
  BIMA: { bg: "#FCE7F3", text: "#BE185D" },
  Nexora: { bg: "#E0E7FF", text: "#4338CA" },
  Internal: { bg: "#F3F4F6", text: "#374151" },
  Security: { bg: "#FEE2E2", text: "#B91C1C" },
};

export const STATUS_COLORS = {
  Backlog: { bg: "#F1F5F9", text: "#475569", dot: "#64748B" },
  "In Progress": { bg: "#DBEAFE", text: "#1E40AF", dot: "#0033CC" },
  Pending: { bg: "#FFEDD5", text: "#9A3412", dot: "#EA580C" },
  "In Review": { bg: "#EDE9FE", text: "#5B21B6", dot: "#7C3AED" },
  Done: { bg: "#D1FAE5", text: "#065F46", dot: "#059669" },
};

export const SYSTEMS = [
  "WMS",
  "Ecommerce",
  "HRIS",
  "BIMA",
  "Nexora",
  "Internal",
  "Security",
];

export const PRIORITIES = ["P1", "P2", "P3", "P4"];
export const STATUSES = ["Backlog", "In Progress", "Pending", "In Review", "Done"];
// Tasks (the pieces of work under a backlog item) are either done or not;
// the five statuses above belong to backlog items only.
export const TASK_STATUSES = ["Incomplete", "Complete"];
export const TASK_STATUS_COLORS = {
  Incomplete: { bg: "#DBEAFE", text: "#1E40AF", dot: "#0033CC" },
  Complete: { bg: "#D1FAE5", text: "#065F46", dot: "#059669" },
};
/**
 * Rows written before tasks had their own statuses may still say "Done",
 * "Completed" or any casing of those — the live table currently holds
 * "Completed" and "In Progress". Match the done-ish spellings loosely so a
 * finished task is never miscounted as outstanding.
 */
const DONE_SPELLINGS = new Set(["complete", "completed", "done", "closed", "selesai"]);
export const taskStatus = (s) =>
  DONE_SPELLINGS.has(String(s || "").trim().toLowerCase()) ? "Complete" : "Incomplete";
export const ROLES = [
  "Backend Dev",
  "QA",
  "Product Manager",
  "AI Engineer",
  "UI/UX",
];
export const SPRINT_STATUSES = ["Planned", "Active", "Completed"];
export const PROJECT_STATUSES = ["Active", "Paused", "Completed", "Archived"];
export const PROJECT_COLORS = [
  "#0033CC",
  "#4338CA",
  "#7C3AED",
  "#0369A1",
  "#047857",
  "#B91C1C",
  "#D97706",
  "#BE185D",
  "#854D0E",
  "#0F766E",
  "#374151",
];
