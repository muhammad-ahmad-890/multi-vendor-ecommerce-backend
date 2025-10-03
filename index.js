import express from "express";
import dotenv from "dotenv";
import prisma from "./prisma/index.js";
import cors from "cors";
import userRoutes from "./src/routes/authRoutes.js";
import customerRoutes from "./src/routes/customerRoutes.js";
import adminRoutes from "./src/routes/adminRoutes.js";
import webPortalRoutes from "./src/routes/webPortalRoutes.js";
import publicRoutes from "./src/routes/publicRoutes.js";

dotenv.config();
const app = express();

const allowedOrigins = [
	"http://localhost:5173",
	"http://127.0.0.1:5173",
	process.env.WEB_ORIGIN || null,
].filter(Boolean);

const corsOptions = {
	origin: function (origin, callback) {
		if (!origin) return callback(null, true);
		if (allowedOrigins.includes(origin)) return callback(null, true);
		return callback(new Error("Not allowed by CORS"));
	},
	credentials: true,
	methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
	allowedHeaders: [
		"Content-Type",
		"Authorization",
		"X-Requested-With",
		"Accept",
	],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.get("/health", async (req, res) => {
	try {
		await prisma.$queryRaw`SELECT 1`;
		res.json({
			status: "success",
			message: "Server and database are running",
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Database health check failed:", error);
		res.status(500).json({
			status: "error",
			message: "Database connection failed",
			timestamp: new Date().toISOString(),
		});
	}
});

async function startServer() {
	try {
		await prisma.$connect();
		await prisma.$queryRaw`SELECT 1`;
		console.log("Database connected successfully");

		const PORT = process.env.PORT || 3000;
		app.listen(PORT, () => {
			console.log(`Server running on port ${PORT}`);
			console.log(`Health check: http://localhost:${PORT}/health`);
		});
	} catch (error) {
		console.error("Failed to start server:", error);
		process.exit(1);
	}
}

const gracefulShutdown = async () => {
	console.log("Shutting down gracefully...");
	await prisma.$disconnect();
	process.exit(0);
};

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

startServer();