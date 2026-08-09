import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import cors from "cors";
import express from "express";
import { startSessionCleanup } from "./cleanup";
import { getSessionStore } from "./sessionStore";
import { createSession, getSessionPublicView, SessionServiceError } from "./sessionService";
import { createSocketServer, registerSocketHandlers } from "./socket";

const app = express();

app.use(cors());
app.use(express.json());

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

const sessionStore = getSessionStore();

app.post("/api/sessions", (req, res) => {
  if (!isRecord(req.body)) {
    res.status(400).json({ error: "Corpo da requisicao invalido." });
    return;
  }

  if (typeof req.body.name !== "string") {
    res.status(400).json({ error: "Campo 'name' deve ser uma string." });
    return;
  }

  try {
    const result = createSession(sessionStore, req.body.name);
    res.status(201).json(result);
  } catch (error: unknown) {
    if (error instanceof SessionServiceError && error.code === "INVALID_INPUT") {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: "Erro interno ao criar sessao." });
  }
});

app.get("/api/sessions/:id", (req, res) => {
  const { id } = req.params;

  if (typeof id !== "string" || id.trim().length === 0) {
    res.status(400).json({ error: "Parametro 'id' invalido." });
    return;
  }

  try {
    const session = getSessionPublicView(sessionStore, id);
    res.status(200).json(session);
  } catch (error: unknown) {
    if (error instanceof SessionServiceError && error.code === "NOT_FOUND") {
      res.status(404).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: "Erro interno ao consultar sessao." });
  }
});

const staticClientDir = path.resolve(process.cwd(), "dist/client");
if (fs.existsSync(staticClientDir)) {
  app.use(express.static(staticClientDir));

  app.get(["/", "/s/:sessionId"], (_req, res) => {
    res.sendFile(path.join(staticClientDir, "index.html"));
  });
}

app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (error instanceof SyntaxError && "status" in error) {
    res.status(400).json({ error: "JSON invalido no corpo da requisicao." });
    return;
  }

  next(error);
});

app.use((_req, res) => {
  res.status(404).json({ error: "Rota nao encontrada." });
});

const httpServer = http.createServer(app);
const io = createSocketServer(httpServer);

registerSocketHandlers(io, sessionStore);
startSessionCleanup(sessionStore);

const port = Number(process.env.PORT ?? 3000);

httpServer.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
