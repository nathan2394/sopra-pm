namespace SopraPm.Tools;

/// <summary>
/// The initial SOPRA PM dataset, carried over verbatim from the Python seed script.
/// </summary>
internal static class SeedData
{
    internal sealed record TeamSeed(string Name, string Role, string Email, string? Areas, string? Rules, int CapacitySp, string? AvatarColor);
    internal sealed record ProjectSeed(string Name, string Code, string? System, string? Description, string? OwnerName, string Color, string Status);
    internal sealed record SprintSeed(int SprintNumber, string Name, string Quarter, string StartDate, string EndDate, string? Goal, string Status, int CapacitySp);
    internal sealed record BacklogSeed(string WbRef, string Title, string System, string Priority, string Quarter, int? SprintNumber, string? Dev, string? Qa, int StoryPoints, string? Notes, string? ProjectCode, string? Phase);
    internal sealed record DemoStatus(string Status, int PercentDone, string? ActualDate);
    internal sealed record ExtraAssignees(string? Uiux, string? DataEng);

    internal static readonly TeamSeed[] Team =
    {
        new TeamSeed("Nathan", "Product Manager", "nathan@sopra.com", "Nexora,Internal", "SAP Integration & Nexora Cash Engine ONLY", 20, "#0033CC"),
        new TeamSeed("Nando", "Product Manager", "nando@sopra.com", "Internal", "Sopra CAM (shared with Nathan)", 18, "#7C3AED"),
        new TeamSeed("Andre", "Backend Dev", "andre@sopra.com", "WMS,BIMA,Internal", "WMS majority, EIL Audit, BIMA", 26, "#0369A1"),
        new TeamSeed("Abhi", "Backend Dev", "abhi@sopra.com", "Ecommerce,HRIS", "Ecommerce general, HRIS, picks up Okhy overflow", 30, "#047857"),
        new TeamSeed("Nadir", "Backend Dev", "nadir@sopra.com", "Ecommerce,WMS,BIMA,Nexora,Security", "TMS primary, WMS support, BIMA, Nexora", 26, "#B91C1C"),
        new TeamSeed("Okhy", "Backend Dev", "okhy@sopra.com", "Ecommerce", "ONLY Revamp Ecommerce (Catalog & frontend)", 18, "#D97706"),
        new TeamSeed("Ignas", "Backend Dev", "ignas@sopra.com", "WMS,Ecommerce,HRIS", "ONLY Handheld devices (RFID, QR Scanner, Fingerspot)", 16, "#BE185D"),
        new TeamSeed("Finta", "QA", "finta@sopra.com", "All", "QA across all projects", 24, "#4338CA"),
        new TeamSeed("Michael", "QA", "michael@sopra.com", "All", "QA across all projects", 24, "#854D0E"),
        new TeamSeed("Nadia", "Data Engineer", "nadia@sopra.com", "Internal", "Data pipelines & analytics", 18, "#0F766E"),
        new TeamSeed("Fitri", "Data Engineer", "fitri@sopra.com", "Internal", "Data pipelines & analytics", 18, "#9333EA"),
        new TeamSeed("Finley", "Data Engineer", "finley@sopra.com", "Internal", "Data pipelines & analytics", 18, "#0891B2"),
        new TeamSeed("Mukaram", "UI/UX", "mukaram@sopra.com", "All", "Design for all systems", 20, "#DC2626"),
    };

    internal static readonly ProjectSeed[] Projects =
    {
        new ProjectSeed("Sopra Cash Engine", "SCE", "Nexora",
            "Phase 1: Migrasi forecast dari Excel. Phase 2: Realisasi bank dari mutasi bank. Phase 3: Integrasi realisasi ke SAP (konsolidasi).",
            "Nathan", "#4338CA", "Active"),
        new ProjectSeed("Sopra Commerce Revamp", "SCR", "Ecommerce",
            "Revamp ecommerce — Catalog & frontend modernization, payment flows, vendor portal.",
            "Okhy", "#854D0E", "Active"),
        new ProjectSeed("HRIS SOPRA", "HRS", "HRIS",
            "End-to-end HR Information System: core, employee dashboard, attendance device integrations.",
            "Abhi", "#047857", "Active"),
        new ProjectSeed("WMS Modernization", "WMS", "WMS",
            "Warehouse Management — rework, sister-company multi-entity, stok health RFID, DI champions.",
            "Andre", "#0369A1", "Active"),
        new ProjectSeed("BIMA Suite", "BIM", "BIMA",
            "Sales activation: PPC+NPD, interactive sales, dealer reminders, sales-purch collaboration.",
            "Nadir", "#BE185D", "Active"),
        new ProjectSeed("TMS Delivery", "TMS", "Ecommerce",
            "Transport Management — Proof of Delivery, shipping value added, logistics queue.",
            "Nadir", "#B91C1C", "Active"),
        new ProjectSeed("Internal Platforms", "INT", "Internal",
            "Internal tooling: KPI dashboard, audit, e-sign, search engine, podcast.",
            "Finta", "#374151", "Active"),
    };

    internal static readonly SprintSeed[] Sprints =
    {
        new SprintSeed(1, "Sprint 1", "Q3 2026", "2026-07-07", "2026-07-20", "KPI Dashboard, HRIS SOPRA, Rework WMS, Ekspedisi Queue", "Active", 30),
        new SprintSeed(2, "Sprint 2", "Q3 2026", "2026-07-21", "2026-08-03", "Payment Gateway BCA, Nexora Transfer Token, TOTP 2FA", "Planned", 28),
        new SprintSeed(3, "Sprint 3", "Q3 2026", "2026-08-04", "2026-08-17", "RFD Ecommerce, BIMA Interaktif, Trasmi Dashboard", "Planned", 28),
        new SprintSeed(4, "Sprint 4", "Q3 2026", "2026-08-18", "2026-08-31", "BIMA PPC+NPD, HRIS Employee Dashboard, EIL Audit, TMS POD", "Planned", 28),
        new SprintSeed(5, "Sprint 5", "Q3 2026", "2026-09-01", "2026-09-14", "Dashboard Ecom + Support, Stok Health RFID", "Planned", 24),
        new SprintSeed(6, "Sprint 6", "Q3 2026", "2026-09-15", "2026-09-28", "Q3 Buffer / Hardening", "Planned", 18),
        new SprintSeed(7, "Sprint 7", "Q4 2026", "2026-10-06", "2026-10-19", "Nexora SAP, Nexora Integration, WMS Sister Company", "Planned", 26),
        new SprintSeed(8, "Sprint 8", "Q4 2026", "2026-10-20", "2026-11-02", "Revamp Catalog, PO-DPR Nagora SAP, Nexora Approval Credit", "Planned", 26),
        new SprintSeed(9, "Sprint 9", "Q4 2026", "2026-11-03", "2026-11-16", "Nexora ONE Approval HET", "Planned", 18),
        new SprintSeed(10, "Sprint 10", "Q4 2026", "2026-11-17", "2026-11-30", "Q4 Buffer", "Planned", 16),
        new SprintSeed(11, "Sprint 11", "Q4 2026", "2026-12-01", "2026-12-14", "Q4 Stabilization", "Planned", 16),
        new SprintSeed(12, "Sprint 12", "Q4 2026", "2026-12-15", "2026-12-28", "Year-end Release Candidate", "Planned", 12),
        new SprintSeed(13, "Sprint 13", "Q1 2027", "2027-01-05", "2027-01-18", "DI Champions WMS, Portal External Vendor, Esign E-Materai", "Planned", 24),
        new SprintSeed(14, "Sprint 14", "Q1 2027", "2027-01-19", "2027-02-01", "BIMA Colab Sales & Purch, Absen Registrasi Fingerspot", "Planned", 22),
        new SprintSeed(15, "Sprint 15", "Q1 2027", "2027-02-02", "2027-02-15", "Nexora Commerce, Nexora Assurance", "Planned", 22),
        new SprintSeed(16, "Sprint 16", "Q1 2027", "2027-02-16", "2027-03-01", "Search Engine Rufi's, BIMA Dealer Active Reminder", "Planned", 20),
        new SprintSeed(17, "Sprint 17", "Q1 2027", "2027-03-02", "2027-03-15", "VAS Value Added Shipping, LIO Listen Identity", "Planned", 20),
        new SprintSeed(18, "Sprint 18", "Q1 2027", "2027-03-16", "2027-03-29", "Q1 Buffer", "Planned", 14),
        new SprintSeed(19, "Sprint 19", "Q2 2027", "2027-04-06", "2027-04-19", "Podcast System", "Planned", 10),
    };

    internal static readonly BacklogSeed[] Backlog =
    {
        new BacklogSeed("WB-01", "KPI Dashboard", "Internal", "P1", "Q3 2026", 1, "Finta", null, 8,
            "Owner Finta (delivery dashboard)", "INT", "Phase 1"),
        new BacklogSeed("WB-02", "HRIS SOPRA", "HRIS", "P1", "Q3 2026", 1, "Abhi", "Finta", 8,
            "Core HRIS for SOPRA", "HRS", "Phase 1"),
        new BacklogSeed("WB-04", "Rework WMS", "WMS", "P1", "Q3 2026", 1, "Andre", "Michael", 8,
            "WMS rework primary", "WMS", "Phase 1"),
        new BacklogSeed("WB-05", "Ekspedisi Queue", "Ecommerce", "P1", "Q3 2026", 1, "Abhi", "Finta", 6,
            "Okhy -> hanya Revamp; re-assign ke Abhi", "TMS", "Phase 1"),
        new BacklogSeed("WB-11", "Payment Gateway BCA", "Ecommerce", "P1", "Q3 2026", 2, "Abhi", "Michael", 8,
            "BCA PG integration", "SCR", "Phase 1"),
        new BacklogSeed("WB-20", "Nexora Approval - Transfer Token", "Nexora", "P1", "Q3 2026", 2, "Nathan", "Finta", 8,
            "Cash Engine -> Nathan", "SCE", "Phase 1"),
        new BacklogSeed("WB-23", "TOTP (2FA)", "Security", "P1", "Q3 2026", 2, "Nadir", "Michael", 6,
            "Two-factor auth", null, null),
        new BacklogSeed("WB-06", "Trasmi Dashboard", "Internal", "P2", "Q3 2026", 3, null, null, 6,
            "Pending assignment", "INT", "Phase 2"),
        new BacklogSeed("WB-12", "RFD Ecommerce", "Ecommerce", "P2", "Q3 2026", 3, "Abhi", "Finta", 6,
            "Okhy -> hanya Revamp; re-assign ke Abhi", "SCR", "Phase 1"),
        new BacklogSeed("WB-13", "Dashboard & Notif Ecom (Mobile)", "Ecommerce", "P2", "Q3 2026", 3, "Abhi", "Michael", 6,
            "Mobile ecom UX", "SCR", "Phase 1"),
        new BacklogSeed("WB-16", "BIMA Interaktif (Sales)", "BIMA", "P2", "Q3 2026", 3, "Nadir", "Finta", 6,
            "Sales interactive", "BIM", "Phase 1"),
        new BacklogSeed("WB-19", "BIMA PPC + NPD", "BIMA", "P2", "Q3 2026", 4, "Andre", "Michael", 6,
            "PPC & NPD module", "BIM", "Phase 1"),
        new BacklogSeed("WB-34", "HRIS Employee Dashboard", "HRIS", "P2", "Q3 2026", 4, "Abhi", "Finta", 6,
            "Employee self-service", "HRS", "Phase 2"),
        new BacklogSeed("WB-39", "EIL Audit", "Internal", "P2", "Q3 2026", 4, "Andre", "Michael", 6,
            "Audit module", "INT", "Phase 2"),
        new BacklogSeed("WB-43", "TMS - Proof of Delivery", "Ecommerce", "P2", "Q3 2026", 4, "Nadir", "Finta", 6,
            "Nadir (TMS); QR handheld -> Ignas", "TMS", "Phase 2"),
        new BacklogSeed("WB-48", "Dashboard Ecom (NEW) + Support", "Ecommerce", "P2", "Q3 2026", 5, "Abhi", "Michael", 6,
            "New ecom dashboard", "SCR", "Phase 2"),
        new BacklogSeed("WB-15", "Stok Health RFID", "WMS", "P2", "Q3 2026", 5, "Ignas", "Finta", 6,
            "Handheld RFID -> Ignas", "WMS", "Phase 2"),
        new BacklogSeed("WB-21", "Nexora Approval - Dokumen SAP", "Nexora", "P2", "Q4 2026", 7, "Nathan", "Michael", 8,
            "SAP Integration -> Nathan", "SCE", "Phase 3"),
        new BacklogSeed("WB-22", "Nexora Approval - Integration", "Nexora", "P2", "Q4 2026", 7, "Nadir", "Finta", 6,
            "Integration layer", "SCE", "Phase 3"),
        new BacklogSeed("WB-24", "WMS Sister Company", "WMS", "P2", "Q4 2026", 7, "Andre", "Michael", 6,
            "Multi-entity WMS", "WMS", "Phase 3"),
        new BacklogSeed("WB-25", "Revamp Catalog", "Ecommerce", "P2", "Q4 2026", 8, "Okhy", "Finta", 8,
            "Okhy fokus revamp ecommerce", "SCR", "Phase 2"),
        new BacklogSeed("WB-38", "Integrasi PO - DPR Nagora SAP", "Nexora", "P2", "Q4 2026", 8, "Nathan", "Michael", 6,
            "SAP Integration -> Nathan", "SCE", "Phase 3"),
        new BacklogSeed("WB-45", "Nexora ONE - Approval Credit", "Nexora", "P2", "Q4 2026", 8, "Nathan", "Finta", 5,
            "Cash Engine -> Nathan", "SCE", "Phase 2"),
        new BacklogSeed("WB-46", "Nexora ONE - Approval HET", "Nexora", "P2", "Q4 2026", 9, "Nathan", "Michael", 8,
            "Cash Engine -> Nathan", "SCE", "Phase 2"),
        new BacklogSeed("WB-18", "DI Champions (WMS)", "WMS", "P3", "Q1 2027", 13, "Andre", "Finta", 6,
            "Continuous improvement", "WMS", "Phase 4"),
        new BacklogSeed("WB-32", "Portal External Vendor", "Ecommerce", "P3", "Q1 2027", 13, "Abhi", "Michael", 6,
            "Okhy -> hanya Revamp; re-assign ke Abhi", "SCR", "Phase 3"),
        new BacklogSeed("WB-33", "Esign E-Materai & Eloktur", "Internal", "P3", "Q1 2027", 13, null, "Finta", 6,
            "Pending dev assignment", "INT", "Phase 3"),
        new BacklogSeed("WB-35", "BIMA - Colab Sales & Purch", "BIMA", "P3", "Q1 2027", 14, "Abhi", "Michael", 6,
            "Collaboration sales & purch", "BIM", "Phase 2"),
        new BacklogSeed("WB-36", "Absen Registrasi (Fingerspot)", "HRIS", "P3", "Q1 2027", 14, "Ignas", "Finta", 6,
            "Device integration -> Ignas", "HRS", "Phase 3"),
        new BacklogSeed("WB-40", "Nexora Commerce", "Nexora", "P3", "Q1 2027", 15, "Nadir", "Michael", 6,
            "Commerce extension", null, null),
        new BacklogSeed("WB-41", "Nexora Assurance", "Nexora", "P3", "Q1 2027", 15, "Nadir", "Finta", 6,
            "Assurance module", null, null),
        new BacklogSeed("WB-42", "Search Engine Rufi's", "Internal", "P3", "Q1 2027", 16, null, "Michael", 6,
            "Pending dev assignment", "INT", "Phase 4"),
        new BacklogSeed("WB-44", "BIMA - Dealer Active Reminder", "BIMA", "P3", "Q1 2027", 16, "Nadir", "Finta", 6,
            "Okhy -> hanya Revamp; re-assign ke Nadir", "BIM", "Phase 3"),
        new BacklogSeed("WB-47", "VAS - Value Added Shipping", "Ecommerce", "P3", "Q1 2027", 17, "Abhi", "Michael", 6,
            "Okhy -> hanya Revamp; re-assign ke Abhi", "TMS", "Phase 3"),
        new BacklogSeed("WB-49", "LIO - Listen Identity Ordament", "Ecommerce", "P3", "Q1 2027", 17, "Abhi", "Finta", 6,
            "Identity service", "SCR", "Phase 3"),
        new BacklogSeed("WB-37", "Podcast System", "Internal", "P4", "Q2 2027", 19, null, null, 3,
            "Internal podcast platform", "INT", "Phase 4"),
    };

    internal static readonly Dictionary<string, DemoStatus> DemoStatuses = new()
    {
        ["WB-01"] = new DemoStatus("Done", 100, "2026-07-15"),
        ["WB-02"] = new DemoStatus("Done", 100, "2026-07-15"),
        ["WB-04"] = new DemoStatus("In Review", 80, null),
        ["WB-05"] = new DemoStatus("In Progress", 60, null),
        ["WB-11"] = new DemoStatus("In Progress", 40, null),
        ["WB-20"] = new DemoStatus("In Progress", 30, null),
        ["WB-23"] = new DemoStatus("In Review", 70, null),
        ["WB-06"] = new DemoStatus("Pending", 0, null), // Pending assignment
        ["WB-33"] = new DemoStatus("Pending", 0, null), // Pending dev assignment
        ["WB-42"] = new DemoStatus("Pending", 0, null), // Pending dev assignment
    };

    /// <summary>Extra assignees not covered by the original (dev, qa) columns.</summary>
    internal static readonly Dictionary<string, ExtraAssignees> ExtraAssignments = new()
    {
        ["WB-01"] = new ExtraAssignees(null, "Nadia"),
        ["WB-02"] = new ExtraAssignees("Mukaram", null),
        ["WB-11"] = new ExtraAssignees("Mukaram", null),
        ["WB-13"] = new ExtraAssignees("Mukaram", null),
        ["WB-25"] = new ExtraAssignees("Mukaram", "Fitri"),
        ["WB-34"] = new ExtraAssignees("Mukaram", null),
        ["WB-42"] = new ExtraAssignees(null, "Finley"),
        ["WB-48"] = new ExtraAssignees("Mukaram", null),
    };
}
