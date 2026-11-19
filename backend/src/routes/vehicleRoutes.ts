import { Router } from "express";
import { VehicleController } from "../controllers/VehicleController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();
const controller = new VehicleController();

router.use(authMiddleware);
router.get("/", (req, res) => controller.list(req, res));
router.get("/available", (req, res) => controller.list(req, res));
router.post("/", (req, res) => controller.create(req, res));

export default router;
