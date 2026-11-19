import { Veiculo } from "./Veiculo";

export interface Locacao {
  id: number;
  usuarioId: number;
  veiculoId: number;
  dataInicio: string;
  dataPrevistaDevolucao: string;
  dataDevolucao: string | null;
  valorTotal: string | number;
  status: "ATIVA" | "FINALIZADA" | string;
  criadoEm: string;
  veiculo: Veiculo;
}
