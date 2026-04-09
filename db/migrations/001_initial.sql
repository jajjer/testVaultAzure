/*
  Test Vault — Azure SQL schema (Firestore model normalized).
  Timestamps are Unix ms (BIGINT). JSON stored as NVARCHAR(MAX).
*/

IF OBJECT_ID(N'dbo.schema_migrations', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.schema_migrations (
    id INT IDENTITY(1,1) PRIMARY KEY,
    filename NVARCHAR(256) NOT NULL UNIQUE,
    applied_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;
GO

IF OBJECT_ID(N'dbo.users', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.users (
    uid NVARCHAR(128) NOT NULL PRIMARY KEY,
    email NVARCHAR(512) NOT NULL,
    display_name NVARCHAR(512) NOT NULL,
    role NVARCHAR(32) NOT NULL
      CHECK (role IN (N'admin', N'test_lead', N'tester')),
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
  );
END;
GO

IF OBJECT_ID(N'dbo.projects', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.projects (
    id NVARCHAR(128) NOT NULL PRIMARY KEY,
    name NVARCHAR(512) NOT NULL,
    description NVARCHAR(MAX) NOT NULL DEFAULT N'',
    next_case_number INT NOT NULL DEFAULT 1,
    next_run_test_number INT NOT NULL DEFAULT 1,
    parameters_json NVARCHAR(MAX) NOT NULL DEFAULT N'[]',
    test_case_priority_options_json NVARCHAR(MAX) NULL,
    test_case_type_options_json NVARCHAR(MAX) NULL,
    created_by NVARCHAR(128) NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
  );
END;
GO

IF OBJECT_ID(N'dbo.project_members', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.project_members (
    project_id NVARCHAR(128) NOT NULL,
    user_id NVARCHAR(128) NOT NULL,
    email NVARCHAR(512) NOT NULL,
    role NVARCHAR(32) NOT NULL
      CHECK (role IN (N'admin', N'test_lead', N'tester')),
    added_at BIGINT NOT NULL,
    CONSTRAINT PK_project_members PRIMARY KEY (project_id, user_id),
    CONSTRAINT FK_project_members_project
      FOREIGN KEY (project_id) REFERENCES dbo.projects(id) ON DELETE CASCADE
  );
  CREATE INDEX IX_project_members_user_id ON dbo.project_members(user_id);
END;
GO

IF OBJECT_ID(N'dbo.suites', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.suites (
    project_id NVARCHAR(128) NOT NULL,
    id NVARCHAR(128) NOT NULL,
    name NVARCHAR(512) NOT NULL,
    description NVARCHAR(MAX) NOT NULL DEFAULT N'',
    sort_order INT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    CONSTRAINT PK_suites PRIMARY KEY (project_id, id),
    CONSTRAINT FK_suites_project
      FOREIGN KEY (project_id) REFERENCES dbo.projects(id) ON DELETE CASCADE
  );
END;
GO

IF OBJECT_ID(N'dbo.sections', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.sections (
    project_id NVARCHAR(128) NOT NULL,
    id NVARCHAR(128) NOT NULL,
    suite_id NVARCHAR(128) NOT NULL DEFAULT N'default',
    parent_section_id NVARCHAR(128) NULL,
    name NVARCHAR(512) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    CONSTRAINT PK_sections PRIMARY KEY (project_id, id),
    CONSTRAINT FK_sections_project
      FOREIGN KEY (project_id) REFERENCES dbo.projects(id) ON DELETE CASCADE
  );
  CREATE INDEX IX_sections_project_suite ON dbo.sections(project_id, suite_id);
END;
GO

IF OBJECT_ID(N'dbo.test_cases', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.test_cases (
    project_id NVARCHAR(128) NOT NULL,
    id NVARCHAR(128) NOT NULL,
    case_number INT NOT NULL,
    suite_id NVARCHAR(128) NOT NULL DEFAULT N'default',
    section_id NVARCHAR(128) NOT NULL,
    title NVARCHAR(MAX) NOT NULL,
    preconditions NVARCHAR(MAX) NOT NULL DEFAULT N'',
    steps_json NVARCHAR(MAX) NOT NULL DEFAULT N'[]',
    priority NVARCHAR(128) NOT NULL DEFAULT N'medium',
    type NVARCHAR(128) NOT NULL DEFAULT N'functional',
    status NVARCHAR(32) NOT NULL DEFAULT N'draft',
    custom_fields_json NVARCHAR(MAX) NOT NULL DEFAULT N'{}',
    sort_order INT NOT NULL DEFAULT 0,
    created_by NVARCHAR(128) NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    CONSTRAINT PK_test_cases PRIMARY KEY (project_id, id),
    CONSTRAINT FK_test_cases_project
      FOREIGN KEY (project_id) REFERENCES dbo.projects(id) ON DELETE CASCADE,
    CONSTRAINT UQ_test_cases_project_case_number UNIQUE (project_id, case_number)
  );
  CREATE INDEX IX_test_cases_project_section ON dbo.test_cases(project_id, section_id);
END;
GO

IF OBJECT_ID(N'dbo.test_runs', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.test_runs (
    project_id NVARCHAR(128) NOT NULL,
    id NVARCHAR(128) NOT NULL,
    name NVARCHAR(512) NOT NULL,
    suite_id NVARCHAR(128) NOT NULL DEFAULT N'default',
    case_ids_json NVARCHAR(MAX) NOT NULL,
    run_test_numbers_json NVARCHAR(MAX) NOT NULL DEFAULT N'{}',
    status NVARCHAR(32) NOT NULL,
    created_by NVARCHAR(128) NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    completed_at BIGINT NULL,
    CONSTRAINT PK_test_runs PRIMARY KEY (project_id, id),
    CONSTRAINT FK_test_runs_project
      FOREIGN KEY (project_id) REFERENCES dbo.projects(id) ON DELETE CASCADE
  );
  CREATE INDEX IX_test_runs_project_updated ON dbo.test_runs(project_id, updated_at DESC);
END;
GO

IF OBJECT_ID(N'dbo.run_results', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.run_results (
    project_id NVARCHAR(128) NOT NULL,
    run_id NVARCHAR(128) NOT NULL,
    case_id NVARCHAR(128) NOT NULL,
    outcome NVARCHAR(32) NULL,
    comment NVARCHAR(MAX) NOT NULL DEFAULT N'',
    attachments_json NVARCHAR(MAX) NOT NULL DEFAULT N'[]',
    executed_by NVARCHAR(128) NULL,
    executed_at BIGINT NULL,
    updated_at BIGINT NOT NULL,
    CONSTRAINT PK_run_results PRIMARY KEY (project_id, run_id, case_id),
    CONSTRAINT FK_run_results_test_run
      FOREIGN KEY (project_id, run_id)
      REFERENCES dbo.test_runs(project_id, id) ON DELETE CASCADE
  );
END;
GO

IF OBJECT_ID(N'dbo.integration_api_keys', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.integration_api_keys (
    key_hash NVARCHAR(128) NOT NULL PRIMARY KEY,
    project_id NVARCHAR(128) NOT NULL,
    CONSTRAINT FK_integration_api_keys_project
      FOREIGN KEY (project_id) REFERENCES dbo.projects(id) ON DELETE CASCADE
  );
END;
GO
