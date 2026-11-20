import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

const MILISSEGUNDOS_DIA = 24 * 60 * 60 * 1000;

function calcularDiarias(dataInicio: Date, dataFim: Date) {
  const duracao = dataFim.getTime() - dataInicio.getTime();
  if (!Number.isFinite(duracao) || duracao <= 0) {
    throw new Error("A data de devolução deve ser posterior à data inicial.");
  }
  return Math.ceil(duracao / MILISSEGUNDOS_DIA);
}


function calcularValor(valorDiaria: Prisma.Decimal, diarias: number) {
  return valorDiaria.mul(diarias).toDecimalPlaces(2);
}


function dataValida(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !Number.isNaN(Date.parse(value));
}


function conflitoConcorrencia(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2034" || error.code === "P2002");
}


export class LocacaoService {
  async criar(usuarioId: number, data: { veiculoId: number; dataInicio: string; dataPrevistaDevolucao: string }) {
    if (!Number.isInteger(Number(data?.veiculoId)) || Number(data.veiculoId) <= 0) {
      throw new Error("Selecione um veículo válido.");
    }
    if (!dataValida(data?.dataInicio) || !dataValida(data?.dataPrevistaDevolucao)) {
      throw new Error("Informe datas inicial e prevista válidas.");
    }

    const inicio = new Date(data.dataInicio);
    const prevista = new Date(data.dataPrevistaDevolucao);
    const diarias = calcularDiarias(inicio, prevista);

    try {
      return await prisma.$transaction(async (tx) => {
        const reservado = await tx.veiculo.updateMany({
          where: { id: Number(data.veiculoId), disponivel: true },
          data: { disponivel: false }
        });

        if (reservado.count !== 1) {
          const existente = await tx.veiculo.findUnique({ where: { id: Number(data.veiculoId) } });
          if (!existente) {
            throw new Error("Veículo não encontrado.");
          }
          throw new Error("Veículo não disponível para locação. Atualize a lista e escolha outro veículo.");
        }

        const veiculo = await tx.veiculo.findUnique({ where: { id: Number(data.veiculoId) } });
        if (!veiculo) {
          throw new Error("Veículo não encontrado.");
        }

        const valorTotal = calcularValor(veiculo.valorDiaria, diarias);
        return tx.locacao.create({
          data: {
            usuarioId,
            veiculoId: veiculo.id,
            dataInicio: inicio,
            dataPrevistaDevolucao: prevista,
            valorTotal,
            status: "ATIVA"
          },
          include: { veiculo: true }
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (conflitoConcorrencia(error)) {
        throw new Error("Conflito de concorrência: este veículo acabou de ser reservado. Atualize a lista e tente outro.");
      }
      throw error;
    }
  }

  async listar(usuarioId: number) {
    return prisma.locacao.findMany({
      where: { usuarioId },
      include: { veiculo: true },
      orderBy: { criadoEm: "desc" }
    });
  }

  async listarAtivas(usuarioId: number) {
    return prisma.locacao.findMany({
      where: { usuarioId, status: "ATIVA" },
      include: { veiculo: true },
      orderBy: { dataPrevistaDevolucao: "asc" }
    });
  }

  async devolver(usuarioId: number, locacaoId: number) {
    if (!Number.isInteger(locacaoId) || locacaoId <= 0) {
      throw new Error("Identificador de locação inválido.");
    }

    try {
      return await prisma.$transaction(async (tx) => {
        const locacao = await tx.locacao.findFirst({ where: { id: locacaoId, usuarioId } });
        if (!locacao) {
          throw new Error("Locação não encontrada para este usuário.");
        }
        if (locacao.status !== "ATIVA") {
          throw new Error("Esta locação já foi finalizada.");
        }

        const dataDevolucao = new Date();
        if (dataDevolucao.getTime() < locacao.dataInicio.getTime()) {
          throw new Error(`Esta locação ainda não começou. O início está previsto para ${locacao.dataInicio.toLocaleString("pt-BR")}. A devolução só poderá ser registrada a partir desse horário.`);
        }
        const diarias = calcularDiarias(locacao.dataInicio, dataDevolucao);
        const veiculo = await tx.veiculo.findUnique({ where: { id: locacao.veiculoId } });
        if (!veiculo) {
          throw new Error("Veículo associado à locação não encontrado.");
        }

        const valorFinal = calcularValor(veiculo.valorDiaria, diarias);
        const finalizada = await tx.locacao.updateMany({
          where: { id: locacaoId, usuarioId, status: "ATIVA" },
          data: { status: "FINALIZADA", dataDevolucao, valorTotal: valorFinal }
        });
        if (finalizada.count !== 1) {
          throw new Error("Esta locação já foi finalizada por outra requisição.");
        }

        await tx.veiculo.update({ where: { id: locacao.veiculoId }, data: { disponivel: true } });
        return tx.locacao.findUnique({ where: { id: locacaoId }, include: { veiculo: true } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (conflitoConcorrencia(error)) {
        throw new Error("Conflito ao finalizar locação. Atualize o histórico e tente novamente.");
      }
      throw error;
    }
  }
}
