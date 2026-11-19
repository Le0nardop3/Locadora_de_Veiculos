import { Request, Response } from "express";
import { AuthService } from "../services/AuthService";

const authService = new AuthService();

export class AuthController {
  async register(req: Request, res: Response) {
    try {
      const { nome, email, senha } = req.body;
      const usuario = await authService.register(nome, email, senha);
      return res.status(201).json(usuario);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Erro ao cadastrar usuário.";
      const status = mensagem.includes("já está cadastrado") ? 409 : 400;
      return res.status(status).json({ mensagem });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const { email, senha } = req.body;

      if (!email || !senha) {
        return res.status(400).json({ mensagem: "E-mail e senha são obrigatórios." });
      }

      const resultado = await authService.login(email, senha);
      return res.json(resultado);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Erro ao realizar login.";
      const status = mensagem.includes("incorretos") ? 401 : 400;
      return res.status(status).json({ mensagem });
    }
  }
}
