-- =====================================================================
-- SOPRA PM — Migration 004
-- Replaces the single-file columns added in 003 with a proper
-- dbo.BacklogAttachments table: an item can now carry several files
-- (pasted screenshots as well as PDFs).
--
-- The 003 columns held no rows in any environment when this was written, so
-- there is nothing to migrate; the DROPs below are guarded and skip anything
-- that still has data.
-- Safe to re-run.
-- =====================================================================

SET NOCOUNT ON;
GO

IF OBJECT_ID('dbo.BacklogAttachments', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.BacklogAttachments (
        Id          INT             IDENTITY(1,1) NOT NULL,
        ItemId      INT             NOT NULL,
        [Name]      NVARCHAR(260)   NOT NULL,
        ContentType NVARCHAR(100)   NOT NULL,   -- image/png, image/jpeg, application/pdf, ...
        [Size]      INT             NOT NULL,
        [Data]      VARBINARY(MAX)  NOT NULL,
        CreatedBy   INT             NULL,       -- FK -> TeamMembers.Id
        CreatedAt   DATETIME2(3)    NOT NULL DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_BacklogAttachments PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_BacklogAttachments_Item
            FOREIGN KEY (ItemId)    REFERENCES dbo.BacklogItems(Id)  ON DELETE CASCADE,
        CONSTRAINT FK_BacklogAttachments_Actor
            FOREIGN KEY (CreatedBy) REFERENCES dbo.TeamMembers(Id)   ON DELETE SET NULL
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.BacklogAttachments') AND name = 'IX_BacklogAttachments_Item'
)
BEGIN
    CREATE INDEX IX_BacklogAttachments_Item ON dbo.BacklogAttachments (ItemId, CreatedAt);
END
GO

-- ---------- Retire the single-file columns from migration 003 ----------
-- Only when they are genuinely empty; if anything was stored in the meantime
-- the columns are left alone so the data can be moved by hand first.
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.BacklogItems') AND name = 'AttachmentData'
)
AND NOT EXISTS (SELECT 1 FROM dbo.BacklogItems WHERE AttachmentData IS NOT NULL)
BEGIN
    ALTER TABLE dbo.BacklogItems DROP COLUMN AttachmentData;
    ALTER TABLE dbo.BacklogItems DROP COLUMN AttachmentName;
    ALTER TABLE dbo.BacklogItems DROP COLUMN AttachmentContentType;
    ALTER TABLE dbo.BacklogItems DROP COLUMN AttachmentSize;
    PRINT 'Dropped the empty single-attachment columns from dbo.BacklogItems.';
END
GO

PRINT 'Migration 004 applied: dbo.BacklogAttachments (multi-file, images + PDF).';
GO
