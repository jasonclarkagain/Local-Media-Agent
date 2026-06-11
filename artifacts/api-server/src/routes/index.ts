import { Router, type IRouter } from "express";
import healthRouter from "./health";
import commandsRouter from "./commands";
import jobsRouter from "./jobs";
import downloadsRouter from "./downloads";
import searchRouter from "./search";
import settingsRouter from "./settings";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(commandsRouter);
router.use(jobsRouter);
router.use(downloadsRouter);
router.use(searchRouter);
router.use(settingsRouter);
router.use(statsRouter);

export default router;
