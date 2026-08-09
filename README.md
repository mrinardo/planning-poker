# Planning Poker (MVP)

Aplicacao web de Planning Poker em tempo real para uso pessoal, com estado 100% em memoria no processo Node.js.

## Stack

- Node.js 22+
- TypeScript (strict)
- Express
- Socket.IO
- React + Vite

## Estrutura

- server/
- client/
- docs/

## Como rodar localmente

### 1) Instalar dependencias

```bash
npm install
```

### 2) Subir em modo desenvolvimento

```bash
npm run dev
```

Acesso local:

- Frontend: http://localhost:5173
- Backend/API + Socket.IO: http://localhost:3000

## Como testar localmente

### Validar lint

```bash
npm run lint
```

### Validar build completo

```bash
npm run build
```

### Teste manual rapido

1. Abra http://localhost:5173.
2. Crie uma sessao na Home.
3. Copie o link e abra em outra aba/janela.
4. Entre com outro nome.
5. Faça votos nas duas abas.
6. Na aba host, clique em "Revelar votos".
7. Clique em "Nova rodada" e confirme limpeza dos votos.
8. Clique em "Encerrar sessao" e confirme mensagem de encerramento em todos.

## Scripts npm

- dev: roda cliente e servidor em paralelo.
- build: gera build do cliente e compila servidor TypeScript.
- start: inicia servidor Node em producao (servindo dist/client quando existir).
- lint: roda ESLint no projeto.

## Deploy no Vercel

Este projeto e monolitico no servidor, mantendo estado em memoria no processo. Em ambientes serverless, o estado em memoria pode ser reiniciado com frequencia. Para uso pessoal/MVP, isso pode ser aceitavel.

### Opcao recomendada para manter app unica

Configurar o Vercel para buildar frontend + servidor e iniciar o processo Node com `npm run start`.

### Passos

1. Conecte o repositorio no Vercel.
2. Em Project Settings:
- Build Command: `npm run build`
- Output Directory: deixe vazio
- Install Command: `npm install`
- Node version: 22.x
3. Configure variavel de ambiente (opcional):
- `PORT=3000`
4. Deploy.

### Comandos locais equivalentes de producao

```bash
npm run build
npm run start
```

Com isso, o servidor sobe em Node e serve os arquivos estaticos de `dist/client`.

## Observacoes

- Sem banco de dados e sem persistencia em disco por design.
- Reiniciar o servidor remove sessoes ativas.
- Limpeza automatica remove sessoes sem atividade por 24h.
