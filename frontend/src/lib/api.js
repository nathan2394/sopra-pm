import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const client = axios.create({
  baseURL: API,
  headers: { "Content-Type": "application/json" },
});

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
export const createBacklogItem = (data) =>
  client.post("/backlog", data).then((r) => r.data);
export const updateBacklogItem = (id, data, actorId) =>
  client
    .patch(`/backlog/${id}`, data, { params: actorId ? { actor_id: actorId } : {} })
    .then((r) => r.data);
export const deleteBacklogItem = (id) =>
  client.delete(`/backlog/${id}`).then((r) => r.data);

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
