import { Router } from "express";
import { LocacaoController } from "../controllers/LocacaoController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();
const controller = new LocacaoController();

router.use(authMiddleware);
router.post("/", (req, res) => controller.criar(req, res));
router.get("/", (req, res) => controller.listar(req, res));
router.get("/ativas", (req, res) => controller.listarAtivas(req, res));
router.patch("/:id/devolver", (req, res) => controller.devolver(req, res));

export default router;
