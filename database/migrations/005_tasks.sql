-- =====================================================================
-- SOPRA PM — Migration 005
-- Adds dbo.Tasks: the individual pieces of work under a backlog item,
-- each with an assignee, a status and an optional blocker note.
--
-- Matches the table definition supplied for the server, so running this on a
-- database that already has it is a no-op.
-- Safe to re-run.
-- =====================================================================

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('dbo.Tasks', 'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Tasks](
        [Id]            [int] IDENTITY(1,1) NOT NULL,
        [Title]         [nvarchar](max) NOT NULL,
        [BacklogItemId] [int] NOT NULL,
        [AssigneeId]    [int] NOT NULL,
        [Status]        [varchar](50) NULL,
        [CreatedAt]     [datetime] NULL,
        [UpdatedAt]     [datetime] NULL,
        [Blocker]       [nvarchar](max) NULL,
        PRIMARY KEY CLUSTERED ([Id] ASC)
            WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF,
                  ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
    ) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY];

    ALTER TABLE [dbo].[Tasks] ADD DEFAULT ('In Progress') FOR [Status];
    ALTER TABLE [dbo].[Tasks] ADD DEFAULT (getdate()) FOR [CreatedAt];
    ALTER TABLE [dbo].[Tasks] ADD DEFAULT (getdate()) FOR [UpdatedAt];

    ALTER TABLE [dbo].[Tasks] WITH CHECK ADD CONSTRAINT [FK_Tasks_Assignee]
        FOREIGN KEY([AssigneeId]) REFERENCES [dbo].[TeamMembers] ([Id]);
    ALTER TABLE [dbo].[Tasks] CHECK CONSTRAINT [FK_Tasks_Assignee];

    ALTER TABLE [dbo].[Tasks] WITH CHECK ADD CONSTRAINT [FK_Tasks_Backlog]
        FOREIGN KEY([BacklogItemId]) REFERENCES [dbo].[BacklogItems] ([Id]);
    ALTER TABLE [dbo].[Tasks] CHECK CONSTRAINT [FK_Tasks_Backlog];
END
GO

-- Lookup index for "the tasks of this backlog item", which is every read the app does.
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.Tasks') AND name = 'IX_Tasks_BacklogItem'
)
BEGIN
    CREATE INDEX IX_Tasks_BacklogItem ON dbo.Tasks (BacklogItemId, Id);
END
GO

PRINT 'Migration 005 applied: dbo.Tasks.';
GO
