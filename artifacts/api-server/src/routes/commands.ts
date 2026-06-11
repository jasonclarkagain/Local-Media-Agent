import { Router, type IRouter } from "express";
import { db, jobsTable } from "@workspace/db";
import { SubmitCommandBody } from "@workspace/api-zod";
import { runOrchestration } from "../lib/orchestrator";

const router: IRouter = Router();

router.post("/commands", async (req, res): Promise<void> => {
  const parsed = SubmitCommandBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [job] = await db
    .insert(jobsTable)
    .values({ command: parsed.data.text })
    .returning();

  res.status(202).json(job);

  setImmediate(() => {
    runOrchestration(job.id, parsed.data.text).catch(() => {});
  });
});

export default router;
