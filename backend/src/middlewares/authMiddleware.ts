import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

interface TokenPayload {
  usuarioId: number;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authorization = req.headers.authorization;
  const secret = process.env.JWT_SECRET;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({ mensagem: "Token não informado." });
  }

  if (!secret) {
    return res.status(500).json({ mensagem: "Configuração de autenticação ausente." });
  }

  const token = authorization.slice(7);

  try {
    const payload = jwt.verify(token, secret) as TokenPayload;
    req.usuarioId = payload.usuarioId;
    next();
  } catch {
    return res.status(401).json({ mensagem: "Token inválido ou expirado." });
  }
}
