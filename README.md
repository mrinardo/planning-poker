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

## Deploy no Render

Este projeto funciona melhor em plataforma com processo Node persistente, porque usa estado em memoria e Socket.IO em tempo real.

### Passos

1. No Render, clique em New + e selecione Web Service.
2. Conecte o repositorio e selecione este projeto.
3. Configure o servico:
- Runtime: Node
- Build Command: `npm run build`
- Start Command: `npm run start`
- Node version: 22.x
4. Em Advanced:
- Nao defina `PORT` manualmente. O Render injeta `PORT` automaticamente.
- Configure apenas variaveis extras se precisar no futuro.
5. Em Instance Type, mantenha 1 instancia para preservar a regra de estado em memoria em processo unico.
6. Crie o servico e aguarde o deploy.
7. Acesse a URL publica gerada pelo Render e valide:
- GET `/api/health` retorna status 200.
- Home carrega e cria sessao.
- Compartilhar o link abre a mesma sessao.
- Votos e revelacao funcionam em tempo real.

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
