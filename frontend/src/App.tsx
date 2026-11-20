import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import AuthService from "./services/AuthService";
import VeiculoService from "./services/VeiculoService";
import LocacaoService from "./services/LocacaoService";
import { Usuario } from "./types/Usuario";
import { Veiculo } from "./types/Veiculo";
import { Locacao } from "./types/Locacao";

type AuthMode = "login" | "register";
type Section = "overview" | "fleet" | "rentals" | "history";
type Feedback = { message: string; kind: "success" | "error" | "info" };

const money = (value: string | number) =>
  Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function formatarData(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("pt-BR");
}

function agoraLocalInput() {
  const data = new Date();
  data.setMinutes(data.getMinutes() - data.getTimezoneOffset());
  return data.toISOString().slice(0, 16);
}

function calcularDiarias(inicio: string, fim: string) {
  if (!inicio || !fim) return 0;
  const duration = new Date(fim).getTime() - new Date(inicio).getTime();
  return duration > 0 ? Math.ceil(duration / (24 * 60 * 60 * 1000)) : 0;
}

function mensagemApi(error: unknown, fallback: string) {
  const err = error as { response?: { data?: { mensagem?: string; message?: string } }; message?: string };
  return err.response?.data?.mensagem || err.response?.data?.message || (err.message === "Network Error" ? "Não foi possível conectar à API. Verifique se o backend está em execução." : fallback);
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U";
}

export default function App() {
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    try {
      const saved = localStorage.getItem("usuario");
      return saved ? JSON.parse(saved) as Usuario : null;
    } catch {
      localStorage.removeItem("usuario");
      localStorage.removeItem("token");
      return null;
    }
  });
  const [mode, setMode] = useState<AuthMode>("login");
  const [section, setSection] = useState<Section>("overview");
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
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [vehicleLoading, setVehicleLoading] = useState(false);
  const [rentalLoading, setRentalLoading] = useState(false);
  const [returningId, setReturningId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedOnce = useRef(false);

  const locacoesAtivas = useMemo(() => locacoes.filter((locacao) => locacao.status === "ATIVA"), [locacoes]);
  const locacoesFinalizadas = useMemo(() => locacoes.filter((locacao) => locacao.status !== "ATIVA"), [locacoes]);
  const veiculoPreview = disponiveis.find((veiculo) => String(veiculo.id) === veiculoSelecionado);
  const diariasPreview = calcularDiarias(dataInicio, dataPrevista);
  const valorPreview = veiculoPreview ? diariasPreview * Number(veiculoPreview.valorDiaria) : 0;
  const invalidDates = Boolean(dataInicio && dataPrevista && new Date(dataPrevista).getTime() <= new Date(dataInicio).getTime());
  const startInPast = Boolean(dataInicio && new Date(dataInicio).getTime() < Date.now() - 60_000);
  const canSubmitRental = Boolean(veiculoSelecionado && dataInicio && dataPrevista && !invalidDates && !startInPast && diariasPreview > 0);

  function notify(message: string, kind: Feedback["kind"] = "success") {
    setFeedback({ message, kind });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setFeedback(null), 5200);
  }

  async function carregarVeiculos() {
    const [todos, livres] = await Promise.all([VeiculoService.listar(), VeiculoService.listarDisponiveis()]);
    setVeiculos(todos);
    setDisponiveis(livres);
    if (veiculoSelecionado && !livres.some((veiculo) => String(veiculo.id) === veiculoSelecionado)) {
      setVeiculoSelecionado("");
    }
  }

  async function carregarLocacoes() {
    setLocacoes(await LocacaoService.listar());
  }

  async function atualizarDados(showLoading = false) {
    if (showLoading) setRefreshing(true);
    try {
      await Promise.all([carregarVeiculos(), carregarLocacoes()]);
    } catch (error) {
      notify(mensagemApi(error, "Não foi possível atualizar os dados."), "error");
    } finally {
      if (showLoading) setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!usuario || loadedOnce.current) return;
    loadedOnce.current = true;
    setInitialLoading(true);
    atualizarDados().finally(() => setInitialLoading(false));
  }, [usuario]);

  useEffect(() => {
    const sessionExpired = () => {
      AuthService.logout();
      setUsuario(null);
      setVeiculos([]);
      setDisponiveis([]);
      setLocacoes([]);
      setFeedback({ message: "Sua sessão expirou. Entre novamente para continuar.", kind: "error" });
    };
    window.addEventListener("session-expired", sessionExpired);
    return () => window.removeEventListener("session-expired", sessionExpired);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  async function enviarAuth(event: FormEvent) {
    event.preventDefault();
    setAuthLoading(true);
    setFeedback(null);
    try {
      if (mode === "register") {
        await AuthService.register({ nome: nome.trim(), email: email.trim(), senha });
        notify("Conta criada. Agora entre com seu e-mail e senha.", "success");
        setMode("login");
        setNome("");
      } else {
        const resultado = await AuthService.login(email.trim(), senha);
        setUsuario(resultado.usuario);
        setSection("overview");
        loadedOnce.current = false;
        notify(`Bem-vindo(a), ${resultado.usuario.nome}!`);
      }
      setSenha("");
    } catch (error) {
      notify(mensagemApi(error, "Não foi possível concluir a operação."), "error");
    } finally {
      setAuthLoading(false);
    }
  }

  async function cadastrarVeiculo(event: FormEvent) {
    event.preventDefault();
    if (Number(ano) < 1900 || Number(ano) > new Date().getFullYear() + 1) {
      notify("Informe um ano válido para o veículo.", "error");
      return;
    }
    if (Number(valorDiaria) <= 0) {
      notify("O valor da diária deve ser maior que zero.", "error");
      return;
    }
    setVehicleLoading(true);
    try {
      await VeiculoService.cadastrar({ marca: marca.trim(), modelo: modelo.trim(), placa: placa.trim().toUpperCase(), ano: Number(ano), valorDiaria: Number(valorDiaria) });
      setMarca("");
      setModelo("");
      setPlaca("");
      await carregarVeiculos();
      notify("Veículo cadastrado com sucesso.");
    } catch (error) {
      notify(mensagemApi(error, "Erro ao cadastrar veículo."), "error");
    } finally {
      setVehicleLoading(false);
    }
  }

  async function criarLocacao(event: FormEvent) {
    event.preventDefault();
    if (!canSubmitRental) {
      notify(startInPast ? "A data inicial não pode estar no passado." : "Confira as datas da locação antes de continuar.", "error");
      return;
    }
    setRentalLoading(true);
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
      notify("Locação registrada com sucesso.");
      setSection("rentals");
    } catch (error) {
      notify(mensagemApi(error, "Não foi possível registrar a locação."), "error");
      await carregarVeiculos().catch(() => undefined);
    } finally {
      setRentalLoading(false);
    }
  }

  async function devolverLocacao(locacao: Locacao) {
    const agora = new Date();
    const inicio = new Date(locacao.dataInicio);

    // Não permite devolver uma reserva antes do horário em que ela começa.
    if (agora.getTime() < inicio.getTime()) {
      notify(
        `Esta locação ainda não começou. O início está previsto para ${formatarData(locacao.dataInicio)}. A devolução só poderá ser registrada a partir desse horário.`,
        "error"
      );
      return;
    }

    // Confirmação explícita: a devolução será registrada com o horário real atual.
    const confirmada = window.confirm(
      `Confirmar a devolução agora?\n\n` +
      `${locacao.veiculo.marca} ${locacao.veiculo.modelo} (${locacao.veiculo.placa})\n` +
      `Início da locação: ${formatarData(locacao.dataInicio)}\n` +
      `Devolução prevista: ${formatarData(locacao.dataPrevistaDevolucao)}\n\n` +
      `Ao confirmar, a devolução será registrada com a data e hora atuais, ` +
      `o valor final será recalculado e o veículo será liberado.\n\n` +
      `Deseja confirmar a devolução neste momento?\n\nSelecione Cancelar se pretende devolver depois e manter a locação ativa.`
    );
    if (!confirmada) {
      notify("Devolução cancelada. A locação continua ativa.", "info");
      return;
    }

    setReturningId(locacao.id);
    try {
      await LocacaoService.devolver(locacao.id);
      await atualizarDados();
      notify("Devolução registrada com o horário atual. O veículo foi liberado.");
    } catch (error) {
      notify(mensagemApi(error, "Não foi possível finalizar a devolução."), "error");
    } finally {
      setReturningId(null);
    }
  }

  function sair() {
    AuthService.logout();
    setUsuario(null);
    setVeiculos([]);
    setDisponiveis([]);
    setLocacoes([]);
    setSection("overview");
    loadedOnce.current = false;
    notify("Você saiu do sistema.", "info");
  }

  const navItems: { id: Section; label: string; icon: string; detail: string }[] = [
    { id: "overview", label: "Visão geral", icon: "⌂", detail: "Resumo do sistema" },
    { id: "fleet", label: "Frota", icon: "▣", detail: "Veículos cadastrados" },
    { id: "rentals", label: "Locações ativas", icon: "↗", detail: "Acompanhar e devolver" },
    { id: "history", label: "Histórico", icon: "◷", detail: "Registros anteriores" }
  ];

  if (!usuario) {
    return (
      <main className="auth-shell">
        <section className="auth-visual">
          <div className="auth-visual-top"><span className="logo-mark">LV</span><span className="brand-name">Loca<span>Veículos</span></span></div>
          <div className="auth-visual-content">
            <span className="visual-tag">GESTÃO DE FROTA SIMPLIFICADA</span>
            <h1>Mobilidade para<br />cada jornada.</h1>
            <p>Uma experiência simples para administrar veículos, locações e devoluções com segurança.</p>
            <div className="visual-stat-row"><div><strong>01</strong><span>Frota organizada</span></div><div><strong>02</strong><span>Locações monitoradas</span></div><div><strong>03</strong><span>Gestão intuitiva</span></div></div>
          </div>
          <div className="auth-visual-footer">Projeto acadêmico · Programação com Frameworks Web</div>
        </section>
        <section className="auth-form-side">
          <div className="auth-form-card">
            <div className="mobile-brand"><span className="logo-mark">LV</span><span className="brand-name">Loca<span>Veículos</span></span></div>
            <span className="form-kicker">{mode === "login" ? "ACESSO À CONTA" : "NOVO CADASTRO"}</span>
            <h2>{mode === "login" ? "Bem-vindo de volta" : "Crie sua conta"}</h2>
            <p className="form-subtitle">{mode === "login" ? "Entre para acessar seu painel de locações." : "Preencha seus dados para começar a usar o sistema."}</p>
            <form onSubmit={enviarAuth} className="auth-form">
              {mode === "register" && <label>Nome completo<input autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" required minLength={2} /></label>}
              <label>E-mail<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" required /></label>
              <label>Senha<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Sua senha" minLength={6} required /></label>
              <button className="button-primary auth-submit" disabled={authLoading}>{authLoading ? <><span className="spinner"/> Aguarde...</> : mode === "login" ? "Entrar no sistema" : "Criar conta"}</button>
            </form>
            <div className="auth-switch">{mode === "login" ? "Ainda não tem uma conta?" : "Já possui cadastro?"}<button className="text-button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setFeedback(null); }}>{mode === "login" ? "Criar conta" : "Fazer login"}</button></div>
            {feedback && <div className={`inline-feedback ${feedback.kind}`}>{feedback.message}</div>}
            <div className="auth-security"><span>♢</span> Acesso protegido por autenticação</div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand"><span className="logo-mark">LV</span><div className="brand-name">Loca<span>Veículos</span></div></div>
        <div className="sidebar-label">MENU PRINCIPAL</div>
        <nav className="side-nav">
          {navItems.map((item) => (
            <button key={item.id} className={`nav-item ${section === item.id ? "active" : ""}`} title={item.label} aria-label={item.label} onClick={() => setSection(item.id)}>
              <span className="nav-icon">{item.icon}</span><span className="nav-text"><strong>{item.label}</strong><small>{item.detail}</small></span>
              {item.id === "rentals" && locacoesAtivas.length > 0 && <span className="nav-badge">{locacoesAtivas.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help"><span className="help-icon">?</span><strong>Precisa de ajuda?</strong><p>Confira os dados e atualize as informações quando necessário.</p><button className="sidebar-refresh" onClick={() => atualizarDados(true)} disabled={refreshing}>{refreshing ? "Atualizando..." : "Atualizar dados"}</button></div>
          <div className="sidebar-user"><span className="avatar">{initials(usuario.nome)}</span><div className="user-details"><strong>{usuario.nome}</strong><small>{usuario.email}</small></div><button className="logout-icon" title="Sair" onClick={sair}>↪</button></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="main-header"><div className="breadcrumb"><span>LocaVeículos</span><span>/</span><strong>{navItems.find((item) => item.id === section)?.label}</strong></div><div className="header-right"><span className="system-status"><i/> Sistema conectado</span><span className="header-avatar">{initials(usuario.nome)}</span></div></header>
        <div className="page-content">
          {section === "overview" && <>
            <section className="page-heading"><div><span className="section-eyebrow">PAINEL DE CONTROLE</span><h1>Olá, {usuario.nome.split(" ")[0]} 👋</h1><p>Confira o resumo da sua frota e acompanhe suas locações.</p></div><button className="button-outline" onClick={() => atualizarDados(true)} disabled={refreshing}><span className={refreshing ? "spin" : ""}>⟳</span>{refreshing ? "Atualizando" : "Atualizar"}</button></section>
            <section className="stats-grid">
              <article className="stat-card"><div className="stat-icon blue">▣</div><div className="stat-label">Veículos cadastrados</div><strong className="stat-value">{veiculos.length}</strong><span className="stat-foot">{disponiveis.length} disponíveis para locação</span></article>
              <article className="stat-card"><div className="stat-icon green">✓</div><div className="stat-label">Disponíveis</div><strong className="stat-value">{disponiveis.length}</strong><span className="stat-foot">Prontos para nova reserva</span></article>
              <article className="stat-card"><div className="stat-icon amber">↗</div><div className="stat-label">Locações ativas</div><strong className="stat-value">{locacoesAtivas.length}</strong><span className="stat-foot">Aguardando devolução</span></article>
              <article className="stat-card"><div className="stat-icon purple">◷</div><div className="stat-label">Finalizadas</div><strong className="stat-value">{locacoesFinalizadas.length}</strong><span className="stat-foot">No seu histórico</span></article>
            </section>
            <section className="overview-grid">
              <article className="surface-card">
                <div className="card-heading"><div><span className="section-eyebrow">FROTA</span><h2>Veículos recentes</h2></div><button className="text-button" onClick={() => setSection("fleet")}>Ver frota <span>→</span></button></div>
                {initialLoading ? <LoadingState label="Carregando veículos..." /> : veiculos.length === 0 ? <EmptyState icon="▣" title="Sua frota está vazia" description="Cadastre o primeiro veículo para começar a gerenciar sua locadora." action="Cadastrar veículo" onAction={() => setSection("fleet")} /> : <div className="table-wrap"><table><thead><tr><th>VEÍCULO</th><th>PLACA / ANO</th><th>DIÁRIA</th><th>STATUS</th></tr></thead><tbody>{veiculos.slice(0, 5).map((v) => <VehicleRow key={v.id} vehicle={v}/>)}</tbody></table></div>}
              </article>
              <article className="surface-card">
                <div className="card-heading"><div><span className="section-eyebrow">ACOMPANHAMENTO</span><h2>Locações em andamento</h2></div><button className="text-button" onClick={() => setSection("rentals")}>Ver todas <span>→</span></button></div>
                {initialLoading ? <LoadingState label="Carregando locações..." /> : locacoesAtivas.length === 0 ? <EmptyState icon="↗" title="Nenhuma locação ativa" description="As locações em andamento serão exibidas aqui." action="Nova locação" onAction={() => setSection("rentals")} /> : <div className="mini-rentals">{locacoesAtivas.slice(0, 4).map((l) => <MiniRental key={l.id} rental={l}/>)}</div>}
              </article>
            </section>
            <section className="quick-actions"><div><span className="section-eyebrow">ATALHOS</span><h2>O que deseja fazer?</h2></div><button className="quick-action" onClick={() => setSection("fleet")}><span className="quick-icon blue">＋</span><span><strong>Adicionar veículo</strong><small>Cadastre um veículo na frota</small></span><span className="quick-arrow">→</span></button><button className="quick-action" onClick={() => setSection("rentals")}><span className="quick-icon amber">↗</span><span><strong>Registrar locação</strong><small>Alugue um veículo disponível</small></span><span className="quick-arrow">→</span></button></section>
          </>}
          {section === "fleet" && <>
            <section className="page-heading"><div><span className="section-eyebrow">GESTÃO DE VEÍCULOS</span><h1>Minha frota</h1><p>Cadastre e acompanhe os veículos disponíveis para locação.</p></div><button className="button-outline" onClick={() => atualizarDados(true)} disabled={refreshing}><span>⟳</span>{refreshing ? "Atualizando" : "Atualizar"}</button></section>
            <section className="fleet-layout">
              <article className="surface-card form-card"><div className="card-heading"><div><span className="section-eyebrow">NOVO CADASTRO</span><h2>Adicionar veículo</h2></div><span className="form-icon">＋</span></div><form onSubmit={cadastrarVeiculo} className="vehicle-form">
                <label>Marca<input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Ex.: Toyota" required /></label>
                <label>Modelo<input value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Ex.: Corolla" required /></label>
                <div className="form-columns"><label>Placa<input value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} placeholder="ABC1D23" maxLength={8} required /></label><label>Ano<input type="number" min="1900" max={new Date().getFullYear() + 1} value={ano} onChange={(e) => setAno(e.target.value)} required /></label></div>
                <label>Valor da diária<input type="number" min="0.01" step="0.01" value={valorDiaria} onChange={(e) => setValorDiaria(e.target.value)} required /><small>Preço em reais por período de 24 horas.</small></label>
                <button className="button-primary full-width" disabled={vehicleLoading}>{vehicleLoading ? <><span className="spinner"/> Salvando veículo...</> : "Cadastrar veículo"}</button>
              </form></article>
              <article className="surface-card fleet-list-card"><div className="card-heading"><div><span className="section-eyebrow">INVENTÁRIO</span><h2>Veículos cadastrados</h2></div><span className="count-pill">{veiculos.length} veículos</span></div>
                {initialLoading ? <LoadingState label="Carregando frota..." /> : veiculos.length === 0 ? <EmptyState icon="▣" title="Nenhum veículo cadastrado" description="Os veículos que você cadastrar serão listados aqui."/> : <div className="vehicle-cards">{veiculos.map((v) => <VehicleCard key={v.id} vehicle={v}/>)}</div>}
              </article>
            </section>
          </>}
          {section === "rentals" && <>
            <section className="page-heading"><div><span className="section-eyebrow">RESERVAS E DEVOLUÇÕES</span><h1>Locações</h1><p>Registre uma nova locação ou acompanhe veículos que estão alugados.</p></div><button className="button-outline" onClick={() => atualizarDados(true)} disabled={refreshing}><span>⟳</span>{refreshing ? "Atualizando" : "Atualizar"}</button></section>
            <section className="rental-create-grid">
              <article className="surface-card rental-form-card"><div className="card-heading"><div><span className="section-eyebrow">NOVA LOCAÇÃO</span><h2>Dados da reserva</h2></div><span className="form-icon amber">↗</span></div>
                <form onSubmit={criarLocacao} className="rental-form-modern">
                  <label>Veículo disponível<select value={veiculoSelecionado} onChange={(e) => setVeiculoSelecionado(e.target.value)} required><option value="">Selecione um veículo</option>{disponiveis.map((v) => <option key={v.id} value={v.id}>{v.marca} {v.modelo} · {v.placa}</option>)}</select>{disponiveis.length === 0 && <small className="field-warning">Nenhum veículo disponível no momento.</small>}</label>
                  <div className="form-columns"><label>Retirada — data e horário<input type="datetime-local" value={dataInicio} min={agoraLocalInput()} onChange={(e) => setDataInicio(e.target.value)} required/><small>Defina quando o veículo será retirado.</small></label><label>Devolução prevista — data e horário<input type="datetime-local" value={dataPrevista} min={dataInicio} onChange={(e) => setDataPrevista(e.target.value)} required/><small>Escolha também o horário previsto de devolução.</small></label></div>
                  {startInPast && <div className="validation-message">A data inicial não pode estar no passado.</div>}
                  {invalidDates && <div className="validation-message">A devolução deve ocorrer depois do início da locação.</div>}
                  <div className="estimate-box"><div className="estimate-header"><span>Resumo estimado</span><span className="estimate-tag">PREVISÃO</span></div><div className="estimate-row"><span>Diária do veículo</span><strong>{veiculoPreview ? money(veiculoPreview.valorDiaria) : "—"}</strong></div><div className="estimate-row"><span>Período</span><strong>{diariasPreview ? `${diariasPreview} ${diariasPreview === 1 ? "diária" : "diárias"}` : "—"}</strong></div><div className="estimate-total"><span>Valor estimado</span><strong>{money(valorPreview)}</strong></div><p>O total final é calculado pelo servidor no momento da devolução.</p></div>
                  <button className="button-primary full-width" disabled={rentalLoading || !canSubmitRental}>{rentalLoading ? <><span className="spinner"/> Registrando...</> : "Confirmar locação"}</button>
                </form>
              </article>
              <article className="surface-card active-rentals-card"><div className="card-heading"><div><span className="section-eyebrow">EM ANDAMENTO</span><h2>Locações ativas</h2></div><span className="count-pill amber-count">{locacoesAtivas.length} ativas</span></div>
                {initialLoading ? <LoadingState label="Carregando locações..." /> : locacoesAtivas.length === 0 ? <EmptyState icon="↗" title="Sem locações ativas" description="Quando uma locação for registrada, ela aparecerá aqui."/> : <div className="active-rental-list">{locacoesAtivas.map((l) => <ActiveRental key={l.id} rental={l} returning={returningId === l.id} onReturn={() => devolverLocacao(l)}/>)}</div>}
              </article>
            </section>
          </>}
          {section === "history" && <>
            <section className="page-heading"><div><span className="section-eyebrow">CONSULTA</span><h1>Histórico de locações</h1><p>Consulte os registros das locações realizadas pela sua conta.</p></div><button className="button-outline" onClick={() => atualizarDados(true)} disabled={refreshing}><span>⟳</span>{refreshing ? "Atualizando" : "Atualizar"}</button></section>
            <section className="surface-card history-card"><div className="card-heading"><div><span className="section-eyebrow">REGISTROS</span><h2>Locações finalizadas</h2></div><span className="count-pill">{locacoesFinalizadas.length} registros</span></div>
              {initialLoading ? <LoadingState label="Carregando histórico..." /> : locacoesFinalizadas.length === 0 ? <EmptyState icon="◷" title="Nenhum registro no histórico" description="As locações finalizadas serão exibidas nesta área."/> : <div className="history-table-wrap"><table className="history-table"><thead><tr><th>VEÍCULO</th><th>PERÍODO</th><th>DIÁRIAS</th><th>VALOR</th><th>STATUS</th></tr></thead><tbody>{locacoesFinalizadas.map((l) => <HistoryRow key={l.id} rental={l}/>)}</tbody></table></div>}
            </section>
            <section className="surface-card history-active-card"><div className="card-heading"><div><span className="section-eyebrow">VISÃO COMPLEMENTAR</span><h2>Locações ainda ativas</h2></div><button className="text-button" onClick={() => setSection("rentals")}>Gerenciar <span>→</span></button></div>{locacoesAtivas.length === 0 ? <EmptyState title="Nenhuma locação ativa" description="Não há locações em andamento no momento."/> : <div className="mini-rentals">{locacoesAtivas.map((l) => <MiniRental key={l.id} rental={l}/>)}</div>}</section>
          </>}
          <footer className="page-footer"><span>LocaVeículos · Sistema acadêmico de locação</span><span>Interface integrada à API</span></footer>
        </div>
      </main>
      {feedback && <div className={`toast ${feedback.kind}`} role="status"><span className="toast-symbol">{feedback.kind === "success" ? "✓" : feedback.kind === "error" ? "!" : "i"}</span><span>{feedback.message}</span><button onClick={() => setFeedback(null)} aria-label="Fechar mensagem">×</button></div>}
    </div>
  );
}

function VehicleRow({ vehicle }: { vehicle: Veiculo }) {
  return <tr><td><div className="table-vehicle"><span className="vehicle-symbol">▣</span><div><strong>{vehicle.marca} {vehicle.modelo}</strong><small>Veículo</small></div></div></td><td>{vehicle.placa} <span className="table-muted">· {vehicle.ano}</span></td><td className="table-money">{money(vehicle.valorDiaria)}<small>/ diária</small></td><td><Status available={vehicle.disponivel}/></td></tr>;
}

function VehicleCard({ vehicle }: { vehicle: Veiculo }) {
  return <article className="vehicle-card"><div className="vehicle-card-top"><span className="vehicle-symbol large">▣</span><Status available={vehicle.disponivel}/></div><h3>{vehicle.marca} {vehicle.modelo}</h3><p>{vehicle.placa} <span>·</span> {vehicle.ano}</p><div className="vehicle-card-price"><strong>{money(vehicle.valorDiaria)}</strong><small>por diária</small></div></article>;
}

function MiniRental({ rental }: { rental: Locacao }) {
  return <div className="mini-rental"><span className="rental-mini-icon">↗</span><div className="mini-rental-info"><strong>{rental.veiculo.marca} {rental.veiculo.modelo}</strong><small>{rental.veiculo.placa} · devolução {formatarData(rental.dataPrevistaDevolucao)}</small></div><span className="status-pill active">Ativa</span></div>;
}

function ActiveRental({ rental, returning, onReturn }: { rental: Locacao; returning: boolean; onReturn: () => void }) {
  const aindaNaoComecou = new Date(rental.dataInicio).getTime() > Date.now();
  return <article className="active-rental"><div className="active-rental-header"><div><span className={`status-pill ${aindaNaoComecou ? "scheduled" : "active"}`}>{aindaNaoComecou ? "Agendada · não iniciada" : "Em andamento"}</span><h3>{rental.veiculo.marca} {rental.veiculo.modelo}</h3><p>{rental.veiculo.placa} · {rental.veiculo.ano}</p></div><span className="vehicle-symbol large">▣</span></div><div className="rental-detail-grid"><div><small>Início</small><strong>{formatarData(rental.dataInicio)}</strong></div><div><small>Devolução prevista</small><strong>{formatarData(rental.dataPrevistaDevolucao)}</strong></div><div><small>Diárias previstas</small><strong>{calcularDiarias(rental.dataInicio, rental.dataPrevistaDevolucao)}</strong></div><div><small>Valor estimado</small><strong>{money(rental.valorTotal)}</strong></div></div><button className="button-return full-width" onClick={onReturn} disabled={returning}>{returning ? <><span className="spinner"/> Registrando devolução...</> : "Registrar devolução"}</button></article>;
}

function HistoryRow({ rental }: { rental: Locacao }) {
  const charged = calcularDiarias(rental.dataInicio, rental.dataDevolucao || rental.dataPrevistaDevolucao);
  return <tr><td><div className="table-vehicle"><span className="vehicle-symbol">▣</span><div><strong>{rental.veiculo.marca} {rental.veiculo.modelo}</strong><small>{rental.veiculo.placa} · {rental.veiculo.ano}</small></div></div></td><td><div className="date-column"><span><small>Início:</small> {formatarData(rental.dataInicio)}</span><span><small>Prevista:</small> {formatarData(rental.dataPrevistaDevolucao)}</span><span><small>Devolução:</small> {formatarData(rental.dataDevolucao)}</span></div></td><td>{charged}</td><td className="table-money">{money(rental.valorTotal)}</td><td><Status available={false} label="Finalizada"/></td></tr>;
}

function Status({ available, label }: { available: boolean; label?: string }) {
  return <span className={`status-pill ${available ? "available" : "unavailable"}`}><i/>{label || (available ? "Disponível" : "Alugado")}</span>;
}

function EmptyState({ icon, title, description, action, onAction }: { icon?: string; title: string; description: string; action?: string; onAction?: () => void }) {
  return <div className="empty-state-modern"><span className="empty-icon">{icon || "◷"}</span><strong>{title}</strong><p>{description}</p>{action && onAction && <button className="button-outline small-button" onClick={onAction}>{action}</button>}</div>;
}

function LoadingState({ label }: { label: string }) {
  return <div className="loading-state"><span className="spinner dark-spinner"/><p>{label}</p></div>;
}
