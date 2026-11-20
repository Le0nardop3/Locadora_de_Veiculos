# Sistema de Locação de Veículos

Projeto acadêmico desenvolvido com TypeScript, Node.js, Express, Prisma, MySQL, JWT e React.

## Entregas

1. Fundação: estrutura do repositório, banco Prisma, cadastro/login, autenticação JWT, cadastro e listagem de veículos.
2. Sistema de locações: registro, histórico, devolução, cálculo de diárias, transações e controle concorrente da disponibilidade.
3. Interface integrada: formulários, validações, estados e feedbacks.
4. Documentação acadêmica: README, DER, diagramas e respostas individuais.
5. Validação e apresentação: testes de rotas, cenários de erro, revisão de segurança e roteiro de demonstração.

## Requisitos

- Node.js 20 ou superior
- MySQL 8 ou compatível
- npm

## Configuração do banco

Crie o banco MySQL:

```sql
CREATE DATABASE locacao_veiculos;
```

## Backend

```bash
cd backend
cp .env.example .env
```

No PowerShell do Windows, use `Copy-Item .env.example .env`.

Configure a `DATABASE_URL`, `JWT_SECRET`, `PORT` e `FRONTEND_URL` no `.env`. Não envie o `.env` ao GitHub.

Instale e inicialize:

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

A API executa em `http://localhost:3000`. `GET /health` verifica a API.

## Frontend

Em outro terminal:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

No PowerShell do Windows, use `Copy-Item .env.example .env`.

O Vite mostra o endereço de acesso, normalmente `http://localhost:5173`.



## Entrega 3 — Interface e integração

A interface foi reorganizada para facilitar o uso do sistema:

- Navegação lateral com visão geral, frota, locações ativas e histórico.
- Painel de indicadores de veículos e locações.
- Cadastro de veículos com validação de ano e diária.
- Formulário de locação com seleção de veículos disponíveis, datas e estimativa de diárias/valor.
- Área de locações ativas com dados da reserva e ação de devolução.
- Histórico com período, diárias, valor final e status.
- Estados de carregamento e mensagens de sucesso/erro integradas ao layout.
- Tratamento de erro de conexão e sessão expirada (HTTP 401).
- Layout responsivo para desktop, tablet e telas menores.
- Os serviços Axios e endpoints existentes foram mantidos; a API continua responsável pelas regras de negócio e pelo cálculo oficial dos valores.

A interface estima o valor antes da confirmação apenas para apresentar uma prévia. A API continua calculando e validando o valor oficial.

## Rotas da API

| Método | Rota | Protegida | Descrição |
|---|---|---|---|
| GET | `/health` | Não | Verifica API |
| POST | `/auth/register` | Não | Cadastro |
| POST | `/auth/login` | Não | Login e JWT |
| GET | `/vehicles` | Sim | Lista frota |
| GET | `/vehicles/available` | Sim | Lista veículos disponíveis |
| POST | `/vehicles` | Sim | Cadastra veículo |
| POST | `/locacoes` | Sim | Registra locação do usuário autenticado |
| GET | `/locacoes` | Sim | Histórico do usuário autenticado |
| GET | `/locacoes/ativas` | Sim | Locações ativas do usuário autenticado |
| PATCH | `/locacoes/:id/devolver` | Sim | Finaliza locação e libera veículo |

## Regras das locações

Exemplos de arredondamento de diárias: 5 horas = 1 diária; 24 horas = 1; 25 horas = 2; 48 horas = 2; 50 horas = 3; 72 horas = 3.

- A identificação do usuário vem do JWT; não é aceita identificação de usuário enviada pelo frontend.
- A duração é calculada em períodos de 24 horas, arredondando qualquer fração para uma diária completa.
- O valor é calculado no backend usando a diária do veículo.
- A reserva usa atualização condicional da disponibilidade dentro de uma transação Prisma com isolamento `Serializable`. Apenas uma requisição pode alterar o veículo disponível para indisponível; a criação da locação e essa alteração são confirmadas ou revertidas juntas.
- Devolução e liberação do veículo ocorrem na mesma transação, verificando proprietário e status ativo.
- O histórico e as locações ativas são filtrados pelo usuário autenticado.

## Exemplos de testes da API

Após fazer login, copie o token retornado. Os exemplos usam `TOKEN`, `VEICULO_ID`, `LOCACAO_ID`, `INICIO_ISO` e `PREVISAO_ISO` como valores a substituir. Use a data/hora atual para início e uma previsão futura. As datas devem ser enviadas em formato ISO 8601.

Registrar uma locação:

```bash
curl -X POST http://localhost:3000/locacoes \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"veiculoId":1,"dataInicio":"INICIO_ISO","dataPrevistaDevolucao":"PREVISAO_ISO"}'
```

Listar histórico:

```bash
curl http://localhost:3000/locacoes -H "Authorization: Bearer TOKEN"
```

Listar ativas:

```bash
curl http://localhost:3000/locacoes/ativas -H "Authorization: Bearer TOKEN"
```

Finalizar devolução:

```bash
curl -X PATCH http://localhost:3000/locacoes/1/devolver -H "Authorization: Bearer TOKEN"
```

Testes de conflito: faça duas chamadas POST de locação ao mesmo tempo usando o mesmo veículo e token (ou tokens de usuários diferentes). Apenas uma deve ser criada; a outra recebe HTTP 409. Repetir a devolução de uma locação finalizada deve receber conflito. Tentar devolver uma locação com outro usuário deve retornar locação não encontrada para esse usuário.

Para simular duas chamadas simultâneas no PowerShell, substitua o ID pelo veículo disponível e o TOKEN pelo JWT. Os dois jobs usam a mesma entrada e enviam as requisições ao mesmo tempo:

```powershell
$headers = @{ Authorization = "Bearer TOKEN" }
$inicio = (Get-Date).ToUniversalTime().ToString("o")
$prevista = (Get-Date).AddDays(1).ToUniversalTime().ToString("o")
$body = @{ veiculoId = 1; dataInicio = $inicio; dataPrevistaDevolucao = $prevista } | ConvertTo-Json
$jobs = 1..2 | ForEach-Object {
  Start-Job -ArgumentList $headers, $body -ScriptBlock {
    param($headers, $body)
    try {
      $response = Invoke-WebRequest -Method Post -Uri "http://localhost:3000/locacoes" -Headers $headers -ContentType "application/json" -Body $body
      "HTTP $($response.StatusCode)"
    } catch {
      if ($_.Exception.Response) { "HTTP $([int]$_.Exception.Response.StatusCode)" } else { $_.Exception.Message }
    }
  }
}
$jobs | Wait-Job | Receive-Job
$jobs | Remove-Job
```

Resultado esperado: uma resposta HTTP 201 e outra HTTP 409, e o veículo fica indisponível.

## Teste manual sugerido

1. Inicie MySQL e aplique migrations com `npx prisma migrate dev`.
2. Inicie backend e frontend.
3. Cadastre e autentique um usuário.
4. Cadastre veículos, observando suas diárias.
5. Crie locação para um veículo disponível e confirme que ele muda para indisponível.
6. Tente criar uma segunda locação para o mesmo veículo, incluindo chamadas simultâneas; a API deve rejeitar.
7. Consulte as locações ativas e o histórico.
8. Registre a devolução, confira o valor recalculado e a disponibilidade do veículo.
9. Tente devolver novamente e tente devolver com outro usuário.

## Observações

- Senhas são armazenadas como hash usando bcryptjs.
- O JWT é enviado em `Authorization: Bearer <token>`.
- O backend não retorna hashes de senha.
- Regras de negócio ficam nos Services.
- Não há comentários explicativos nos códigos-fonte, conforme orientação da disciplina.
- `.env` não deve ser versionado; `.env.example` contém somente variáveis de exemplo.
