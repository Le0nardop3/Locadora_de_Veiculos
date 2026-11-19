import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma";

export class AuthService {
  async register(nome: string, email: string, senha: string) {
    if (!nome?.trim() || !email?.trim() || !senha) {
      throw new Error("Nome, e-mail e senha são obrigatórios.");
    }

    if (senha.length < 6) {
      throw new Error("A senha deve possuir pelo menos 6 caracteres.");
    }

    const emailNormalizado = email.trim().toLowerCase();
    const existente = await prisma.usuario.findUnique({ where: { email: emailNormalizado } });

    if (existente) {
      throw new Error("Este e-mail já está cadastrado.");
    }

    const hash = await bcrypt.hash(senha, 10);
    const usuario = await prisma.usuario.create({
      data: { nome: nome.trim(), email: emailNormalizado, senha: hash },
      select: { id: true, nome: true, email: true, criadoEm: true }
    });

    return usuario;
  }

  async login(email: string, senha: string) {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error("Configuração JWT_SECRET ausente.");
    }

    const usuario = await prisma.usuario.findUnique({
      where: { email: email.trim().toLowerCase() }
    });

    if (!usuario || !(await bcrypt.compare(senha, usuario.senha))) {
      throw new Error("E-mail ou senha incorretos.");
    }

    const token = jwt.sign({ usuarioId: usuario.id }, secret, { expiresIn: "8h" });

    return {
      token,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email }
    };
  }
}
