-- =====================================================================
-- SOPRA PM — Migration 006
-- Adds the "Pending" backlog status (Backlog | Pending | In Progress |
-- In Review | Done). BacklogItems.[Status] is a free NVARCHAR(20) with no
-- CHECK constraint, so no schema change is needed.
--
-- Moves items that are still in Backlog but are flagged in their notes as
-- waiting on something ("Pending assignment", "Pending dev assignment", ...)
-- into the new Pending status.
-- Safe to re-run.
-- =====================================================================

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

UPDATE dbo.BacklogItems
   SET [Status] = 'Pending'
 WHERE [Status] = 'Backlog'
   AND Notes LIKE 'Pending%';

PRINT CONCAT('Migration 006 applied: ', @@ROWCOUNT, ' backlog item(s) moved to Pending.');
GO
