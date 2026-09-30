-- =====================================================================
-- SOPRA PM — Migration 007
-- Tasks get their own two statuses: Complete | Incomplete. The five
-- backlog statuses (Backlog, In Progress, Pending, In Review, Done) stay
-- on dbo.BacklogItems only.
--
--   * existing rows: done-ish spellings ('Done', 'Complete', 'Completed',
--     'Closed', any casing) -> 'Complete'; anything else -> 'Incomplete'
--   * the column default becomes 'Incomplete'
--   * a CHECK constraint keeps it to the two values
-- Safe to re-run.
-- =====================================================================

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- The live table holds 'Completed' (with the d) and 'In Progress'. Matching only
-- 'Done'/'Complete' would sweep every finished task into 'Incomplete', so the
-- done-ish spellings are matched loosely, trimmed and case-insensitively.
UPDATE dbo.Tasks
   SET [Status] = CASE
                    WHEN LOWER(LTRIM(RTRIM([Status]))) IN ('done', 'complete', 'completed', 'closed')
                    THEN 'Complete'
                    ELSE 'Incomplete'
                  END
 WHERE [Status] IS NULL OR [Status] NOT IN ('Complete', 'Incomplete');
GO

-- The default from migration 005 has a generated name, so find it and drop it.
DECLARE @df sysname = (
    SELECT dc.name
      FROM sys.default_constraints dc
      JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
     WHERE dc.parent_object_id = OBJECT_ID('dbo.Tasks') AND c.name = 'Status'
);
IF @df IS NOT NULL AND @df <> 'DF_Tasks_Status'
    EXEC ('ALTER TABLE dbo.Tasks DROP CONSTRAINT ' + QUOTENAME(@df));
GO

IF NOT EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_Tasks_Status')
    ALTER TABLE dbo.Tasks ADD CONSTRAINT DF_Tasks_Status DEFAULT ('Incomplete') FOR [Status];
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Tasks_Status')
    ALTER TABLE dbo.Tasks WITH CHECK
        ADD CONSTRAINT CK_Tasks_Status CHECK ([Status] IN ('Complete', 'Incomplete'));
GO

PRINT 'Migration 007 applied: task status is Complete | Incomplete.';
GO
