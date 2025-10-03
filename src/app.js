import express from "express";
import cors from "cors";
import router from "./routes/main.routes.js";

const app = express();
const PORT = process.env.PORT || 8000;   // 👈 Change here

app.use(cors({ origin: "*", credentials: true, optionsSuccessStatus: 202 }));
app.use(express.json({ limit: "10mb" }));

app.use("/api", router);

app.use((req, res) => {
  return res.status(404).send({ message: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
