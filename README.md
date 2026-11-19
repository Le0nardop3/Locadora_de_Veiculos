# Sistema de Locação de Veículos

Projeto acadêmico desenvolvido com TypeScript, Node.js, Express, Prisma, MySQL, JWT e React.

## Entregas planejadas

1. **Fundação e primeira versão (esta entrega):** estrutura do repositório, banco Prisma, cadastro/login, autenticação JWT, cadastro/listagem de veículos e interface inicial.
2. **Locações e regras de negócio:** criação, histórico e devolução; cálculo de diárias; transações e proteção contra locações simultâneas.
3. **Frontend completo:** formulários, validações, estados, feedbacks e integração de todos os fluxos.
4. **Documentação e manuscritos:** README final, DER, diagrama de sequência e respostas individuais baseadas no código.
5. **Validação e apresentação:** testes de rotas, cenários de erro, revisão de segurança e roteiro de demonstração.

## Requisitos

- Node.js 20 ou superior
- MySQL 8 ou compatível
- npm

## Configuração

### 1. Banco de dados

Crie um banco MySQL, por exemplo:

```sql
CREATE DATABASE locacao_veiculos;
```

### 2. Backend

```bash
cd backend
cp .env.example .env
```

Edite `backend/.env` e informe a URL do seu MySQL e um segredo JWT.

Exemplo:

```env
DATABASE_URL="mysql://root:SUA_SENHA@localhost:3306/locacao_veiculos"
JWT_SECRET="troque-por-um-segredo-grande-e-aleatorio"
PORT=3000
```

Depois execute:

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

A API ficará em `http://localhost:3000`. A rota `GET /health` verifica se ela está ativa.

### 3. Frontend

Em outro terminal:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

A interface ficará no endereço exibido pelo Vite, normalmente `http://localhost:5173`.

## Rotas disponíveis nesta versão

| Método | Rota | Protegida | Descrição |
|---|---|---:|---|
| GET | `/health` | Não | Verifica a API |
| POST | `/auth/register` | Não | Cadastra usuário |
| POST | `/auth/login` | Não | Realiza login e retorna JWT |
| GET | `/vehicles` | Sim | Lista veículos |
| GET | `/vehicles/available` | Sim | Lista veículos disponíveis |
| POST | `/vehicles` | Sim | Cadastra veículo |

As rotas de locação serão concluídas na segunda entrega.

## Observações

- Senhas são armazenadas como hash usando bcryptjs.
- O JWT é enviado pelo frontend no cabeçalho `Authorization: Bearer <token>`.
- O backend não retorna o hash da senha.
- As regras de negócio ficam nos Services.
- O projeto não inclui comentários explicativos no código-fonte, conforme orientação do professor.
- Nunca envie o arquivo `.env` para o GitHub. O arquivo `.env.example` contém apenas os nomes das variáveis.

## Teste inicial

1. Inicie o MySQL.
2. Inicie o backend e confirme `GET /health`.
3. Abra o frontend.
4. Cadastre um usuário.
5. Faça login.
6. Cadastre um veículo.
7. Consulte a lista de veículos.
