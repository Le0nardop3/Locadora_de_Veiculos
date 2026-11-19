import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes";
import vehicleRoutes from "./routes/vehicleRoutes";
import locacaoRoutes from "./routes/locacaoRoutes";

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", mensagem: "API de locação está funcionando." });
});

app.use("/auth", authRoutes);
app.use("/vehicles", vehicleRoutes);
app.use("/locacoes", locacaoRoutes);

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`API executando em http://localhost:${port}`);
});
