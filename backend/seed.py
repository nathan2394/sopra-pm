"""Seed initial SOPRA PM data into SQL Server.

Idempotent: skips insert when table has rows unless --reset is passed.
Usage:
    python /app/backend/seed.py           # seed only if empty
    python /app/backend/seed.py --reset   # wipe and reseed
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pymssql
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

RESET = "--reset" in sys.argv


def conn():
    return pymssql.connect(
        server=os.environ["MSSQL_HOST"],
        port=int(os.environ["MSSQL_PORT"]),
        user=os.environ["MSSQL_USER"],
        password=os.environ["MSSQL_PASSWORD"],
        database=os.environ["MSSQL_DB"],
        as_dict=True,
        autocommit=False,
        charset="UTF-8",
        login_timeout=15,
    )


TEAM = [
    ("Nathan", "Product Manager", None, "Nexora,Internal", "SAP Integration & Nexora Cash Engine ONLY", 20, "#0033CC"),
    ("Nando", "Product Manager", None, "Internal", "Sopra CAM (shared with Nathan)", 18, "#7C3AED"),
    ("Andre", "Backend Dev", None, "WMS,BIMA,Internal", "WMS majority, EIL Audit, BIMA", 26, "#0369A1"),
    ("Abhi", "Backend Dev", None, "Ecommerce,HRIS", "Ecommerce general, HRIS, picks up Okhy overflow", 30, "#047857"),
    ("Nadir", "Backend Dev", None, "Ecommerce,WMS,BIMA,Nexora,Security", "TMS primary, WMS support, BIMA, Nexora", 26, "#B91C1C"),
    ("Okhy", "Backend Dev", None, "Ecommerce", "ONLY Revamp Ecommerce (Catalog & frontend)", 18, "#D97706"),
    ("Ignas", "Backend Dev", None, "WMS,Ecommerce,HRIS", "ONLY Handheld devices (RFID, QR Scanner, Fingerspot)", 16, "#BE185D"),
    ("Finta", "QA", None, "All", "QA across all projects", 24, "#4338CA"),
    ("Michael", "QA", None, "All", "QA across all projects", 24, "#854D0E"),
    ("Nadia", "Data Engineer", None, "Internal", "Data pipelines & analytics", 18, "#0F766E"),
    ("Fitri", "Data Engineer", None, "Internal", "Data pipelines & analytics", 18, "#9333EA"),
    ("Finley", "Data Engineer", None, "Internal", "Data pipelines & analytics", 18, "#0891B2"),
    ("Mukaram", "UI/UX", None, "All", "Design for all systems", 20, "#DC2626"),
]

PROJECTS = [
    ("Sopra Cash Engine", "SCE", "Nexora",
     "Phase 1: Migrasi forecast dari Excel. Phase 2: Realisasi bank dari mutasi bank. Phase 3: Integrasi realisasi ke SAP (konsolidasi).",
     "Nathan", "#4338CA", "Active"),
    ("Sopra Commerce Revamp", "SCR", "Ecommerce",
     "Revamp ecommerce — Catalog & frontend modernization, payment flows, vendor portal.",
     "Okhy", "#854D0E", "Active"),
    ("HRIS SOPRA", "HRS", "HRIS",
     "End-to-end HR Information System: core, employee dashboard, attendance device integrations.",
     "Abhi", "#047857", "Active"),
    ("WMS Modernization", "WMS", "WMS",
     "Warehouse Management — rework, sister-company multi-entity, stok health RFID, DI champions.",
     "Andre", "#0369A1", "Active"),
    ("BIMA Suite", "BIM", "BIMA",
     "Sales activation: PPC+NPD, interactive sales, dealer reminders, sales-purch collaboration.",
     "Nadir", "#BE185D", "Active"),
    ("TMS Delivery", "TMS", "Ecommerce",
     "Transport Management — Proof of Delivery, shipping value added, logistics queue.",
     "Nadir", "#B91C1C", "Active"),
    ("Internal Platforms", "INT", "Internal",
     "Internal tooling: KPI dashboard, audit, e-sign, search engine, podcast.",
     "Finta", "#374151", "Active"),
]

SPRINTS = [
    (1,  "Sprint 1",  "Q3 2026", "2026-07-07", "2026-07-20", "KPI Dashboard, HRIS SOPRA, Rework WMS, Ekspedisi Queue", "Active",  30),
    (2,  "Sprint 2",  "Q3 2026", "2026-07-21", "2026-08-03", "Payment Gateway BCA, Nexora Transfer Token, TOTP 2FA", "Planned", 28),
    (3,  "Sprint 3",  "Q3 2026", "2026-08-04", "2026-08-17", "RFD Ecommerce, BIMA Interaktif, Trasmi Dashboard", "Planned", 28),
    (4,  "Sprint 4",  "Q3 2026", "2026-08-18", "2026-08-31", "BIMA PPC+NPD, HRIS Employee Dashboard, EIL Audit, TMS POD", "Planned", 28),
    (5,  "Sprint 5",  "Q3 2026", "2026-09-01", "2026-09-14", "Dashboard Ecom + Support, Stok Health RFID", "Planned", 24),
    (6,  "Sprint 6",  "Q3 2026", "2026-09-15", "2026-09-28", "Q3 Buffer / Hardening", "Planned", 18),
    (7,  "Sprint 7",  "Q4 2026", "2026-10-06", "2026-10-19", "Nexora SAP, Nexora Integration, WMS Sister Company", "Planned", 26),
    (8,  "Sprint 8",  "Q4 2026", "2026-10-20", "2026-11-02", "Revamp Catalog, PO-DPR Nagora SAP, Nexora Approval Credit", "Planned", 26),
    (9,  "Sprint 9",  "Q4 2026", "2026-11-03", "2026-11-16", "Nexora ONE Approval HET", "Planned", 18),
    (10, "Sprint 10", "Q4 2026", "2026-11-17", "2026-11-30", "Q4 Buffer", "Planned", 16),
    (11, "Sprint 11", "Q4 2026", "2026-12-01", "2026-12-14", "Q4 Stabilization", "Planned", 16),
    (12, "Sprint 12", "Q4 2026", "2026-12-15", "2026-12-28", "Year-end Release Candidate", "Planned", 12),
    (13, "Sprint 13", "Q1 2027", "2027-01-05", "2027-01-18", "DI Champions WMS, Portal External Vendor, Esign E-Materai", "Planned", 24),
    (14, "Sprint 14", "Q1 2027", "2027-01-19", "2027-02-01", "BIMA Colab Sales & Purch, Absen Registrasi Fingerspot", "Planned", 22),
    (15, "Sprint 15", "Q1 2027", "2027-02-02", "2027-02-15", "Nexora Commerce, Nexora Assurance", "Planned", 22),
    (16, "Sprint 16", "Q1 2027", "2027-02-16", "2027-03-01", "Search Engine Rufi's, BIMA Dealer Active Reminder", "Planned", 20),
    (17, "Sprint 17", "Q1 2027", "2027-03-02", "2027-03-15", "VAS Value Added Shipping, LIO Listen Identity", "Planned", 20),
    (18, "Sprint 18", "Q1 2027", "2027-03-16", "2027-03-29", "Q1 Buffer", "Planned", 14),
    (19, "Sprint 19", "Q2 2027", "2027-04-06", "2027-04-19", "Podcast System", "Planned", 10),
]

# (wb_ref, title, system, priority, quarter, sprint_num, dev, qa, sp, notes, project_code, phase)
BACKLOG = [
    ("WB-01", "KPI Dashboard", "Internal", "P1", "Q3 2026", 1, "Finta", None, 8, "Owner Finta (delivery dashboard)", "INT", "Phase 1"),
    ("WB-02", "HRIS SOPRA", "HRIS", "P1", "Q3 2026", 1, "Abhi", "Finta", 8, "Core HRIS for SOPRA", "HRS", "Phase 1"),
    ("WB-04", "Rework WMS", "WMS", "P1", "Q3 2026", 1, "Andre", "Michael", 8, "WMS rework primary", "WMS", "Phase 1"),
    ("WB-05", "Ekspedisi Queue", "Ecommerce", "P1", "Q3 2026", 1, "Abhi", "Finta", 6, "Okhy -> hanya Revamp; re-assign ke Abhi", "TMS", "Phase 1"),
    ("WB-11", "Payment Gateway BCA", "Ecommerce", "P1", "Q3 2026", 2, "Abhi", "Michael", 8, "BCA PG integration", "SCR", "Phase 1"),
    ("WB-20", "Nexora Approval - Transfer Token", "Nexora", "P1", "Q3 2026", 2, "Nathan", "Finta", 8, "Cash Engine -> Nathan", "SCE", "Phase 1"),
    ("WB-23", "TOTP (2FA)", "Security", "P1", "Q3 2026", 2, "Nadir", "Michael", 6, "Two-factor auth", None, None),
    ("WB-06", "Trasmi Dashboard", "Internal", "P2", "Q3 2026", 3, None, None, 6, "Pending assignment", "INT", "Phase 2"),
    ("WB-12", "RFD Ecommerce", "Ecommerce", "P2", "Q3 2026", 3, "Abhi", "Finta", 6, "Okhy -> hanya Revamp; re-assign ke Abhi", "SCR", "Phase 1"),
    ("WB-13", "Dashboard & Notif Ecom (Mobile)", "Ecommerce", "P2", "Q3 2026", 3, "Abhi", "Michael", 6, "Mobile ecom UX", "SCR", "Phase 1"),
    ("WB-16", "BIMA Interaktif (Sales)", "BIMA", "P2", "Q3 2026", 3, "Nadir", "Finta", 6, "Sales interactive", "BIM", "Phase 1"),
    ("WB-19", "BIMA PPC + NPD", "BIMA", "P2", "Q3 2026", 4, "Andre", "Michael", 6, "PPC & NPD module", "BIM", "Phase 1"),
    ("WB-34", "HRIS Employee Dashboard", "HRIS", "P2", "Q3 2026", 4, "Abhi", "Finta", 6, "Employee self-service", "HRS", "Phase 2"),
    ("WB-39", "EIL Audit", "Internal", "P2", "Q3 2026", 4, "Andre", "Michael", 6, "Audit module", "INT", "Phase 2"),
    ("WB-43", "TMS - Proof of Delivery", "Ecommerce", "P2", "Q3 2026", 4, "Nadir", "Finta", 6, "Nadir (TMS); QR handheld -> Ignas", "TMS", "Phase 2"),
    ("WB-48", "Dashboard Ecom (NEW) + Support", "Ecommerce", "P2", "Q3 2026", 5, "Abhi", "Michael", 6, "New ecom dashboard", "SCR", "Phase 2"),
    ("WB-15", "Stok Health RFID", "WMS", "P2", "Q3 2026", 5, "Ignas", "Finta", 6, "Handheld RFID -> Ignas", "WMS", "Phase 2"),
    ("WB-21", "Nexora Approval - Dokumen SAP", "Nexora", "P2", "Q4 2026", 7, "Nathan", "Michael", 8, "SAP Integration -> Nathan", "SCE", "Phase 3"),
    ("WB-22", "Nexora Approval - Integration", "Nexora", "P2", "Q4 2026", 7, "Nadir", "Finta", 6, "Integration layer", "SCE", "Phase 3"),
    ("WB-24", "WMS Sister Company", "WMS", "P2", "Q4 2026", 7, "Andre", "Michael", 6, "Multi-entity WMS", "WMS", "Phase 3"),
    ("WB-25", "Revamp Catalog", "Ecommerce", "P2", "Q4 2026", 8, "Okhy", "Finta", 8, "Okhy fokus revamp ecommerce", "SCR", "Phase 2"),
    ("WB-38", "Integrasi PO - DPR Nagora SAP", "Nexora", "P2", "Q4 2026", 8, "Nathan", "Michael", 6, "SAP Integration -> Nathan", "SCE", "Phase 3"),
    ("WB-45", "Nexora ONE - Approval Credit", "Nexora", "P2", "Q4 2026", 8, "Nathan", "Finta", 5, "Cash Engine -> Nathan", "SCE", "Phase 2"),
    ("WB-46", "Nexora ONE - Approval HET", "Nexora", "P2", "Q4 2026", 9, "Nathan", "Michael", 8, "Cash Engine -> Nathan", "SCE", "Phase 2"),
    ("WB-18", "DI Champions (WMS)", "WMS", "P3", "Q1 2027", 13, "Andre", "Finta", 6, "Continuous improvement", "WMS", "Phase 4"),
    ("WB-32", "Portal External Vendor", "Ecommerce", "P3", "Q1 2027", 13, "Abhi", "Michael", 6, "Okhy -> hanya Revamp; re-assign ke Abhi", "SCR", "Phase 3"),
    ("WB-33", "Esign E-Materai & Eloktur", "Internal", "P3", "Q1 2027", 13, None, "Finta", 6, "Pending dev assignment", "INT", "Phase 3"),
    ("WB-35", "BIMA - Colab Sales & Purch", "BIMA", "P3", "Q1 2027", 14, "Abhi", "Michael", 6, "Collaboration sales & purch", "BIM", "Phase 2"),
    ("WB-36", "Absen Registrasi (Fingerspot)", "HRIS", "P3", "Q1 2027", 14, "Ignas", "Finta", 6, "Device integration -> Ignas", "HRS", "Phase 3"),
    ("WB-40", "Nexora Commerce", "Nexora", "P3", "Q1 2027", 15, "Nadir", "Michael", 6, "Commerce extension", None, None),
    ("WB-41", "Nexora Assurance", "Nexora", "P3", "Q1 2027", 15, "Nadir", "Finta", 6, "Assurance module", None, None),
    ("WB-42", "Search Engine Rufi's", "Internal", "P3", "Q1 2027", 16, None, "Michael", 6, "Pending dev assignment", "INT", "Phase 4"),
    ("WB-44", "BIMA - Dealer Active Reminder", "BIMA", "P3", "Q1 2027", 16, "Nadir", "Finta", 6, "Okhy -> hanya Revamp; re-assign ke Nadir", "BIM", "Phase 3"),
    ("WB-47", "VAS - Value Added Shipping", "Ecommerce", "P3", "Q1 2027", 17, "Abhi", "Michael", 6, "Okhy -> hanya Revamp; re-assign ke Abhi", "TMS", "Phase 3"),
    ("WB-49", "LIO - Listen Identity Ordament", "Ecommerce", "P3", "Q1 2027", 17, "Abhi", "Finta", 6, "Identity service", "SCR", "Phase 3"),
    ("WB-37", "Podcast System", "Internal", "P4", "Q2 2027", 19, None, None, 3, "Internal podcast platform", "INT", "Phase 4"),
]

DEMO_STATUS = {
    "WB-01": ("Done", 100, "2026-07-15"),
    "WB-02": ("Done", 100, "2026-07-15"),
    "WB-04": ("In Review", 80, None),
    "WB-05": ("In Progress", 60, None),
    "WB-11": ("In Progress", 40, None),
    "WB-20": ("In Progress", 30, None),
    "WB-23": ("In Review", 70, None),
}


def main():
    with conn() as c:
        cur = c.cursor()

        if RESET:
            print("Wiping existing data...")
            for t in ("Activity", "BacklogItems", "Projects", "Sprints", "TeamMembers"):
                cur.execute(f"SELECT COUNT(*) AS n FROM dbo.{t}")
                had_rows = cur.fetchone()["n"] > 0
                cur.execute(f"DELETE FROM dbo.{t}")
                # Only RESEED if the table has had rows before; skipping RESEED on
                # never-populated tables keeps the first insert at Id=1 (IDENTITY default).
                if had_rows:
                    cur.execute(f"DBCC CHECKIDENT ('dbo.{t}', RESEED, 0)")
            c.commit()

        cur.execute("SELECT COUNT(*) AS n FROM dbo.TeamMembers")
        if cur.fetchone()["n"] > 0 and not RESET:
            print("Data already present; skipping (use --reset to wipe).")
            return

        # Team
        name_to_id = {}
        for row in TEAM:
            cur.execute(
                """INSERT INTO dbo.TeamMembers (Name, Role, Email, Areas, Rules, CapacitySp, AvatarColor)
                   OUTPUT INSERTED.Id
                   VALUES (%s,%s,%s,%s,%s,%s,%s)""",
                row,
            )
            rid = cur.fetchone()["Id"]
            name_to_id[row[0]] = rid
        print(f"Inserted {len(TEAM)} team members")

        # Projects
        code_to_id = {}
        for name, code, sys_tag, desc, owner_name, color, status in PROJECTS:
            owner_id = name_to_id.get(owner_name)
            cur.execute(
                """INSERT INTO dbo.Projects (Name, Code, [Description], [System], OwnerId, Color, [Status])
                   OUTPUT INSERTED.Id
                   VALUES (%s,%s,%s,%s,%s,%s,%s)""",
                (name, code, desc, sys_tag, owner_id, color, status),
            )
            rid = cur.fetchone()["Id"]
            code_to_id[code] = rid
        print(f"Inserted {len(PROJECTS)} projects")

        # Sprints
        num_to_id = {}
        for row in SPRINTS:
            cur.execute(
                """INSERT INTO dbo.Sprints (SprintNumber, Name, Quarter, StartDate, EndDate, Goal, [Status], CapacitySp)
                   OUTPUT INSERTED.Id
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
                row,
            )
            rid = cur.fetchone()["Id"]
            num_to_id[row[0]] = rid
        print(f"Inserted {len(SPRINTS)} sprints")

        # Backlog
        n = 0
        for (wb, title, sys_tag, prio, quarter, sprint_num, dev, qa, sp,
             notes, proj_code, phase) in BACKLOG:
            status, pct, actual_date = DEMO_STATUS.get(wb, ("Backlog", 0, None))
            cur.execute(
                """INSERT INTO dbo.BacklogItems
                   (WbRef, Title, [System], Priority, Quarter, ProjectId, Phase, SprintId,
                    DevAssigneeId, QaAssigneeId, StoryPoints, ActualDate, PercentDone, [Status], Notes)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (wb, title, sys_tag, prio, quarter,
                 code_to_id.get(proj_code) if proj_code else None,
                 phase,
                 num_to_id.get(sprint_num),
                 name_to_id.get(dev) if dev else None,
                 name_to_id.get(qa) if qa else None,
                 sp, actual_date, pct, status, notes),
            )
            n += 1
        print(f"Inserted {n} backlog items")

        c.commit()
        print("Seed complete.")


if __name__ == "__main__":
    main()
