import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

interface VehicleInput {
  marca: string;
  modelo: string;
  placa: string;
  ano: number;
  valorDiaria: number;
}

export class VehicleService {
  async list(availableOnly = false) {
    return prisma.veiculo.findMany({
      where: availableOnly ? { disponivel: true } : undefined,
      orderBy: { id: "desc" }
    });
  }

  async create(data: VehicleInput) {
    const { marca, modelo, placa, ano, valorDiaria } = data;

    if (!marca?.trim() || !modelo?.trim() || !placa?.trim()) {
      throw new Error("Marca, modelo e placa são obrigatórios.");
    }

    if (!Number.isInteger(Number(ano)) || Number(ano) < 1900) {
      throw new Error("Ano do veículo inválido.");
    }

    if (!Number.isFinite(Number(valorDiaria)) || Number(valorDiaria) <= 0) {
      throw new Error("O valor da diária deve ser positivo.");
    }

    try {
      return await prisma.veiculo.create({
        data: {
          marca: marca.trim(),
          modelo: modelo.trim(),
          placa: placa.trim().toUpperCase(),
          ano: Number(ano),
          valorDiaria: new Prisma.Decimal(valorDiaria)
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new Error("Já existe um veículo cadastrado com esta placa.");
      }
      throw error;
    }
  }
}
