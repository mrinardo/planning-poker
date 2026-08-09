# Copilot Instructions

Você está desenvolvendo um MVP de Planning Poker em tempo real.

## Objetivo

Criar uma aplicação web simples para uso pessoal, permitindo múltiplos participantes em uma sessão compartilhada por link.

## Restrições obrigatórias

* Não usar banco de dados.
* Não usar Redis.
* Não persistir dados em disco.
* Todo o estado deve ficar em memória no processo Node.js.
* Aplicação monolítica em um único processo.
* TypeScript strict mode.
* Não usar `any`.

## Stack obrigatória

* Node.js 22+ (use .tool-versions para definir versão do Node.js para desenvolvimento local)
* Express
* Socket.IO
* React + TypeScript
* Vite

## Regras de arquitetura

* Manter regras de negócio separadas da camada HTTP/WebSocket.
* Usar `Map<string, Session>` como armazenamento global.
* Implementar limpeza automática de sessões abandonadas após 24h.
* Implementar heartbeat a cada 30s.

## Funcionalidades obrigatórias

* Criar sessão.
* Entrar em sessão.
* Votar com Fibonacci.
* Revelar votos (somente host).
* Nova rodada.
* Encerrar sessão.
* Atualização em tempo real via Socket.IO.

## Estrutura esperada

server/
client/
docs/

## Qualidade

* Código simples e legível.
* Funções pequenas.
* Tipagem explícita.
* Comentários apenas quando necessários.

## Deploy

* O script de compilação deve preparar o projeto para deploy no Vercel.
* Deve ser possível rodar o projeto localmente com `npm run dev` e acessar a aplicação em `http://localhost:5173`.
