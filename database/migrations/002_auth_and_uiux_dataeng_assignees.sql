-- =====================================================================
-- SOPRA PM — Migration 002
-- Adds: TeamMembers.PasswordHash (login auth)
--       BacklogItems.UiuxAssigneeId, BacklogItems.DataEngAssigneeId
-- Safe to re-run: every change is guarded with an existence check.
-- Run against an EXISTING SOPRA_PM database (does not drop/recreate tables,
-- unlike schema.sql which is meant for fresh installs only).
-- =====================================================================

SET NOCOUNT ON;
GO

-- ---------- TeamMembers.PasswordHash ----------
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.TeamMembers') AND name = 'PasswordHash'
)
BEGIN
    ALTER TABLE dbo.TeamMembers ADD PasswordHash NVARCHAR(255) NULL;
END
GO

-- Unique index on Email (case-insensitive by default collation), ignoring NULLs
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.TeamMembers') AND name = 'UQ_TeamMembers_Email'
)
BEGIN
    CREATE UNIQUE INDEX UQ_TeamMembers_Email ON dbo.TeamMembers (Email) WHERE Email IS NOT NULL;
END
GO

-- ---------- BacklogItems.UiuxAssigneeId ----------
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.BacklogItems') AND name = 'UiuxAssigneeId'
)
BEGIN
    ALTER TABLE dbo.BacklogItems ADD UiuxAssigneeId INT NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_BacklogItems_Uiux'
)
BEGIN
    ALTER TABLE dbo.BacklogItems
        ADD CONSTRAINT FK_BacklogItems_Uiux
        FOREIGN KEY (UiuxAssigneeId) REFERENCES dbo.TeamMembers(Id) ON DELETE NO ACTION;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.BacklogItems') AND name = 'IX_BacklogItems_UiuxAssign'
)
BEGIN
    CREATE INDEX IX_BacklogItems_UiuxAssign ON dbo.BacklogItems (UiuxAssigneeId);
END
GO

-- ---------- BacklogItems.DataEngAssigneeId ----------
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.BacklogItems') AND name = 'DataEngAssigneeId'
)
BEGIN
    ALTER TABLE dbo.BacklogItems ADD DataEngAssigneeId INT NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_BacklogItems_DataEng'
)
BEGIN
    ALTER TABLE dbo.BacklogItems
        ADD CONSTRAINT FK_BacklogItems_DataEng
        FOREIGN KEY (DataEngAssigneeId) REFERENCES dbo.TeamMembers(Id) ON DELETE NO ACTION;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.BacklogItems') AND name = 'IX_BacklogItems_DataEngAssign'
)
BEGIN
    CREATE INDEX IX_BacklogItems_DataEngAssign ON dbo.BacklogItems (DataEngAssigneeId);
END
GO

PRINT 'Migration 002 applied: auth (PasswordHash) + UI/UX & Data Engineer assignees.';
GO
