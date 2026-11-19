import api from "../api/api";
import { Usuario } from "../types/Usuario";

interface AuthResponse {
  token: string;
  usuario: Usuario;
}

class AuthService {
  async register(data: { nome: string; email: string; senha: string }) {
    const response = await api.post("/auth/register", data);
    return response.data;
  }

  async login(email: string, senha: string): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>("/auth/login", { email, senha });
    localStorage.setItem("token", response.data.token);
    localStorage.setItem("usuario", JSON.stringify(response.data.usuario));
    return response.data;
  }

  logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
  }
}

export default new AuthService();
