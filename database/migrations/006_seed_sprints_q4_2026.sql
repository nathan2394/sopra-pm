-- =====================================================================
-- SOPRA PM — Seed 006
-- Sprints for October, November and December 2026, continuing the cadence
-- already in use:
--   * one sprint per week, named "<Month> W<n>" with Indonesian month names
--   * W1 = 1st-7th, W2 = 8th-14th, W3 = 15th-21st, W4 = 22nd-end of month
--   * quarter Q4 2026, status Planned, capacity 346 (the established figure)
--
-- Goals are left NULL for the PM to fill in.
-- SprintNumber is assigned from the current maximum, so this cannot collide
-- with existing rows. Safe to re-run: sprints are matched by name.
-- =====================================================================

SET NOCOUNT ON;
GO

DECLARE @next INT = (SELECT ISNULL(MAX(SprintNumber), 0) + 1 FROM dbo.Sprints);

;WITH NewSprints([Name], StartDate, EndDate, Seq) AS (
    SELECT * FROM (VALUES
        ('Oktober W1',  '2026-10-01', '2026-10-07',  1),
        ('Oktober W2',  '2026-10-08', '2026-10-14',  2),
        ('Oktober W3',  '2026-10-15', '2026-10-21',  3),
        ('Oktober W4',  '2026-10-22', '2026-10-31',  4),
        ('November W1', '2026-11-01', '2026-11-07',  5),
        ('November W2', '2026-11-08', '2026-11-14',  6),
        ('November W3', '2026-11-15', '2026-11-21',  7),
        ('November W4', '2026-11-22', '2026-11-30',  8),
        ('Desember W1', '2026-12-01', '2026-12-07',  9),
        ('Desember W2', '2026-12-08', '2026-12-14', 10),
        ('Desember W3', '2026-12-15', '2026-12-21', 11),
        ('Desember W4', '2026-12-22', '2026-12-31', 12)
    ) AS v([Name], StartDate, EndDate, Seq)
)
INSERT INTO dbo.Sprints (SprintNumber, [Name], Quarter, StartDate, EndDate, Goal, [Status], CapacitySp)
SELECT @next + ROW_NUMBER() OVER (ORDER BY n.Seq) - 1,
       n.[Name],
       'Q4 2026',
       CAST(n.StartDate AS DATE),
       CAST(n.EndDate   AS DATE),
       NULL,
       'Planned',
       346
  FROM NewSprints n
 WHERE NOT EXISTS (SELECT 1 FROM dbo.Sprints s WHERE s.[Name] = n.[Name]);

PRINT CONCAT('Seed 006: inserted ', @@ROWCOUNT, ' sprint(s) for Q4 2026.');
GO
