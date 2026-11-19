import api from "../api/api";
import { Locacao } from "../types/Locacao";

class LocacaoService {
  async listar(): Promise<Locacao[]> {
    const response = await api.get<Locacao[]>("/locacoes");
    return response.data;
  }

  async listarAtivas(): Promise<Locacao[]> {
    const response = await api.get<Locacao[]>("/locacoes/ativas");
    return response.data;
  }

  async criar(data: { veiculoId: number; dataInicio: string; dataPrevistaDevolucao: string }): Promise<Locacao> {
    const response = await api.post<Locacao>("/locacoes", data);
    return response.data;
  }

  async devolver(id: number): Promise<Locacao> {
    const response = await api.patch<Locacao>(`/locacoes/${id}/devolver`);
    return response.data;
  }
}

export default new LocacaoService();
