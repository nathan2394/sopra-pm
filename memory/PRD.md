# SOPRA PM — IT Project Management Console

## Original Problem Statement
> Build me apps for manage IT PM based on the excel document (SOPRA_Sprint_Tracker.xlsx). Frontend in React (CRA used — Vite swap deferred). Goals:
> 1. Help project manager manage the project schedule and deliverable to end user
> 2. Maintain effectiveness of IT Department team members
> 3. Dashboard to show management the quarterly and weekly sprint progress

## User Choices (Feb 2026)
- All MVP features (Backlog, Sprint Board, Team, Dashboard, Sprints, Roadmap)
- No auth for MVP
- Seed all data from Excel
- Mixed Indonesian + English UI
- No Excel export

## Architecture
- **Backend**: FastAPI + MongoDB (Motor), all endpoints under `/api`
- **Frontend**: React 19 + CRA + Tailwind + shadcn/ui + Phosphor Icons + Recharts + @hello-pangea/dnd
- **Design**: Swiss / High-Contrast archetype (Chivo headings, IBM Plex Sans body, IBM Plex Mono)

## Personas
- **IT Project Manager** (primary): tracks deliverables, balances team workload, runs sprints
- **Engineering Lead**: monitors per-engineer velocity, identifies bottlenecks (Okhy/Ignas rules)
- **Senior Management**: reviews quarterly & sprint progress via dashboard

## Core Data Model
- `team_members(id, name, role, areas[], rules, capacity_sp, avatar_color)`
- `sprints(id, sprint_number, name, quarter, start_date, end_date, goal, status, capacity_sp)`
- `backlog(id, wb_ref, title, system, priority, quarter, sprint_id, dev_assignee_id, qa_assignee_id, story_points, target_date, actual_date, percent_done, status, notes)`

## Implemented (2026-02 — v1.0)
- Backend CRUD for team/sprints/backlog with filters (priority, system, quarter, sprint, status)
- Dashboard endpoints: summary, quarterly, sprint-velocity, team-workload
- Auto-seed on startup: 13 members, 19 sprints, 36 backlog items
- Dashboard page: 6 KPI cards, quarterly bars, velocity line, priority distribution, system effort, team workload
- Backlog page: searchable/filterable table, create/edit dialog, row-menu status change
- Sprint Board: kanban with 4 columns, sprint switcher, drag-and-drop persisting via PATCH
- Sprints page: cards per sprint with progress, capacity vs load, CRUD
- Team page: grouped by role, avatars, rules, utilization bars, CRUD
- Roadmap page: quarter summary + timeline of sprints and items
- Status badges, priority badges, system badges with consistent design tokens

## Iteration 2 — Project Grouping (2026-02)
- Project entity (name, code, description, system, owner, color, status) with full CRUD
- `project_id` + `phase` fields on backlog items
- `/api/projects/{id}/summary` returns phase-level breakdown with completion %
- Projects page (/projects): grid with phases/items/SP per project
- Project Detail page (/projects/:id): header + phase progress strip + items grouped by phase with inline status changer
- Backlog grouped-by-project view (default) with collapsible projects, per-phase headers, and quick-add per phase
- Grouped/Flat toggle on backlog
- Project + phase fields in the item create/edit dialog
- "All projects" filter on backlog including "— No project —" bucket
- Sprint Board cards now show project chip ("SCE · P1" style)
- Seed includes 7 example projects: Sopra Cash Engine (3 phases), Sopra Commerce Revamp, HRIS SOPRA, WMS Modernization, BIMA Suite, TMS Delivery, Internal Platforms

## Iteration 3 — Comments & Activity Log (2026-02)
- `Activity` collection (kind: comment | change) with item_id, actor_id, text, field/from/to, created_at
- `/api/backlog/{id}/activity`, POST `/comments`, DELETE `/activity/{id}` (comments only)
- PATCH `/api/backlog/{id}?actor_id=...` auto-logs change rows for tracked fields (status, priority, dev/qa assignee, sprint, project, phase, SP, % done)
- Cascade delete: removing an item also removes its activity rows
- `UserPicker` in header — "Acting as" persists to localStorage; comment/change rows attribute to the chosen team member
- `ActivityPanel` in the item edit dialog with All/Comments/History filter pills, composer, timeline showing old→new change badges, comment delete

## Backlog (P0/P1/P2)
- P1 — Auth (JWT or Emergent Google) once team starts using in production
- P1 — Burndown chart per sprint (daily snapshot of remaining SP)
- P1 — Excel import/export (xlsx round-trip with the original tracker)
- P2 — Comments / activity log per backlog item
- P2 — Dependencies between items (blocks/depends-on)
- P2 — Email/Slack notifications when items move to In Review/Done
- P2 — Quarterly capacity planner (drag items between sprints)
- P3 — Public read-only management view (no edit) with shareable link
- P3 — Vite migration (currently CRA + craco for environment compatibility)

## Known Tradeoffs
- Drag-and-drop on Sprint Board verified via underlying PATCH API; @hello-pangea/dnd is not Playwright-testable but works in real browsers.
- Some team members show >100% utilization (Abhi 161%, Nathan 175%) — intentional red-flagging of overallocation based on Excel data.
