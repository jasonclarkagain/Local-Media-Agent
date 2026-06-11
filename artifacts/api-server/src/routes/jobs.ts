import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, jobsTable, jobLogsTable } from "@workspace/db";
import {
  ListJobsQueryParams,
  GetJobParams,
  CancelJobParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/jobs", async (req, res): Promise<void> => {
  const query = ListJobsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { status, limit = 50 } = query.data;

  let q = db
    .select()
    .from(jobsTable)
    .orderBy(desc(jobsTable.createdAt))
    .limit(limit);

  if (status) {
    q = db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.status, status))
      .orderBy(desc(jobsTable.createdAt))
      .limit(limit);
  }

  const jobs = await q;
  res.json(jobs);
});

router.get("/jobs/:id", async (req, res): Promise<void> => {
  const params = GetJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [job] = await db
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.id, params.data.id));

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const logs = await db
    .select()
    .from(jobLogsTable)
    .where(eq(jobLogsTable.jobId, job.id))
    .orderBy(jobLogsTable.createdAt);

  res.json({ ...job, logs });
});

router.delete("/jobs/:id", async (req, res): Promise<void> => {
  const params = CancelJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  if (existing.status === "completed" || existing.status === "failed") {
    res.status(400).json({ error: `Cannot cancel job with status: ${existing.status}` });
    return;
  }

  const [updated] = await db
    .update(jobsTable)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(jobsTable.id, params.data.id))
    .returning();

  res.json(updated);
});

export default router;
