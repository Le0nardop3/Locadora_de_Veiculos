import api from "../api/api";
import { Veiculo } from "../types/Veiculo";

class VeiculoService {
  async listar(): Promise<Veiculo[]> {
    const response = await api.get<Veiculo[]>("/vehicles");
    return response.data;
  }

  async listarDisponiveis(): Promise<Veiculo[]> {
    const response = await api.get<Veiculo[]>("/vehicles/available");
    return response.data;
  }

  async cadastrar(data: Omit<Veiculo, "id" | "disponivel">) {
    const response = await api.post("/vehicles", data);
    return response.data;
  }
}

export default new VeiculoService();
