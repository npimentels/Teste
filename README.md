# Mente em Rede

Uma extensão digital da mente — canvas neural para capturar e explorar pensamentos.

## Stack

- **Backend**: Flask + SQLAlchemy (SQLite local → PostgreSQL em produção)
- **Frontend**: Vanilla JS + Canvas API
- **Auth**: senha secreta → JWT
- **Deploy**: Railway

## Setup local

### 1. Clonar e entrar no repositório

```bash
git clone <repo-url>
cd mente-em-rede
```

### 2. Criar o arquivo `.env`

```bash
cp .env.example .env
```

Edite `.env`:

```env
SECRET_PASSWORD=sua-senha-secreta
JWT_SECRET=uma-string-aleatoria-longa
DATABASE_URL=sqlite:///thoughts.db
JWT_EXPIRATION_HOURS=72
PORT=5000
```

### 3. Instalar dependências Python

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r ../requirements.txt
```

### 4. Rodar o servidor

```bash
python app.py
```

Abra `http://localhost:5000` no navegador.

> O banco SQLite é criado automaticamente em `backend/thoughts.db` na primeira execução.

## Como usar

| Ação | Atalho |
|------|--------|
| Abrir modo escrita | `Ctrl+Space` ou botão `⊕` |
| Enviar pensamento | `Enter` (sem Shift) |
| Nova linha no pensamento | `Shift+Enter` |
| Fechar overlays | `Esc` |
| Buscar | `/` ou botão `⌕` |
| Filtrar por data | botão `□` |
| Navegar no canvas | arrastar mouse / touch |
| Rolar | scroll do mouse |

Para escrever pensamentos, você precisa da senha secreta definida em `SECRET_PASSWORD`.

## Deploy no Railway

### 1. Criar conta e instalar CLI

```bash
npm i -g @railway/cli
railway login
```

### 2. Criar projeto

```bash
railway init
```

### 3. Adicionar banco PostgreSQL

No painel do Railway: **New Service → Database → PostgreSQL**

Copie a `DATABASE_URL` fornecida.

### 4. Configurar variáveis de ambiente

No painel Railway → seu serviço → **Variables**:

```
SECRET_PASSWORD  = sua-senha-secreta
JWT_SECRET       = string-aleatoria-longa
DATABASE_URL     = postgresql://... (copiada do PostgreSQL)
JWT_EXPIRATION_HOURS = 72
```

### 5. Deploy

```bash
railway up
```

O `Procfile` já está configurado para rodar com gunicorn.

### Troca SQLite → PostgreSQL

A troca é automática via `DATABASE_URL`. Basta apontar para um banco PostgreSQL — o SQLAlchemy cria as tabelas no primeiro boot (`db.create_all()`).

## API

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| POST | `/api/auth` | — | Autentica com senha, retorna JWT |
| GET | `/api/thoughts` | — | Lista pensamentos (suporta `?from=` e `?to=`) |
| POST | `/api/thoughts` | Bearer JWT | Cria pensamento |
| GET | `/api/thoughts/search` | — | Busca por texto (`?q=`) |

### Exemplo

```bash
# autenticar
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth \
  -H 'Content-Type: application/json' \
  -d '{"password":"sua-senha"}' | jq -r .token)

# criar pensamento
curl -X POST http://localhost:5000/api/thoughts \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"content":"primeiro pensamento solto na rede"}'

# listar
curl http://localhost:5000/api/thoughts
```
