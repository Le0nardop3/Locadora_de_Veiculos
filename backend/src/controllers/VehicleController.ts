import { Request, Response } from "express";
import { VehicleService } from "../services/VehicleService";

const vehicleService = new VehicleService();

export class VehicleController {
  async list(req: Request, res: Response) {
    try {
      const vehicles = await vehicleService.list(req.path.endsWith("/available"));
      return res.json(vehicles);
    } catch {
      return res.status(500).json({ mensagem: "Erro ao consultar veículos." });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const vehicle = await vehicleService.create(req.body);
      return res.status(201).json(vehicle);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Erro ao cadastrar veículo.";
      const status = mensagem.includes("Já existe") ? 409 : 400;
      return res.status(status).json({ mensagem });
    }
  }
}
