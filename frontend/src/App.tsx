import { FormEvent, useEffect, useState } from "react";
import AuthService from "./services/AuthService";
import VeiculoService from "./services/VeiculoService";
import { Usuario } from "./types/Usuario";
import { Veiculo } from "./types/Veiculo";

type AuthMode = "login" | "register";

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
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [placa, setPlaca] = useState("");
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [valorDiaria, setValorDiaria] = useState("150");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState(false);
  const [loading, setLoading] = useState(false);

  async function carregarVeiculos() {
    try {
      const dados = await VeiculoService.listar();
      setVeiculos(dados);
    } catch {
      setMensagem("Não foi possível carregar os veículos.");
      setErro(true);
    }
  }

  useEffect(() => {
    if (usuario) carregarVeiculos();
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
      setMensagem(error.response?.data?.mensagem || "Não foi possível concluir a operação.");
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
      await VeiculoService.cadastrar({
        marca,
        modelo,
        placa,
        ano: Number(ano),
        valorDiaria: Number(valorDiaria)
      });
      setMarca("");
      setModelo("");
      setPlaca("");
      await carregarVeiculos();
      setMensagem("Veículo cadastrado com sucesso.");
      setErro(false);
    } catch (error: any) {
      setMensagem(error.response?.data?.mensagem || "Erro ao cadastrar veículo.");
      setErro(true);
    } finally {
      setLoading(false);
    }
  }

  function sair() {
    AuthService.logout();
    setUsuario(null);
    setVeiculos([]);
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
            {mode === "register" && (
              <label>Nome
                <input value={nome} onChange={(e) => setNome(e.target.value)} required />
              </label>
            )}
            <label>E-mail
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>Senha
              <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} minLength={6} required />
            </label>
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
        <div className="user-area">
          <span>Olá, {usuario.nome}</span>
          <button className="button-secondary" onClick={sair}>Sair</button>
        </div>
      </header>

      <section className="welcome">
        <p className="eyebrow">VISÃO GERAL</p>
        <h1>Frota de veículos</h1>
        <p className="muted">Cadastre veículos e acompanhe a disponibilidade da frota.</p>
      </section>

      {mensagem && <p className={erro ? "notice error" : "notice"}>{mensagem}</p>}

      <section className="content-grid">
        <div className="panel">
          <div className="panel-heading">
            <div><p className="eyebrow">NOVA ENTRADA</p><h2>Cadastrar veículo</h2></div>
          </div>
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
          <div className="panel-heading">
            <div><p className="eyebrow">CADASTRO DA FROTA</p><h2>Veículos cadastrados</h2></div>
            <span className="count">{veiculos.length} veículos</span>
          </div>
          {veiculos.length === 0 ? (
            <div className="empty-state"><span>🚗</span><strong>Nenhum veículo cadastrado</strong><p>Use o formulário ao lado para adicionar o primeiro veículo.</p></div>
          ) : (
            <div className="vehicle-list">
              {veiculos.map((veiculo) => (
                <article className="vehicle-item" key={veiculo.id}>
                  <div className="car-icon">🚘</div>
                  <div className="vehicle-info">
                    <strong>{veiculo.marca} {veiculo.modelo}</strong>
                    <span>{veiculo.placa} · {veiculo.ano}</span>
                  </div>
                  <div className="vehicle-price">
                    <strong>R$ {Number(veiculo.valorDiaria).toFixed(2)}</strong>
                    <span>por diária</span>
                  </div>
                  <span className={veiculo.disponivel ? "status available" : "status unavailable"}>
                    {veiculo.disponivel ? "Disponível" : "Indisponível"}
                  </span>
                </article>
              ))}
            </div>
          )}
          <button className="button-secondary refresh-button" onClick={carregarVeiculos}>Atualizar lista</button>
        </div>
      </section>
      <footer>Projeto acadêmico · Programação com Frameworks Web</footer>
    </main>
  );
}
