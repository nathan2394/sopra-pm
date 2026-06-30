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
export const STATUSES = ["Backlog", "In Progress", "In Review", "Done"];
export const ROLES = [
  "Backend Dev",
  "QA",
  "Product Manager",
  "Data Engineer",
  "UI/UX",
];
export const SPRINT_STATUSES = ["Planned", "Active", "Completed"];
