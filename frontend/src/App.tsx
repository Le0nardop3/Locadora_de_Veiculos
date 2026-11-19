import { FormEvent, useEffect, useMemo, useState } from "react";
import AuthService from "./services/AuthService";
import VeiculoService from "./services/VeiculoService";
import LocacaoService from "./services/LocacaoService";
import { Usuario } from "./types/Usuario";
import { Veiculo } from "./types/Veiculo";
import { Locacao } from "./types/Locacao";

type AuthMode = "login" | "register";

function formatarData(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR");
}

function agoraLocalInput() {
  const data = new Date();
  data.setMinutes(data.getMinutes() - data.getTimezoneOffset());
  return data.toISOString().slice(0, 16);
}


function calcularDiariasPreview(inicio: string, fim: string) {
  if (!inicio || !fim) return 0;
  const horas = (new Date(fim).getTime() - new Date(inicio).getTime()) / (24 * 60 * 60 * 1000);
  return horas > 0 ? Math.ceil(horas) : 0;
}


function mensagemApi(error: any, fallback: string) {
  return error.response?.data?.mensagem || fallback;
}


export default function App() {
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    const saved = localStorage.getItem("usuario");
    return saved ? JSON.parse(saved) as Usuario : null;
  });
  const [mode, setMode] = useState<AuthMode>("login");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [disponiveis, setDisponiveis] = useState<Veiculo[]>([]);
  const [locacoes, setLocacoes] = useState<Locacao[]>([]);
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [placa, setPlaca] = useState("");
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [valorDiaria, setValorDiaria] = useState("150");
  const [veiculoSelecionado, setVeiculoSelecionado] = useState("");
  const [dataInicio, setDataInicio] = useState(agoraLocalInput());
  const [dataPrevista, setDataPrevista] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState(false);
  const [loading, setLoading] = useState(false);

  const locacoesAtivas = useMemo(() => locacoes.filter((locacao) => locacao.status === "ATIVA"), [locacoes]);
  const locacoesFinalizadas = useMemo(() => locacoes.filter((locacao) => locacao.status !== "ATIVA"), [locacoes]);
  const veiculoPreview = disponiveis.find((veiculo) => String(veiculo.id) === veiculoSelecionado);
  const diariasPreview = calcularDiariasPreview(dataInicio, dataPrevista);
  const valorPreview = veiculoPreview ? diariasPreview * Number(veiculoPreview.valorDiaria) : 0;

  async function carregarVeiculos() {
    try {
      const [todos, livres] = await Promise.all([VeiculoService.listar(), VeiculoService.listarDisponiveis()]);
      setVeiculos(todos);
      setDisponiveis(livres);
      if (veiculoSelecionado && !livres.some((veiculo) => String(veiculo.id) === veiculoSelecionado)) {
        setVeiculoSelecionado("");
      }
    } catch {
      setMensagem("Não foi possível carregar os veículos.");
      setErro(true);
    }
  }

  async function carregarLocacoes() {
    try {
      setLocacoes(await LocacaoService.listar());
    } catch {
      setMensagem("Não foi possível carregar o histórico de locações.");
      setErro(true);
    }
  }

  async function atualizarDados() {
    await Promise.all([carregarVeiculos(), carregarLocacoes()]);
  }

  useEffect(() => {
    if (usuario) atualizarDados();
  }, [usuario]);

  async function enviarAuth(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMensagem("");

    try {
      if (mode === "register") {
        await AuthService.register({ nome, email, senha });
        setMensagem("Cadastro realizado. Agora faça login.");
        setMode("login");
      } else {
        const resultado = await AuthService.login(email, senha);
        setUsuario(resultado.usuario);
        setMensagem("Login realizado com sucesso.");
      }
      setErro(false);
      setSenha("");
    } catch (error: any) {
      setMensagem(mensagemApi(error, "Não foi possível concluir a operação."));
      setErro(true);
    } finally {
      setLoading(false);
    }
  }

  async function cadastrarVeiculo(event: FormEvent) {
    event.preventDefault();
    setMensagem("");
    setLoading(true);

    try {
      await VeiculoService.cadastrar({ marca, modelo, placa, ano: Number(ano), valorDiaria: Number(valorDiaria) });
      setMarca("");
      setModelo("");
      setPlaca("");
      await carregarVeiculos();
      setMensagem("Veículo cadastrado com sucesso.");
      setErro(false);
    } catch (error: any) {
      setMensagem(mensagemApi(error, "Erro ao cadastrar veículo."));
      setErro(true);
    } finally {
      setLoading(false);
    }
  }

  async function criarLocacao(event: FormEvent) {
    event.preventDefault();
    setMensagem("");
    setLoading(true);
    try {
      await LocacaoService.criar({
        veiculoId: Number(veiculoSelecionado),
        dataInicio: new Date(dataInicio).toISOString(),
        dataPrevistaDevolucao: new Date(dataPrevista).toISOString()
      });
      setVeiculoSelecionado("");
      setDataInicio(agoraLocalInput());
      setDataPrevista("");
      await atualizarDados();
      setMensagem("Locação registrada com sucesso.");
      setErro(false);
    } catch (error: any) {
      setMensagem(mensagemApi(error, "Não foi possível registrar a locação."));
      setErro(true);
      await carregarVeiculos();
    } finally {
      setLoading(false);
    }
  }

  async function devolverLocacao(id: number) {
    setMensagem("");
    setLoading(true);
    try {
      await LocacaoService.devolver(id);
      await atualizarDados();
      setMensagem("Devolução registrada. O veículo foi liberado.");
      setErro(false);
    } catch (error: any) {
      setMensagem(mensagemApi(error, "Não foi possível finalizar a devolução."));
      setErro(true);
    } finally {
      setLoading(false);
    }
  }

  function sair() {
    AuthService.logout();
    setUsuario(null);
    setVeiculos([]);
    setDisponiveis([]);
    setLocacoes([]);
    setMensagem("Você saiu do sistema.");
    setErro(false);
  }

  if (!usuario) {
    return (
      <main className="auth-layout">
        <section className="auth-card">
          <div className="brand-mark">LV</div>
          <p className="eyebrow">SISTEMA DE LOCAÇÃO</p>
          <h1>{mode === "login" ? "Bem-vindo de volta" : "Crie sua conta"}</h1>
          <p className="muted">Gerencie veículos e locações em um só lugar.</p>
          <form onSubmit={enviarAuth}>
            {mode === "register" && <label>Nome<input value={nome} onChange={(e) => setNome(e.target.value)} required /></label>}
            <label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
            <label>Senha<input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} minLength={6} required /></label>
            <button disabled={loading}>{loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Cadastrar"}</button>
          </form>
          <p className="switch-mode">
            {mode === "login" ? "Ainda não possui conta?" : "Já possui conta?"}
            <button className="link-button" onClick={() => setMode(mode === "login" ? "register" : "login")}>
              {mode === "login" ? "Cadastre-se" : "Faça login"}
            </button>
          </p>
          {mensagem && <p className={erro ? "notice error" : "notice"}>{mensagem}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <div className="brand-inline"><span className="brand-mark small">LV</span><strong>Locadora</strong></div>
          <span className="muted">Painel de gerenciamento</span>
        </div>
        <div className="user-area"><span>Olá, {usuario.nome}</span><button className="button-secondary" onClick={sair}>Sair</button></div>
      </header>

      <section className="welcome">
        <p className="eyebrow">VISÃO GERAL</p>
        <h1>Frota e locações</h1>
        <p className="muted">Cadastre veículos, alugue veículos disponíveis e acompanhe suas locações.</p>
      </section>

      {mensagem && <p className={erro ? "notice error" : "notice"}>{mensagem}</p>}

      <section className="content-grid">
        <div className="panel">
          <div className="panel-heading"><div><p className="eyebrow">NOVA ENTRADA</p><h2>Cadastrar veículo</h2></div></div>
          <form onSubmit={cadastrarVeiculo}>
            <label>Marca<input value={marca} onChange={(e) => setMarca(e.target.value)} required /></label>
            <label>Modelo<input value={modelo} onChange={(e) => setModelo(e.target.value)} required /></label>
            <div className="form-row">
              <label>Placa<input value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} required /></label>
              <label>Ano<input type="number" min="1900" value={ano} onChange={(e) => setAno(e.target.value)} required /></label>
            </div>
            <label>Valor da diária (R$)<input type="number" min="0.01" step="0.01" value={valorDiaria} onChange={(e) => setValorDiaria(e.target.value)} required /></label>
            <button disabled={loading}>{loading ? "Salvando..." : "Cadastrar veículo"}</button>
          </form>
        </div>

        <div className="panel fleet-panel">
          <div className="panel-heading"><div><p className="eyebrow">CADASTRO DA FROTA</p><h2>Veículos cadastrados</h2></div><span className="count">{veiculos.length} veículos</span></div>
          {veiculos.length === 0 ? (
            <div className="empty-state"><span>🚗</span><strong>Nenhum veículo cadastrado</strong><p>Use o formulário ao lado para adicionar o primeiro veículo.</p></div>
          ) : (
            <div className="vehicle-list">
              {veiculos.map((veiculo) => (
                <article className="vehicle-item" key={veiculo.id}>
                  <div className="car-icon">🚘</div>
                  <div className="vehicle-info"><strong>{veiculo.marca} {veiculo.modelo}</strong><span>{veiculo.placa} · {veiculo.ano}</span></div>
                  <div className="vehicle-price"><strong>R$ {Number(veiculo.valorDiaria).toFixed(2)}</strong><span>por diária</span></div>
                  <span className={veiculo.disponivel ? "status available" : "status unavailable"}>{veiculo.disponivel ? "Disponível" : "Indisponível"}</span>
                </article>
              ))}
            </div>
          )}
          <button className="button-secondary refresh-button" onClick={carregarVeiculos}>Atualizar lista</button>
        </div>
      </section>

      <section className="panel rental-panel">
        <div className="panel-heading"><div><p className="eyebrow">NOVA LOCAÇÃO</p><h2>Alugar veículo</h2></div><span className="count">{disponiveis.length} disponíveis</span></div>
        <form className="rental-form" onSubmit={criarLocacao}>
          <label>Veículo disponível
            <select value={veiculoSelecionado} onChange={(e) => setVeiculoSelecionado(e.target.value)} required>
              <option value="">Selecione um veículo</option>
              {disponiveis.map((veiculo) => <option key={veiculo.id} value={veiculo.id}>{veiculo.marca} {veiculo.modelo} · {veiculo.placa} · R$ {Number(veiculo.valorDiaria).toFixed(2)}/dia</option>)}
            </select>
          </label>
          <label>Data/hora inicial<input type="datetime-local" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} required /></label>
          <label>Previsão de devolução<input type="datetime-local" value={dataPrevista} min={dataInicio} onChange={(e) => setDataPrevista(e.target.value)} required /></label>
          <div className="rental-preview"><span>Diárias previstas: <strong>{diariasPreview}</strong></span><span>Estimativa: <strong>R$ {valorPreview.toFixed(2)}</strong></span><small>O valor definitivo é calculado e validado pela API.</small></div>
          <button disabled={loading || disponiveis.length === 0}>{loading ? "Processando..." : "Registrar locação"}</button>
        </form>
        {disponiveis.length === 0 && <p className="muted">Nenhum veículo está disponível neste momento.</p>}
      </section>

      <section className="panel rental-panel">
        <div className="panel-heading"><div><p className="eyebrow">ACOMPANHAMENTO</p><h2>Minhas locações ativas</h2></div><span className="count">{locacoesAtivas.length} ativas</span></div>
        {locacoesAtivas.length === 0 ? <div className="empty-state compact"><strong>Você não possui locações ativas</strong><p>Quando registrar uma locação, ela aparecerá aqui.</p></div> : (
          <div className="rental-list">
            {locacoesAtivas.map((locacao) => (
              <article className="rental-item" key={locacao.id}>
                <div className="rental-info"><strong>{locacao.veiculo.marca} {locacao.veiculo.modelo}</strong><span>{locacao.veiculo.placa}</span><span>Início: {formatarData(locacao.dataInicio)}</span><span>Prevista: {formatarData(locacao.dataPrevistaDevolucao)}</span></div>
                <div className="rental-price"><span>{calcularDiariasPreview(locacao.dataInicio, locacao.dataPrevistaDevolucao)} diárias previstas</span><strong>R$ {Number(locacao.valorTotal).toFixed(2)}</strong></div>
                <button className="return-button" disabled={loading} onClick={() => devolverLocacao(locacao.id)}>{loading ? "Aguarde..." : "Registrar devolução"}</button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel rental-panel">
        <div className="panel-heading"><div><p className="eyebrow">REGISTROS</p><h2>Histórico de locações</h2></div><span className="count">{locacoes.length} registros</span></div>
        {locacoesFinalizadas.length === 0 ? <div className="empty-state compact"><strong>Nenhuma locação finalizada</strong><p>As locações devolvidas aparecerão aqui.</p></div> : (
          <div className="rental-list">
            {locacoesFinalizadas.map((locacao) => (
              <article className="rental-item history-item" key={locacao.id}>
                <div className="rental-info"><strong>{locacao.veiculo.marca} {locacao.veiculo.modelo}</strong><span>{locacao.veiculo.placa}</span><span>Início: {formatarData(locacao.dataInicio)}</span><span>Prevista: {formatarData(locacao.dataPrevistaDevolucao)}</span><span>Devolvida: {formatarData(locacao.dataDevolucao)}</span></div>
                <div className="rental-price"><span>{calcularDiariasPreview(locacao.dataInicio, locacao.dataDevolucao || locacao.dataPrevistaDevolucao)} diárias cobradas</span><strong>R$ {Number(locacao.valorTotal).toFixed(2)}</strong><span className="status available">Finalizada</span></div>
              </article>
            ))}
          </div>
        )}
      </section>
      <footer>Projeto acadêmico · Programação com Frameworks Web</footer>
    </main>
  );
}
