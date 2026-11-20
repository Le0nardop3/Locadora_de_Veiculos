import { Request, Response } from "express";
import { LocacaoService } from "../services/LocacaoService";

const locacaoService = new LocacaoService();

function statusErro(mensagem: string) {
  if (mensagem.includes("não disponível") || mensagem.includes("Conflito") || mensagem.includes("acabou de ser reservado") || mensagem.includes("já foi finalizada")) return 409;
  if (mensagem.includes("não encontrada") || mensagem.includes("não encontrado")) return 404;
  if (mensagem.includes("ainda não começou") || mensagem.includes("Selecione um veículo válido") || mensagem.includes("Informe datas") || mensagem.includes("A data de devolução") || mensagem.includes("Identificador de locação inválido")) return 400;
  return 500;
}

export class LocacaoController {
  async criar(req: Request, res: Response) {
    try {
      const usuarioId = req.usuarioId;
      if (!usuarioId) return res.status(401).json({ mensagem: "Usuário não autenticado." });
      const locacao = await locacaoService.criar(usuarioId, req.body);
      return res.status(201).json(locacao);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Erro ao registrar locação.";
      return res.status(statusErro(mensagem)).json({ mensagem });
    }
  }


  async listar(req: Request, res: Response) {
    try {
      if (!req.usuarioId) return res.status(401).json({ mensagem: "Usuário não autenticado." });
      return res.json(await locacaoService.listar(req.usuarioId));
    } catch {
      return res.status(500).json({ mensagem: "Erro ao consultar histórico de locações." });
    }
  }


  async listarAtivas(req: Request, res: Response) {
    try {
      if (!req.usuarioId) return res.status(401).json({ mensagem: "Usuário não autenticado." });
      return res.json(await locacaoService.listarAtivas(req.usuarioId));
    } catch {
      return res.status(500).json({ mensagem: "Erro ao consultar locações ativas." });
    }
  }


  async devolver(req: Request, res: Response) {
    try {
      if (!req.usuarioId) return res.status(401).json({ mensagem: "Usuário não autenticado." });
      const id = Number(req.params.id);
      const locacao = await locacaoService.devolver(req.usuarioId, id);
      return res.json(locacao);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Erro ao finalizar devolução.";
      return res.status(statusErro(mensagem)).json({ mensagem });
    }
  }
}
