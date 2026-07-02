-- =====================================================================
-- SOPRA PM — SQL Server DDL
-- Target: Microsoft SQL Server 2019+
-- Database: SOPRA_PM
-- Convention: PascalCase table names, INT IDENTITY primary keys
-- =====================================================================
-- Run this script inside the SOPRA_PM database.
-- (CREATE DATABASE SOPRA_PM; USE SOPRA_PM;)
-- =====================================================================

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- ---------- Drop existing objects (safe re-run) ----------
IF OBJECT_ID('dbo.Activity', 'U')     IS NOT NULL DROP TABLE dbo.Activity;
IF OBJECT_ID('dbo.BacklogItems', 'U') IS NOT NULL DROP TABLE dbo.BacklogItems;
IF OBJECT_ID('dbo.Projects', 'U')     IS NOT NULL DROP TABLE dbo.Projects;
IF OBJECT_ID('dbo.Sprints', 'U')      IS NOT NULL DROP TABLE dbo.Sprints;
IF OBJECT_ID('dbo.TeamMembers', 'U')  IS NOT NULL DROP TABLE dbo.TeamMembers;
GO


-- =====================================================================
-- TeamMembers
-- =====================================================================
CREATE TABLE dbo.TeamMembers (
    Id           INT             IDENTITY(1,1) NOT NULL,
    Name         NVARCHAR(120)   NOT NULL,
    Role         NVARCHAR(60)    NOT NULL,          -- Backend Dev, QA, Product Manager, Data Engineer, UI/UX
    Email        NVARCHAR(200)   NULL,
    PasswordHash NVARCHAR(255)   NULL,              -- bcrypt hash; NULL = login disabled for this member
    Areas        NVARCHAR(500)   NULL,              -- comma-separated system tags
    Rules        NVARCHAR(MAX)   NULL,
    CapacitySp   INT             NOT NULL DEFAULT (20),
    AvatarColor  NVARCHAR(20)    NULL,
    CreatedAt    DATETIME2(3)    NOT NULL DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_TeamMembers PRIMARY KEY CLUSTERED (Id)
);
GO

CREATE INDEX IX_TeamMembers_Role ON dbo.TeamMembers (Role);
GO

CREATE UNIQUE INDEX UQ_TeamMembers_Email ON dbo.TeamMembers (Email) WHERE Email IS NOT NULL;
GO


-- =====================================================================
-- Sprints
-- =====================================================================
CREATE TABLE dbo.Sprints (
    Id           INT             IDENTITY(1,1) NOT NULL,
    SprintNumber INT             NOT NULL,
    Name         NVARCHAR(80)    NOT NULL,
    Quarter      NVARCHAR(20)    NOT NULL,          -- e.g. "Q3 2026"
    StartDate    DATE            NOT NULL,
    EndDate      DATE            NOT NULL,
    Goal         NVARCHAR(500)   NULL,
    [Status]     NVARCHAR(20)    NOT NULL DEFAULT ('Planned'),  -- Planned | Active | Completed
    CapacitySp   INT             NOT NULL DEFAULT (30),
    CreatedAt    DATETIME2(3)    NOT NULL DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_Sprints PRIMARY KEY CLUSTERED (Id),
    CONSTRAINT UQ_Sprints_SprintNumber UNIQUE (SprintNumber)
);
GO

CREATE INDEX IX_Sprints_Quarter ON dbo.Sprints (Quarter);
GO


-- =====================================================================
-- Projects  (parent grouping — e.g. "Sopra Cash Engine" with phases)
-- =====================================================================
CREATE TABLE dbo.Projects (
    Id           INT             IDENTITY(1,1) NOT NULL,
    Name         NVARCHAR(120)   NOT NULL,
    Code         NVARCHAR(10)    NULL,
    [Description]NVARCHAR(MAX)   NULL,
    [System]     NVARCHAR(40)    NULL,              -- default system tag
    OwnerId      INT             NULL,              -- FK -> TeamMembers.Id
    Color        NVARCHAR(20)    NOT NULL DEFAULT ('#0033CC'),
    [Status]     NVARCHAR(20)    NOT NULL DEFAULT ('Active'),   -- Active | Paused | Completed | Archived
    CreatedAt    DATETIME2(3)    NOT NULL DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_Projects PRIMARY KEY CLUSTERED (Id),
    CONSTRAINT FK_Projects_Owner
        FOREIGN KEY (OwnerId) REFERENCES dbo.TeamMembers(Id) ON DELETE SET NULL
);
GO

CREATE INDEX IX_Projects_Code ON dbo.Projects (Code);
GO


-- =====================================================================
-- BacklogItems
-- =====================================================================
CREATE TABLE dbo.BacklogItems (
    Id             INT           IDENTITY(1,1) NOT NULL,
    WbRef          NVARCHAR(20)  NOT NULL,          -- WB-01, WB-02, ...
    Title          NVARCHAR(200) NOT NULL,
    [System]       NVARCHAR(40)  NOT NULL,          -- WMS, Ecommerce, HRIS, ...
    Priority       NVARCHAR(4)   NOT NULL,          -- P1, P2, P3, P4
    Quarter        NVARCHAR(20)  NOT NULL,          -- e.g. "Q3 2026"
    ProjectId      INT           NULL,
    Phase          NVARCHAR(40)  NULL,              -- Phase 1, Phase 2, ...
    SprintId       INT           NULL,
    DevAssigneeId  INT           NULL,
    QaAssigneeId   INT           NULL,
    UiuxAssigneeId    INT        NULL,
    DataEngAssigneeId INT        NULL,
    StoryPoints    INT           NOT NULL DEFAULT (0),
    TargetDate     DATE          NULL,
    ActualDate     DATE          NULL,
    PercentDone    INT           NOT NULL DEFAULT (0),
    [Status]       NVARCHAR(20)  NOT NULL DEFAULT ('Backlog'),   -- Backlog | In Progress | In Review | Done
    Notes          NVARCHAR(MAX) NULL,
    CreatedAt      DATETIME2(3)  NOT NULL DEFAULT (SYSUTCDATETIME()),
    UpdatedAt      DATETIME2(3)  NOT NULL DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_BacklogItems PRIMARY KEY CLUSTERED (Id),
    CONSTRAINT UQ_BacklogItems_WbRef UNIQUE (WbRef),
    CONSTRAINT FK_BacklogItems_Project
        FOREIGN KEY (ProjectId)     REFERENCES dbo.Projects(Id)     ON DELETE SET NULL,
    CONSTRAINT FK_BacklogItems_Sprint
        FOREIGN KEY (SprintId)      REFERENCES dbo.Sprints(Id)      ON DELETE SET NULL,
    CONSTRAINT FK_BacklogItems_Dev
        FOREIGN KEY (DevAssigneeId) REFERENCES dbo.TeamMembers(Id)  ON DELETE NO ACTION,
    CONSTRAINT FK_BacklogItems_Qa
        FOREIGN KEY (QaAssigneeId)  REFERENCES dbo.TeamMembers(Id)  ON DELETE NO ACTION,
    CONSTRAINT FK_BacklogItems_Uiux
        FOREIGN KEY (UiuxAssigneeId)    REFERENCES dbo.TeamMembers(Id) ON DELETE NO ACTION,
    CONSTRAINT FK_BacklogItems_DataEng
        FOREIGN KEY (DataEngAssigneeId) REFERENCES dbo.TeamMembers(Id) ON DELETE NO ACTION
);
GO

CREATE INDEX IX_BacklogItems_Status    ON dbo.BacklogItems ([Status]);
CREATE INDEX IX_BacklogItems_Priority  ON dbo.BacklogItems (Priority);
CREATE INDEX IX_BacklogItems_Quarter   ON dbo.BacklogItems (Quarter);
CREATE INDEX IX_BacklogItems_Sprint    ON dbo.BacklogItems (SprintId);
CREATE INDEX IX_BacklogItems_Project   ON dbo.BacklogItems (ProjectId);
CREATE INDEX IX_BacklogItems_System    ON dbo.BacklogItems ([System]);
CREATE INDEX IX_BacklogItems_DevAssign ON dbo.BacklogItems (DevAssigneeId);
CREATE INDEX IX_BacklogItems_UiuxAssign    ON dbo.BacklogItems (UiuxAssigneeId);
CREATE INDEX IX_BacklogItems_DataEngAssign ON dbo.BacklogItems (DataEngAssigneeId);
GO


-- =====================================================================
-- Activity  (comments + auto-logged field changes)
-- =====================================================================
CREATE TABLE dbo.Activity (
    Id         INT            IDENTITY(1,1) NOT NULL,
    ItemId     INT            NOT NULL,               -- FK -> BacklogItems.Id
    Kind       NVARCHAR(10)   NOT NULL,               -- 'comment' | 'change'
    ActorId    INT            NULL,                   -- FK -> TeamMembers.Id (nullable = system/guest)
    [Text]     NVARCHAR(MAX)  NULL,                   -- comment body OR "Status changed"
    [Field]    NVARCHAR(40)   NULL,                   -- for kind=change: which field
    FromValue  NVARCHAR(400)  NULL,
    ToValue    NVARCHAR(400)  NULL,
    CreatedAt  DATETIME2(3)   NOT NULL DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_Activity PRIMARY KEY CLUSTERED (Id),
    CONSTRAINT FK_Activity_Item
        FOREIGN KEY (ItemId)  REFERENCES dbo.BacklogItems(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Activity_Actor
        FOREIGN KEY (ActorId) REFERENCES dbo.TeamMembers(Id)  ON DELETE SET NULL
);
GO

CREATE INDEX IX_Activity_Item_CreatedAt ON dbo.Activity (ItemId, CreatedAt DESC);
CREATE INDEX IX_Activity_Kind           ON dbo.Activity (Kind);
GO


-- =====================================================================
-- Helper trigger — auto-update BacklogItems.UpdatedAt
-- =====================================================================
IF OBJECT_ID('dbo.TR_BacklogItems_UpdatedAt', 'TR') IS NOT NULL
    DROP TRIGGER dbo.TR_BacklogItems_UpdatedAt;
GO

CREATE TRIGGER dbo.TR_BacklogItems_UpdatedAt
ON dbo.BacklogItems
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE b
       SET UpdatedAt = SYSUTCDATETIME()
      FROM dbo.BacklogItems b
     INNER JOIN inserted i ON b.Id = i.Id;
END;
GO

PRINT 'SOPRA PM schema created successfully.';
GO
