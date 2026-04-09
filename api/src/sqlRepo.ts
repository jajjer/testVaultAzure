import { randomUUID } from "node:crypto";

import sql from "mssql";

import { allocateRunTestNumbersFromProjectCounter } from "./lib/allocateRunTestNumbers.js";
import { getPool } from "./db/pool.js";
import type { ProjectDoc, ProjectMember, UserProfile, UserRole } from "./types.js";

const DEFAULT_SUITE = "default";
const DEFAULT_SECTION = "default";

function j<T>(raw: string | null | undefined, fallback: T): T {
  if (raw == null || raw === "") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function parseRunTestNumbers(
  raw: string | null | undefined
): Record<string, number> {
  const o = j<Record<string, number>>(raw, {});
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === "number" && v >= 1) out[k] = v;
  }
  return out;
}

async function getMaxRunTestNumberInProject(
  pool: sql.ConnectionPool,
  projectId: string
): Promise<number> {
  const r = await pool
    .request()
    .input("pid", sql.NVarChar, projectId)
    .query(
      `SELECT run_test_numbers_json FROM test_runs WHERE project_id = @pid`
    );
  let maxT = 0;
  for (const row of r.recordset as { run_test_numbers_json: string }[]) {
    const m = parseRunTestNumbers(row.run_test_numbers_json);
    for (const v of Object.values(m)) {
      if (v > maxT) maxT = v;
    }
  }
  return maxT;
}

export async function getUser(uid: string): Promise<UserProfile | null> {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("uid", sql.NVarChar, uid)
    .query(
      `SELECT uid, email, display_name, role, created_at, updated_at FROM users WHERE uid = @uid`
    );
  const row = r.recordset[0] as
    | {
        uid: string;
        email: string;
        display_name: string;
        role: UserRole;
        created_at: string;
        updated_at: string;
      }
    | undefined;
  if (!row) return null;
  return {
    uid: row.uid,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export async function upsertUserOnLogin(
  uid: string,
  email: string,
  displayName: string
): Promise<UserProfile> {
  const pool = await getPool();
  const now = Date.now();
  const existing = await getUser(uid);
  if (existing) {
    await pool
      .request()
      .input("uid", sql.NVarChar, uid)
      .input("email", sql.NVarChar, email)
      .input("dn", sql.NVarChar, displayName)
      .input("ua", sql.BigInt, now)
      .query(
        `UPDATE users SET email = @email, display_name = @dn, updated_at = @ua WHERE uid = @uid`
      );
    return { ...existing, email, displayName, updatedAt: now };
  }
  await pool
    .request()
    .input("uid", sql.NVarChar, uid)
    .input("email", sql.NVarChar, email)
    .input("dn", sql.NVarChar, displayName)
    .input("role", sql.NVarChar, "tester")
    .input("ca", sql.BigInt, now)
    .input("ua", sql.BigInt, now)
    .query(
      `INSERT INTO users (uid, email, display_name, role, created_at, updated_at)
       VALUES (@uid, @email, @dn, @role, @ca, @ua)`
    );
  return {
    uid,
    email,
    displayName,
    role: "tester",
    createdAt: now,
    updatedAt: now,
  };
}

export async function isProjectMember(
  projectId: string,
  userId: string
): Promise<boolean> {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("pid", sql.NVarChar, projectId)
    .input("uid", sql.NVarChar, userId)
    .query(
      `SELECT 1 FROM project_members WHERE project_id = @pid AND user_id = @uid`
    );
  return r.recordset.length > 0;
}

export async function loadProjectDoc(
  projectId: string
): Promise<ProjectDoc | null> {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("id", sql.NVarChar, projectId)
    .query(`SELECT * FROM projects WHERE id = @id`);
  const p = r.recordset[0] as
    | {
        id: string;
        name: string;
        description: string;
        next_case_number: number;
        next_run_test_number: number;
        parameters_json: string;
        test_case_priority_options_json: string | null;
        test_case_type_options_json: string | null;
        created_by: string;
        created_at: string;
        updated_at: string;
      }
    | undefined;
  if (!p) return null;

  const mr = await pool
    .request()
    .input("pid", sql.NVarChar, projectId)
    .query(
      `SELECT user_id, email, role, added_at FROM project_members WHERE project_id = @pid`
    );
  const members: ProjectMember[] = (
    mr.recordset as {
      user_id: string;
      email: string;
      role: UserRole;
      added_at: string;
    }[]
  ).map((m) => ({
    uid: m.user_id,
    email: m.email,
    role: m.role,
    addedAt: Number(m.added_at),
  }));

  const memberIds = members.map((m) => m.uid);

  return {
    id: p.id,
    name: p.name,
    description: p.description ?? "",
    parameters: j<ProjectDoc["parameters"]>(p.parameters_json, []),
    nextCaseNumber:
      typeof p.next_case_number === "number" && p.next_case_number >= 1
        ? p.next_case_number
        : 1,
    nextRunTestNumber:
      typeof p.next_run_test_number === "number" && p.next_run_test_number >= 1
        ? p.next_run_test_number
        : 1,
    memberIds,
    members,
    testCasePriorityOptions: p.test_case_priority_options_json
      ? j<string[]>(p.test_case_priority_options_json, [])
      : undefined,
    testCaseTypeOptions: p.test_case_type_options_json
      ? j<string[]>(p.test_case_type_options_json, [])
      : undefined,
    createdBy: p.created_by,
    createdAt: Number(p.created_at),
    updatedAt: Number(p.updated_at),
  };
}

export async function listProjectsForUser(
  uid: string,
  role: UserRole
): Promise<ProjectDoc[]> {
  const pool = await getPool();
  let ids: { id: string }[];
  if (role === "admin") {
    const r = await pool.request().query(`SELECT id FROM projects ORDER BY updated_at DESC`);
    ids = r.recordset as { id: string }[];
  } else {
    const r = await pool
      .request()
      .input("uid", sql.NVarChar, uid)
      .query(
        `SELECT p.id FROM projects p
         INNER JOIN project_members m ON m.project_id = p.id AND m.user_id = @uid
         ORDER BY p.updated_at DESC`
      );
    ids = r.recordset as { id: string }[];
  }
  const out: ProjectDoc[] = [];
  for (const row of ids) {
    const doc = await loadProjectDoc(row.id);
    if (doc) out.push(doc);
  }
  return out;
}

export async function createProject(input: {
  name: string;
  description: string;
  owner: { uid: string; email: string; role: UserRole };
}): Promise<string> {
  const pool = await getPool();
  const id = randomUUID();
  const now = Date.now();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const rq = new sql.Request(transaction);
    await rq
      .input("id", sql.NVarChar, id)
      .input("name", sql.NVarChar, input.name)
      .input("desc", sql.NVarChar, input.description)
      .input("nc", sql.Int, 1)
      .input("nr", sql.Int, 1)
      .input("pj", sql.NVarChar, "[]")
      .input("cb", sql.NVarChar, input.owner.uid)
      .input("ca", sql.BigInt, now)
      .input("ua", sql.BigInt, now)
      .query(`INSERT INTO projects (id, name, description, next_case_number, next_run_test_number,
              parameters_json, created_by, created_at, updated_at)
              VALUES (@id, @name, @desc, @nc, @nr, @pj, @cb, @ca, @ua)`);

    const rq2 = new sql.Request(transaction);
    await rq2
      .input("pid", sql.NVarChar, id)
      .input("uid", sql.NVarChar, input.owner.uid)
      .input("email", sql.NVarChar, input.owner.email)
      .input("role", sql.NVarChar, input.owner.role)
      .input("aa", sql.BigInt, now)
      .query(
        `INSERT INTO project_members (project_id, user_id, email, role, added_at)
         VALUES (@pid, @uid, @email, @role, @aa)`
      );

    const rq3 = new sql.Request(transaction);
    await rq3
      .input("pid", sql.NVarChar, id)
      .input("sid", sql.NVarChar, DEFAULT_SUITE)
      .input("name", sql.NVarChar, "Default")
      .input("ca", sql.BigInt, now)
      .input("ua", sql.BigInt, now)
      .query(
        `INSERT INTO suites (project_id, id, name, description, sort_order, created_at, updated_at)
         VALUES (@pid, @sid, @name, N'', 0, @ca, @ua)`
      );

    await transaction.commit();
  } catch (e) {
    await transaction.rollback();
    throw e;
  }
  return id;
}

export async function updateProject(
  projectId: string,
  updates: {
    name: string;
    description: string;
    parameters: ProjectDoc["parameters"];
    testCasePriorityOptions?: string[];
    testCaseTypeOptions?: string[];
  }
): Promise<void> {
  const pool = await getPool();
  const now = Date.now();
  const req = pool
    .request()
    .input("id", sql.NVarChar, projectId)
    .input("name", sql.NVarChar, updates.name)
    .input("desc", sql.NVarChar, updates.description)
    .input("pj", sql.NVarChar, JSON.stringify(updates.parameters))
    .input("ua", sql.BigInt, now);

  let q = `UPDATE projects SET name = @name, description = @desc, parameters_json = @pj, updated_at = @ua`;
  if (updates.testCasePriorityOptions !== undefined) {
    req.input("tpo", sql.NVarChar, JSON.stringify(updates.testCasePriorityOptions));
    q += `, test_case_priority_options_json = @tpo`;
  }
  if (updates.testCaseTypeOptions !== undefined) {
    req.input("tto", sql.NVarChar, JSON.stringify(updates.testCaseTypeOptions));
    q += `, test_case_type_options_json = @tto`;
  }
  q += ` WHERE id = @id`;
  await req.query(q);
}

export async function ensureDefaultSuite(projectId: string): Promise<void> {
  const pool = await getPool();
  const chk = await pool
    .request()
    .input("pid", sql.NVarChar, projectId)
    .input("sid", sql.NVarChar, DEFAULT_SUITE)
    .query(
      `SELECT 1 FROM suites WHERE project_id = @pid AND id = @sid`
    );
  if (chk.recordset.length > 0) return;
  const now = Date.now();
  await pool
    .request()
    .input("pid", sql.NVarChar, projectId)
    .input("sid", sql.NVarChar, DEFAULT_SUITE)
    .input("name", sql.NVarChar, "Default")
    .input("ca", sql.BigInt, now)
    .input("ua", sql.BigInt, now)
    .query(
      `INSERT INTO suites (project_id, id, name, description, sort_order, created_at, updated_at)
       VALUES (@pid, @sid, @name, N'', 0, @ca, @ua)`
    );
}

export async function listSections(projectId: string) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("pid", sql.NVarChar, projectId)
    .input("sid", sql.NVarChar, DEFAULT_SUITE)
    .query(
      `SELECT id, project_id, suite_id, parent_section_id, name, sort_order, created_at, updated_at
       FROM sections WHERE project_id = @pid AND suite_id = @sid ORDER BY sort_order ASC`
    );
  return (r.recordset as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    projectId: String(row.project_id),
    suiteId: String(row.suite_id),
    parentSectionId:
      row.parent_section_id == null ? null : String(row.parent_section_id),
    name: String(row.name),
    order: Number(row.sort_order),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }));
}

export async function createSection(
  projectId: string,
  input: { name: string; parentSectionId: string | null; order: number }
): Promise<string> {
  await ensureDefaultSuite(projectId);
  const pool = await getPool();
  const id = randomUUID();
  const now = Date.now();
  await pool
    .request()
    .input("pid", sql.NVarChar, projectId)
    .input("id", sql.NVarChar, id)
    .input("sid", sql.NVarChar, DEFAULT_SUITE)
    .input("parent", sql.NVarChar, input.parentSectionId)
    .input("name", sql.NVarChar, input.name.trim())
    .input("ord", sql.Int, input.order)
    .input("ca", sql.BigInt, now)
    .input("ua", sql.BigInt, now)
    .query(
      `INSERT INTO sections (project_id, id, suite_id, parent_section_id, name, sort_order, created_at, updated_at)
       VALUES (@pid, @id, @sid, @parent, @name, @ord, @ca, @ua)`
    );
  return id;
}

export async function updateSectionName(
  projectId: string,
  sectionId: string,
  name: string
): Promise<void> {
  const pool = await getPool();
  const now = Date.now();
  await pool
    .request()
    .input("pid", sql.NVarChar, projectId)
    .input("id", sql.NVarChar, sectionId)
    .input("name", sql.NVarChar, name.trim())
    .input("ua", sql.BigInt, now)
    .query(
      `UPDATE sections SET name = @name, updated_at = @ua WHERE project_id = @pid AND id = @id`
    );
}

export async function deleteSectionCascade(
  projectId: string,
  sectionId: string
): Promise<void> {
  const pool = await getPool();
  const now = Date.now();
  const self = await pool
    .request()
    .input("pid", sql.NVarChar, projectId)
    .input("id", sql.NVarChar, sectionId)
    .query(
      `SELECT parent_section_id FROM sections WHERE project_id = @pid AND id = @id`
    );
  const row = self.recordset[0] as
    | { parent_section_id: string | null }
    | undefined;
  if (!row) return;
  const parentId = row.parent_section_id;

  await pool
    .request()
    .input("pid", sql.NVarChar, projectId)
    .input("sid", sql.NVarChar, DEFAULT_SUITE)
    .input("sec", sql.NVarChar, sectionId)
    .input("parent", sql.NVarChar, parentId)
    .input("ua", sql.BigInt, now)
    .query(
      `UPDATE sections SET parent_section_id = @parent, updated_at = @ua
       WHERE project_id = @pid AND suite_id = @sid AND parent_section_id = @sec`
    );

  await pool
    .request()
    .input("pid", sql.NVarChar, projectId)
    .input("sec", sql.NVarChar, sectionId)
    .input("def", sql.NVarChar, DEFAULT_SECTION)
    .input("ua", sql.BigInt, now)
    .query(
      `UPDATE test_cases SET section_id = @def, updated_at = @ua
       WHERE project_id = @pid AND section_id = @sec`
    );

  await pool
    .request()
    .input("pid", sql.NVarChar, projectId)
    .input("id", sql.NVarChar, sectionId)
    .query(`DELETE FROM sections WHERE project_id = @pid AND id = @id`);
}

export async function listTestCases(projectId: string) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("pid", sql.NVarChar, projectId)
    .query(
      `SELECT * FROM test_cases WHERE project_id = @pid ORDER BY sort_order ASC`
    );
  return (r.recordset as Record<string, unknown>[]).map(normalizeTestCaseRow);
}

function normalizeTestCaseRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    caseNumber: Number(row.case_number),
    suiteId: String(row.suite_id ?? DEFAULT_SUITE),
    sectionId: String(row.section_id),
    title: String(row.title ?? ""),
    preconditions: String(row.preconditions ?? ""),
    steps: j(row.steps_json as string, []),
    priority: String(row.priority ?? "medium"),
    type: String(row.type ?? "functional"),
    status: String(row.status ?? "draft"),
    customFields: j(row.custom_fields_json as string, {}),
    order: Number(row.sort_order),
    createdBy: String(row.created_by),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export async function createTestCase(
  projectId: string,
  input: {
    title: string;
    preconditions: string;
    steps: unknown;
    priority: string;
    type: string;
    status: string;
    customFields: Record<string, unknown>;
    sectionId: string;
    createdBy: string;
    order?: number;
  }
): Promise<string> {
  const pool = await getPool();
  const id = randomUUID();
  const now = Date.now();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const rq = new sql.Request(transaction);
    const pSnap = await rq
      .input("pid", sql.NVarChar, projectId)
      .query(`SELECT next_case_number FROM projects WITH (UPDLOCK) WHERE id = @pid`);
    const prow = pSnap.recordset[0] as { next_case_number: number } | undefined;
    if (!prow) throw new Error("Project not found");
    const nextNum =
      typeof prow.next_case_number === "number" && prow.next_case_number >= 1
        ? prow.next_case_number
        : 1;

    const orderR = await new sql.Request(transaction)
      .input("pid", sql.NVarChar, projectId)
      .query(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_ord FROM test_cases WHERE project_id = @pid`
      );
    const nextOrder =
      typeof input.order === "number" && input.order >= 0
        ? input.order
        : Number((orderR.recordset[0] as { next_ord: number }).next_ord);

    await new sql.Request(transaction)
      .input("pid", sql.NVarChar, projectId)
      .input("id", sql.NVarChar, id)
      .input("cn", sql.Int, nextNum)
      .input("sid", sql.NVarChar, DEFAULT_SUITE)
      .input("sec", sql.NVarChar, input.sectionId)
      .input("title", sql.NVarChar, input.title)
      .input("pre", sql.NVarChar, input.preconditions)
      .input("steps", sql.NVarChar, JSON.stringify(input.steps ?? []))
      .input("pri", sql.NVarChar, input.priority)
      .input("typ", sql.NVarChar, input.type)
      .input("st", sql.NVarChar, input.status)
      .input("cf", sql.NVarChar, JSON.stringify(input.customFields ?? {}))
      .input("ord", sql.Int, nextOrder)
      .input("cb", sql.NVarChar, input.createdBy)
      .input("ca", sql.BigInt, now)
      .input("ua", sql.BigInt, now)
      .query(`INSERT INTO test_cases (project_id, id, case_number, suite_id, section_id, title, preconditions,
              steps_json, priority, type, status, custom_fields_json, sort_order, created_by, created_at, updated_at)
              VALUES (@pid, @id, @cn, @sid, @sec, @title, @pre, @steps, @pri, @typ, @st, @cf, @ord, @cb, @ca, @ua)`);

    await new sql.Request(transaction)
      .input("pid", sql.NVarChar, projectId)
      .input("nn", sql.Int, nextNum + 1)
      .input("ua", sql.BigInt, now)
      .query(
        `UPDATE projects SET next_case_number = @nn, updated_at = @ua WHERE id = @pid`
      );

    await transaction.commit();
  } catch (e) {
    await transaction.rollback();
    throw e;
  }
  return id;
}

export async function updateTestCase(
  projectId: string,
  caseId: string,
  input: {
    title: string;
    preconditions: string;
    steps: unknown;
    priority: string;
    type: string;
    status: string;
    customFields: Record<string, unknown>;
    sectionId: string;
    order: number;
  }
): Promise<void> {
  const pool = await getPool();
  const now = Date.now();
  await pool
    .request()
    .input("pid", sql.NVarChar, projectId)
    .input("id", sql.NVarChar, caseId)
    .input("title", sql.NVarChar, input.title)
    .input("pre", sql.NVarChar, input.preconditions)
    .input("steps", sql.NVarChar, JSON.stringify(input.steps ?? []))
    .input("pri", sql.NVarChar, input.priority)
    .input("typ", sql.NVarChar, input.type)
    .input("st", sql.NVarChar, input.status)
    .input("cf", sql.NVarChar, JSON.stringify(input.customFields ?? {}))
    .input("sec", sql.NVarChar, input.sectionId)
    .input("ord", sql.Int, input.order)
    .input("ua", sql.BigInt, now)
    .query(
      `UPDATE test_cases SET title=@title, preconditions=@pre, steps_json=@steps, priority=@pri, type=@typ,
       status=@st, custom_fields_json=@cf, section_id=@sec, sort_order=@ord, updated_at=@ua
       WHERE project_id=@pid AND id=@id`
    );
}

export async function deleteTestCase(
  projectId: string,
  caseId: string
): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input("pid", sql.NVarChar, projectId)
    .input("id", sql.NVarChar, caseId)
    .query(`DELETE FROM test_cases WHERE project_id=@pid AND id=@id`);
}

export async function loadRun(projectId: string, runId: string) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("pid", sql.NVarChar, projectId)
    .input("id", sql.NVarChar, runId)
    .query(`SELECT * FROM test_runs WHERE project_id=@pid AND id=@id`);
  const row = r.recordset[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  const caseIds = j<string[]>(row.case_ids_json as string, []);
  const runTestNumbers = parseRunTestNumbers(row.run_test_numbers_json as string);
  for (let i = 0; i < caseIds.length; i++) {
    const cid = caseIds[i];
    if (runTestNumbers[cid] == null) runTestNumbers[cid] = i + 1;
  }
  return {
    caseIds,
    runTestNumbers,
    name: String(row.name ?? ""),
    status: String(row.status ?? "active"),
  };
}

export async function createTestRun(
  projectId: string,
  input: { name: string; caseIds: string[]; createdBy: string }
): Promise<string> {
  const pool = await getPool();
  const runId = randomUUID();
  const now = Date.now();
  const maxAcross = await getMaxRunTestNumberInProject(pool, projectId);
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const pSnap = await new sql.Request(transaction)
      .input("pid", sql.NVarChar, projectId)
      .query(
        `SELECT next_run_test_number FROM projects WITH (UPDLOCK) WHERE id = @pid`
      );
    const prow = pSnap.recordset[0] as
      | { next_run_test_number: number }
      | undefined;
    if (!prow) throw new Error("Project not found");
    let nextT = Math.max(
      typeof prow.next_run_test_number === "number" &&
        prow.next_run_test_number >= 1
        ? prow.next_run_test_number
        : 1,
      maxAcross + 1
    );
    const runTestNumbers: Record<string, number> = {};
    for (const cid of input.caseIds) {
      runTestNumbers[cid] = nextT;
      nextT += 1;
    }

    await new sql.Request(transaction)
      .input("pid", sql.NVarChar, projectId)
      .input("id", sql.NVarChar, runId)
      .input("name", sql.NVarChar, input.name)
      .input("sid", sql.NVarChar, DEFAULT_SUITE)
      .input("cids", sql.NVarChar, JSON.stringify(input.caseIds))
      .input("rtn", sql.NVarChar, JSON.stringify(runTestNumbers))
      .input("st", sql.NVarChar, "active")
      .input("cb", sql.NVarChar, input.createdBy)
      .input("ca", sql.BigInt, now)
      .input("ua", sql.BigInt, now)
      .input("comp", sql.BigInt, null)
      .query(
        `INSERT INTO test_runs (project_id, id, name, suite_id, case_ids_json, run_test_numbers_json,
         status, created_by, created_at, updated_at, completed_at)
         VALUES (@pid, @id, @name, @sid, @cids, @rtn, @st, @cb, @ca, @ua, @comp)`
      );

    await new sql.Request(transaction)
      .input("pid", sql.NVarChar, projectId)
      .input("nt", sql.Int, nextT)
      .input("ua", sql.BigInt, now)
      .query(
        `UPDATE projects SET next_run_test_number = @nt, updated_at = @ua WHERE id = @pid`
      );

    await transaction.commit();
  } catch (e) {
    await transaction.rollback();
    throw e;
  }
  return runId;
}

export async function listRuns(projectId: string) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("pid", sql.NVarChar, projectId)
    .query(
      `SELECT * FROM test_runs WHERE project_id=@pid ORDER BY updated_at DESC`
    );
  return (r.recordset as Record<string, unknown>[]).map((row) => {
    const caseIds = j<string[]>(row.case_ids_json as string, []);
    const runTestNumbers = parseRunTestNumbers(row.run_test_numbers_json as string);
    for (let i = 0; i < caseIds.length; i++) {
      const cid = caseIds[i];
      if (runTestNumbers[cid] == null) runTestNumbers[cid] = i + 1;
    }
    const completedAt = row.completed_at;
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      name: String(row.name ?? ""),
      suiteId: String(row.suite_id ?? DEFAULT_SUITE),
      caseIds,
      runTestNumbers,
      status: String(row.status ?? "active"),
      createdBy: String(row.created_by),
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
      completedAt:
        completedAt == null ? null : Number(completedAt),
    };
  });
}

export async function deleteRun(projectId: string, runId: string): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input("pid", sql.NVarChar, projectId)
    .input("rid", sql.NVarChar, runId)
    .query(`DELETE FROM run_results WHERE project_id=@pid AND run_id=@rid`);
  await pool
    .request()
    .input("pid", sql.NVarChar, projectId)
    .input("rid", sql.NVarChar, runId)
    .query(`DELETE FROM test_runs WHERE project_id=@pid AND id=@rid`);
}

export async function updateRun(
  projectId: string,
  runId: string,
  input: {
    name: string;
    caseIds: string[];
    status: string;
  }
): Promise<void> {
  const pool = await getPool();
  const now = Date.now();
  const runRef = await pool
    .request()
    .input("pid", sql.NVarChar, projectId)
    .input("rid", sql.NVarChar, runId)
    .query(`SELECT case_ids_json, run_test_numbers_json, completed_at FROM test_runs WHERE project_id=@pid AND id=@rid`);
  const prevRow = runRef.recordset[0] as
    | {
        case_ids_json: string;
        run_test_numbers_json: string;
        completed_at: unknown;
      }
    | undefined;
  if (!prevRow) throw new Error("Test run not found");

  const prevIds = j<string[]>(prevRow.case_ids_json, []);
  const newIds = input.caseIds;
  const removed = prevIds.filter((id) => !newIds.includes(id));

  for (const caseId of removed) {
    await pool
      .request()
      .input("pid", sql.NVarChar, projectId)
      .input("rid", sql.NVarChar, runId)
      .input("cid", sql.NVarChar, caseId)
      .query(
        `DELETE FROM run_results WHERE project_id=@pid AND run_id=@rid AND case_id=@cid`
      );
  }

  const prevMap = parseRunTestNumbers(prevRow.run_test_numbers_json);
  let completedAt: number | null =
    prevRow.completed_at == null
      ? null
      : Number(prevRow.completed_at);
  if (input.status === "completed") {
    if (completedAt == null) completedAt = now;
  } else {
    completedAt = null;
  }

  const maxAcross = await getMaxRunTestNumberInProject(pool, projectId);
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const pSnap = await new sql.Request(transaction)
      .input("pid", sql.NVarChar, projectId)
      .query(
        `SELECT next_run_test_number FROM projects WITH (UPDLOCK) WHERE id = @pid`
      );
    const pdata = pSnap.recordset[0] as
      | { next_run_test_number: number }
      | undefined;
    if (!pdata) throw new Error("Project not found");
    const projectNextT = Math.max(
      typeof pdata.next_run_test_number === "number" &&
        pdata.next_run_test_number >= 1
        ? pdata.next_run_test_number
        : 1,
      maxAcross + 1
    );

    const { runTestNumbers, nextProjectRunTestNumber } =
      allocateRunTestNumbersFromProjectCounter(
        newIds,
        prevIds,
        prevMap,
        projectNextT
      );

    await new sql.Request(transaction)
      .input("pid", sql.NVarChar, projectId)
      .input("rid", sql.NVarChar, runId)
      .input("name", sql.NVarChar, input.name.trim())
      .input("cids", sql.NVarChar, JSON.stringify(newIds))
      .input("rtn", sql.NVarChar, JSON.stringify(runTestNumbers))
      .input("st", sql.NVarChar, input.status)
      .input("ua", sql.BigInt, now)
      .input("comp", sql.BigInt, completedAt)
      .query(
        `UPDATE test_runs SET name=@name, case_ids_json=@cids, run_test_numbers_json=@rtn,
         status=@st, updated_at=@ua, completed_at=@comp WHERE project_id=@pid AND id=@rid`
      );

    await new sql.Request(transaction)
      .input("pid", sql.NVarChar, projectId)
      .input("nt", sql.Int, nextProjectRunTestNumber)
      .input("ua", sql.BigInt, now)
      .query(
        `UPDATE projects SET next_run_test_number=@nt, updated_at=@ua WHERE id=@pid`
      );

    await transaction.commit();
  } catch (e) {
    await transaction.rollback();
    throw e;
  }
}

export async function listResults(projectId: string, runId: string) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("pid", sql.NVarChar, projectId)
    .input("rid", sql.NVarChar, runId)
    .query(
      `SELECT case_id, outcome, comment, attachments_json, executed_by, executed_at, updated_at
       FROM run_results WHERE project_id=@pid AND run_id=@rid`
    );
  const byCase: Record<string, Record<string, unknown>> = {};
  for (const row of r.recordset as Record<string, unknown>[]) {
    const caseId = String(row.case_id);
    byCase[caseId] = {
      caseId,
      runId,
      projectId,
      outcome: row.outcome ?? null,
      comment: String(row.comment ?? ""),
      attachments: j(row.attachments_json as string, []),
      executedBy: row.executed_by == null ? null : String(row.executed_by),
      executedAt:
        row.executed_at == null ? null : Number(row.executed_at),
      updatedAt: Number(row.updated_at),
    };
  }
  return byCase;
}

export async function setRunResult(
  projectId: string,
  runId: string,
  caseId: string,
  input: {
    outcome: string | null;
    executedByUid: string | null;
  }
): Promise<void> {
  const pool = await getPool();
  const now = Date.now();
  const existing = await pool
    .request()
    .input("pid", sql.NVarChar, projectId)
    .input("rid", sql.NVarChar, runId)
    .input("cid", sql.NVarChar, caseId)
    .query(
      `SELECT comment, attachments_json FROM run_results WHERE project_id=@pid AND run_id=@rid AND case_id=@cid`
    );
  const prev = existing.recordset[0] as
    | { comment: string; attachments_json: string }
    | undefined;
  const comment = prev?.comment ?? "";
  const attachments = j(prev?.attachments_json, []);

  if (!prev) {
    await pool
      .request()
      .input("pid", sql.NVarChar, projectId)
      .input("rid", sql.NVarChar, runId)
      .input("cid", sql.NVarChar, caseId)
      .input("oc", sql.NVarChar, input.outcome)
      .input("cm", sql.NVarChar, comment)
      .input("att", sql.NVarChar, JSON.stringify(attachments))
      .input("ex", sql.NVarChar, input.outcome !== null ? input.executedByUid : null)
      .input("ea", sql.BigInt, input.outcome !== null ? now : null)
      .input("ua", sql.BigInt, now)
      .query(
        `INSERT INTO run_results (project_id, run_id, case_id, outcome, comment, attachments_json,
         executed_by, executed_at, updated_at)
         VALUES (@pid, @rid, @cid, @oc, @cm, @att, @ex, @ea, @ua)`
      );
  } else {
    await pool
      .request()
      .input("pid", sql.NVarChar, projectId)
      .input("rid", sql.NVarChar, runId)
      .input("cid", sql.NVarChar, caseId)
      .input("oc", sql.NVarChar, input.outcome)
      .input("cm", sql.NVarChar, comment)
      .input("att", sql.NVarChar, JSON.stringify(attachments))
      .input("ex", sql.NVarChar, input.outcome !== null ? input.executedByUid : null)
      .input("ea", sql.BigInt, input.outcome !== null ? now : null)
      .input("ua", sql.BigInt, now)
      .query(
        `UPDATE run_results SET outcome=@oc, comment=@cm, attachments_json=@att,
         executed_by=@ex, executed_at=@ea, updated_at=@ua
         WHERE project_id=@pid AND run_id=@rid AND case_id=@cid`
      );
  }
}

export async function mergeRunResultAttachments(
  projectId: string,
  runId: string,
  caseId: string,
  attachments: unknown[]
): Promise<void> {
  const pool = await getPool();
  const now = Date.now();
  await pool
    .request()
    .input("pid", sql.NVarChar, projectId)
    .input("rid", sql.NVarChar, runId)
    .input("cid", sql.NVarChar, caseId)
    .input("att", sql.NVarChar, JSON.stringify(attachments))
    .input("ua", sql.BigInt, now)
    .query(
      `UPDATE run_results SET attachments_json=@att, updated_at=@ua
       WHERE project_id=@pid AND run_id=@rid AND case_id=@cid`
    );
}

/** Automation API: merge comment like Firestore set(merge). */
export async function upsertRunResultFromIntegration(
  projectId: string,
  runId: string,
  caseId: string,
  input: { outcome: string; comment?: string }
): Promise<void> {
  const pool = await getPool();
  const now = Date.now();
  const existing = await pool
    .request()
    .input("pid", sql.NVarChar, projectId)
    .input("rid", sql.NVarChar, runId)
    .input("cid", sql.NVarChar, caseId)
    .query(
      `SELECT comment, attachments_json FROM run_results WHERE project_id=@pid AND run_id=@rid AND case_id=@cid`
    );
  const prev = existing.recordset[0] as
    | { comment: string; attachments_json: string }
    | undefined;
  const attachments = j(prev?.attachments_json, []);
  const comment =
    input.comment !== undefined ? input.comment : String(prev?.comment ?? "");

  if (!prev) {
    await pool
      .request()
      .input("pid", sql.NVarChar, projectId)
      .input("rid", sql.NVarChar, runId)
      .input("cid", sql.NVarChar, caseId)
      .input("oc", sql.NVarChar, input.outcome)
      .input("cm", sql.NVarChar, comment)
      .input("att", sql.NVarChar, JSON.stringify(attachments))
      .input("ex", sql.NVarChar, "integration")
      .input("ea", sql.BigInt, now)
      .input("ua", sql.BigInt, now)
      .query(
        `INSERT INTO run_results (project_id, run_id, case_id, outcome, comment, attachments_json,
         executed_by, executed_at, updated_at)
         VALUES (@pid, @rid, @cid, @oc, @cm, @att, @ex, @ea, @ua)`
      );
  } else {
    await pool
      .request()
      .input("pid", sql.NVarChar, projectId)
      .input("rid", sql.NVarChar, runId)
      .input("cid", sql.NVarChar, caseId)
      .input("oc", sql.NVarChar, input.outcome)
      .input("cm", sql.NVarChar, comment)
      .input("att", sql.NVarChar, JSON.stringify(attachments))
      .input("ex", sql.NVarChar, "integration")
      .input("ea", sql.BigInt, now)
      .input("ua", sql.BigInt, now)
      .query(
        `UPDATE run_results SET outcome=@oc, comment=@cm, attachments_json=@att,
         executed_by=@ex, executed_at=@ea, updated_at=@ua
         WHERE project_id=@pid AND run_id=@rid AND case_id=@cid`
      );
  }
}

export async function getApiKeyProject(keyHash: string): Promise<string | null> {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("h", sql.NVarChar, keyHash)
    .query(`SELECT project_id FROM integration_api_keys WHERE key_hash=@h`);
  const row = r.recordset[0] as { project_id: string } | undefined;
  return row?.project_id ?? null;
}

export async function resolveCaseNumbersToIds(
  projectId: string,
  caseNumbers: number[]
): Promise<string[]> {
  const unique = new Set(caseNumbers);
  if (unique.size !== caseNumbers.length) {
    throw new Error("caseNumbers must not contain duplicates");
  }
  if (caseNumbers.length === 0) return [];
  const pool = await getPool();
  const byNumber = new Map<number, string>();
  const CHUNK = 50;
  for (let i = 0; i < caseNumbers.length; i += CHUNK) {
    const chunk = caseNumbers.slice(i, i + CHUNK);
    const req = pool.request().input("pid", sql.NVarChar, projectId);
    chunk.forEach((n, idx) => {
      req.input(`n${idx}`, sql.Int, n);
    });
    const placeholders = chunk.map((_, idx) => `@n${idx}`).join(",");
    const r = await req.query(
      `SELECT id, case_number FROM test_cases WHERE project_id=@pid AND case_number IN (${placeholders})`
    );
    for (const row of r.recordset as { id: string; case_number: number }[]) {
      byNumber.set(row.case_number, row.id);
    }
  }
  return caseNumbers.map((n) => {
    const id = byNumber.get(n);
    if (!id) {
      throw new Error(`Test case C${n} not found in this project`);
    }
    return id;
  });
}

