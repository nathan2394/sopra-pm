-- =====================================================================
-- SOPRA PM — Migration 003
-- Adds: BacklogItems.Url                  (reference link on an item)
--       BacklogItems.Attachment*          (a single PDF, stored in-row)
-- Renames: TeamMembers.Role 'Data Engineer' -> 'AI Engineer'
-- Safe to re-run: every change is guarded with an existence check.
-- =====================================================================

SET NOCOUNT ON;
GO

-- ---------- BacklogItems.Url ----------
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.BacklogItems') AND name = 'Url'
)
BEGIN
    ALTER TABLE dbo.BacklogItems ADD Url NVARCHAR(500) NULL;
END
GO

-- ---------- BacklogItems attachment (one PDF per item, stored in the row) ----------
-- VARBINARY(MAX) keeps the file inside the existing database backup and needs no
-- filesystem permissions on the IIS app pool identity.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.BacklogItems') AND name = 'AttachmentName'
)
BEGIN
    ALTER TABLE dbo.BacklogItems ADD AttachmentName NVARCHAR(260) NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.BacklogItems') AND name = 'AttachmentContentType'
)
BEGIN
    ALTER TABLE dbo.BacklogItems ADD AttachmentContentType NVARCHAR(100) NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.BacklogItems') AND name = 'AttachmentSize'
)
BEGIN
    ALTER TABLE dbo.BacklogItems ADD AttachmentSize INT NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.BacklogItems') AND name = 'AttachmentData'
)
BEGIN
    ALTER TABLE dbo.BacklogItems ADD AttachmentData VARBINARY(MAX) NULL;
END
GO

-- ---------- Role rename: Data Engineer -> AI Engineer ----------
-- Label change only. The BacklogItems.DataEngAssigneeId column and the
-- data_eng_assignee_id API field keep their names, so nothing else has to move.
-- Rollback:
--   UPDATE dbo.TeamMembers SET Role = 'Data Engineer' WHERE Role = 'AI Engineer';
IF EXISTS (SELECT 1 FROM dbo.TeamMembers WHERE Role = 'Data Engineer')
BEGIN
    UPDATE dbo.TeamMembers SET Role = 'AI Engineer' WHERE Role = 'Data Engineer';
END
GO

PRINT 'Migration 003 applied: item Url + PDF attachment, Data Engineer -> AI Engineer.';
GO
