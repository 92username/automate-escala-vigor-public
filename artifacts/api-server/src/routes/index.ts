import { Router, type IRouter } from "express";
import healthRouter from "./health";
import operationalScheduleRouter from "./operational-schedule";
import verticalScheduleRouter from "./vertical-schedule";

const router: IRouter = Router();

router.use(healthRouter);
router.use(operationalScheduleRouter);
router.use(verticalScheduleRouter);

export default router;
