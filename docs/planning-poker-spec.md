# Especificação do Produto — Planning Poker Pessoal (MVP)

## Objetivo

Desenvolver uma aplicação web de **Planning Poker em tempo real** para uso pessoal, permitindo que múltiplas pessoas participem da mesma sessão através de um link compartilhado.

A aplicação deve ser extremamente simples, sem banco de dados e sem dependências externas de infraestrutura.

---

# Restrições obrigatórias

* **Não utilizar PostgreSQL, MySQL, MongoDB, Redis ou qualquer banco de dados.**
* Todo o estado da aplicação deve permanecer **em memória** no processo Node.js.
* Não persistir dados em disco.
* Após reinício do servidor, todas as sessões podem ser perdidas.
* Aplicação monolítica em um único processo Node.js.

---

# Stack obrigatória

## Backend

* Node.js 22+
* TypeScript
* Express
* Socket.IO

## Frontend

* React + TypeScript
* Vite

## Build

* npm

---

# Arquitetura

Aplicação composta por:

* Servidor HTTP Express
* Servidor WebSocket Socket.IO
* Estado global em memória usando `Map`

Fluxo:

```text
Browser Host
Browser Participante
        |
        v
Socket.IO
        |
        v
Node.js (estado em memória)
```

Não deve existir qualquer camada de persistência.

---

# Funcionalidades obrigatórias

## 1. Criar sessão

### Fluxo

1. Usuário acessa a página inicial.
2. Informa o nome da sessão.
3. Sistema cria uma sessão e retorna:

   * URL compartilhável
   * Token do proprietário (host)

### Requisitos

* ID da sessão deve ser UUID.
* URL deve ser `/s/:sessionId`.
* Token do host deve ser UUID aleatório.
* Host entra automaticamente na sessão.

---

## 2. Entrar em sessão

### Fluxo

1. Usuário acessa o link da sessão.
2. Informa apenas o nome.
3. Sistema adiciona o participante à sessão.

### Requisitos

* Nome obrigatório.
* Máximo 30 caracteres.
* Remover espaços extras.
* Nomes duplicados são permitidos.

---

## 3. Votação

### Valores permitidos

```text
0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, ?, ☕
```

### Requisitos

* Participante pode alterar o voto até a revelação.
* Antes da revelação, somente indicar “votou”.
* Não exibir o valor do voto antes da revelação.

---

## 4. Revelar votos

Somente o host pode revelar.

### Após revelar

Exibir:

* Nome do participante
* Valor votado

Calcular automaticamente:

* Média (considerar apenas valores numéricos)
* Menor valor
* Maior valor

Ignorar `?` e `☕` nos cálculos.

---

## 5. Nova rodada

Somente o host pode iniciar nova rodada.

### Deve ocorrer

* Limpar todos os votos
* Marcar sessão como não revelada
* Manter participantes conectados

---

## 6. Encerrar sessão

Somente o host pode encerrar.

### Deve ocorrer

* Desconectar participantes
* Remover sessão da memória
* Exibir mensagem “Sessão encerrada”

---

# Gerenciamento de sessões abandonadas

Implementar limpeza automática.

## Regras

* Cada sessão possui `lastActivityAt`.
* Atualizar em:

  * entrada de participante
  * voto
  * revelação
  * nova rodada
  * heartbeat

## Expiração

* Sessão sem atividade por **24 horas** deve ser removida da memória.

## Processo

Executar `setInterval` a cada 5 minutos.

Pseudo:

```ts
if (Date.now() - session.lastActivityAt > 24h) {
  sessions.delete(session.id)
}
```

---

# Heartbeat

Cliente deve enviar heartbeat a cada **30 segundos**.

Evento:

```json
{ "type": "heartbeat" }
```

Servidor atualiza `lastSeenAt` do participante.

---

# Modelo de dados em memória

## Session

```ts
type Session = {
  id: string;
  name: string;
  ownerToken: string;
  createdAt: number;
  lastActivityAt: number;
  revealed: boolean;
  participants: Map<string, Participant>;
  votes: Map<string, Vote>;
}
```

## Participant

```ts
type Participant = {
  id: string;
  name: string;
  socketId: string;
  joinedAt: number;
  lastSeenAt: number;
}
```

## Vote

```ts
type Vote = {
  participantId: string;
  value: string;
  votedAt: number;
}
```

## Estado global

```ts
const sessions = new Map<string, Session>()
```

---

# Eventos WebSocket

## join-session

Cliente → servidor

```json
{
  "sessionId": "uuid",
  "name": "João"
}
```

Servidor → cliente

```json
{
  "participantId": "uuid",
  "session": { ... }
}
```

Broadcast

```json
{
  "type": "participants-updated",
  "participants": [ ... ]
}
```

---

## vote

Cliente → servidor

```json
{
  "sessionId": "uuid",
  "participantId": "uuid",
  "value": "8"
}
```

Broadcast

```json
{
  "type": "vote-status",
  "participantId": "uuid",
  "hasVoted": true
}
```

---

## reveal-votes

Cliente → servidor

```json
{
  "sessionId": "uuid",
  "ownerToken": "uuid"
}
```

Broadcast

```json
{
  "type": "votes-revealed",
  "votes": [
    { "name": "Ana", "value": "5" },
    { "name": "João", "value": "8" }
  ],
  "stats": {
    "average": 6.5,
    "min": 5,
    "max": 8
  }
}
```

---

## new-round

Cliente → servidor

```json
{
  "sessionId": "uuid",
  "ownerToken": "uuid"
}
```

Broadcast

```json
{
  "type": "new-round"
}
```

---

## close-session

Cliente → servidor

```json
{
  "sessionId": "uuid",
  "ownerToken": "uuid"
}
```

Broadcast

```json
{
  "type": "session-closed"
}
```

---

# Endpoints HTTP

## POST /api/sessions

Criar sessão.

### Request

```json
{
  "name": "Sprint 42"
}
```

### Response

```json
{
  "sessionId": "uuid",
  "ownerToken": "uuid",
  "url": "/s/uuid"
}
```

---

## GET /api/sessions/:id

Obter estado atual da sessão.

### Response

```json
{
  "id": "uuid",
  "name": "Sprint 42",
  "revealed": false,
  "participants": [
    { "id": "p1", "name": "Ana" }
  ]
}
```

Retornar 404 se não existir.

---

# Regras de autorização

## Host

Pode:

* revelar votos
* iniciar nova rodada
* encerrar sessão

Validação feita pelo `ownerToken`.

## Participante

Pode:

* entrar
* votar
* sair

Não pode executar ações de host.

---

# Interface do usuário

## Página inicial

* Campo “Nome da sessão”
* Botão “Criar sessão”

## Página da sessão

### Cabeçalho

* Nome da sessão
* Link compartilhável
* Botão copiar link

### Lista de participantes

Exibir:

* Nome
* Indicador:

  * ⏳ aguardando
  * ✅ votou

### Cartas

Botões grandes com os valores Fibonacci.

### Área do host

* Revelar votos
* Nova rodada
* Encerrar sessão

### Resultado

Após revelação:

* tabela de votos
* média
* mínimo
* máximo

---

# Comportamento em tempo real

* Entrada/saída de participantes deve atualizar todos os clientes imediatamente.
* Votos devem atualizar imediatamente o status.
* Revelação deve ocorrer simultaneamente para todos.
* Nova rodada deve limpar a tela de todos simultaneamente.

---

# Tratamento de desconexão

Ao desconectar socket:

1. Remover participante da sessão.
2. Notificar os demais participantes.
3. Atualizar `lastActivityAt`.

Se a sessão ficar sem participantes, mantê-la até expirar pelo TTL.

---

# Estrutura de pastas obrigatória

```text
planning-poker/
  package.json
  tsconfig.json
  vite.config.ts

  server/
    index.ts
    sessionStore.ts
    types.ts
    cleanup.ts
    socket.ts

  client/
    src/
      main.tsx
      App.tsx
      pages/
        HomePage.tsx
        SessionPage.tsx
      components/
        VoteCard.tsx
        ParticipantList.tsx
        ResultsPanel.tsx
```

---

# Requisitos de código

* TypeScript strict mode.
* ESLint configurado.
* Sem uso de `any`.
* Funções puras sempre que possível.
* Separar regras de negócio do código de transporte WebSocket.

---

# Critérios de aceite

## Cenário 1

* Criar sessão e abrir em duas abas.
* Ambas devem ver os participantes em tempo real.

## Cenário 2

* Dois participantes votam.
* Antes da revelação, apenas “votou” aparece.

## Cenário 3

* Host revela.
* Valores corretos aparecem para todos.

## Cenário 4

* Host inicia nova rodada.
* Todos os votos desaparecem.

## Cenário 5

* Host encerra sessão.
* Todos recebem mensagem de sessão encerrada.

## Cenário 6

* Simular sessão inativa por mais de 24h.
* Sessão deve ser removida automaticamente.

---

# Não implementar neste MVP

* Login/autenticação
* Cadastro de usuários
* Banco de dados
* Persistência em arquivo
* Histórico de sessões
* Exportação
* Temas
* Integração com Jira/Azure DevOps
* Múltiplas rodadas persistidas
* Escalabilidade horizontal
* Docker/Kubernetes
* Testes E2E

---

# Resultado esperado

Ao executar:

```bash
npm install
npm run dev
```

o sistema deve abrir localmente e permitir que múltiplas pessoas acessem a mesma sessão através de um link, votem em tempo real, revelem os votos e iniciem novas rodadas, utilizando exclusivamente dados mantidos em memória no processo Node.js.
