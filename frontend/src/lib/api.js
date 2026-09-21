import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const TOKEN_KEY = "sopra_pm_token";
const USER_KEY = "sopra_pm_user";

export const getToken = () => localStorage.getItem(TOKEN_KEY) || "";
export const setToken = (t) => {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
};
export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

const client = axios.create({
  baseURL: API,
  headers: { "Content-Type": "application/json" },
});

client.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const isLoginCall = err?.config?.url?.includes("/auth/login");
    if (err?.response?.status === 401 && !isLoginCall) {
      clearSession();
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  },
);

// Auth
export const login = (email, password) =>
  client.post("/auth/login", { email, password }).then((r) => r.data);
export const fetchMe = () => client.get("/auth/me").then((r) => r.data);

// Team
export const fetchTeam = () => client.get("/team").then((r) => r.data);
export const createTeamMember = (data) =>
  client.post("/team", data).then((r) => r.data);
export const updateTeamMember = (id, data) =>
  client.patch(`/team/${id}`, data).then((r) => r.data);
export const deleteTeamMember = (id) =>
  client.delete(`/team/${id}`).then((r) => r.data);

// Sprints
export const fetchSprints = (params = {}) =>
  client.get("/sprints", { params }).then((r) => r.data);
export const createSprint = (data) =>
  client.post("/sprints", data).then((r) => r.data);
export const updateSprint = (id, data) =>
  client.patch(`/sprints/${id}`, data).then((r) => r.data);
export const deleteSprint = (id) =>
  client.delete(`/sprints/${id}`).then((r) => r.data);

// Activity / Comments
export const fetchActivity = (itemId) =>
  client.get(`/backlog/${itemId}/activity`).then((r) => r.data);
export const createComment = (itemId, data) =>
  client.post(`/backlog/${itemId}/comments`, data).then((r) => r.data);
export const deleteActivity = (activityId) =>
  client.delete(`/activity/${activityId}`).then((r) => r.data);

// Backlog
export const fetchBacklog = (params = {}) =>
  client.get("/backlog", { params }).then((r) => r.data);
export const fetchNextWbRef = (projectId) =>
  client
    .get("/backlog/next-ref", {
      params: projectId ? { project_id: projectId } : {},
    })
    .then((r) => r.data.wb_ref);
export const createBacklogItem = (data) =>
  client.post("/backlog", data).then((r) => r.data);
export const updateBacklogItem = (id, data, actorId) =>
  client
    .patch(`/backlog/${id}`, data, { params: actorId ? { actor_id: actorId } : {} })
    .then((r) => r.data);
export const deleteBacklogItem = (id) =>
  client.delete(`/backlog/${id}`).then((r) => r.data);

// Attachments (images + PDFs, several per backlog item)
export const attachmentUrl = (attachmentId) => `${API}/attachments/${attachmentId}`;
export const fetchAttachments = (itemId) =>
  client.get(`/backlog/${itemId}/attachments`).then((r) => r.data);
export const uploadAttachments = (itemId, files, actorId) => {
  const body = new FormData();
  Array.from(files).forEach((f) => body.append("files", f, f.name || "pasted.png"));
  return client
    .post(`/backlog/${itemId}/attachments`, body, {
      headers: { "Content-Type": "multipart/form-data" },
      params: actorId ? { actor_id: actorId } : {},
    })
    .then((r) => r.data);
};
// /api/attachments/{id} needs the bearer token, and <img src> cannot send one —
// so pull the bytes through the authenticated client and hand back an object URL.
// Callers must revoke it when they are done with it.
export const fetchAttachmentObjectUrl = (attachmentId) =>
  client
    .get(`/attachments/${attachmentId}`, { responseType: "blob" })
    .then((r) => URL.createObjectURL(r.data));
export const deleteAttachment = (attachmentId) =>
  client.delete(`/attachments/${attachmentId}`).then((r) => r.data);

// Projects
export const fetchProjects = () =>
  client.get("/projects").then((r) => r.data);
export const createProject = (data) =>
  client.post("/projects", data).then((r) => r.data);
export const updateProject = (id, data) =>
  client.patch(`/projects/${id}`, data).then((r) => r.data);
export const deleteProject = (id) =>
  client.delete(`/projects/${id}`).then((r) => r.data);
export const fetchProjectSummary = (id) =>
  client.get(`/projects/${id}/summary`).then((r) => r.data);

// Dashboard
export const fetchSummary = () =>
  client.get("/dashboard/summary").then((r) => r.data);
export const fetchQuarterly = () =>
  client.get("/dashboard/quarterly").then((r) => r.data);
export const fetchSprintVelocity = () =>
  client.get("/dashboard/sprint-velocity").then((r) => r.data);
export const fetchTeamWorkload = () =>
  client.get("/dashboard/team-workload").then((r) => r.data);

// Seed
export const seedData = (reset = false) =>
  client.post("/seed", null, { params: { reset } }).then((r) => r.data);

export default client;
