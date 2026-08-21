import express from "express";
import { createServer } from "http";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";

import authRoutes from "./routes/auth.routes";
import clinicRoutes from "./routes/clinic.routes";
import bookingRoutes from "./routes/booking.routes";
import { setSocketServer } from "./utils/realtime";

dotenv.config();

const app = express();
const httpServer = createServer(app);

app.use(cookieParser());

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    message: "API is running",
  });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/clinics", clinicRoutes);
app.use("/api/v1/bookings", bookingRoutes);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  },
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Authentication token required."));
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET || "supersecret") as {
      role?: string;
      clinicId?: string;
    };
    if (user.role !== "ADMIN" || !user.clinicId) {
      return next(new Error("Admin access required."));
    }
    socket.data.user = user;
    next();
  } catch {
    next(new Error("Invalid or expired authentication token."));
  }
});

io.on("connection", (socket) => {
  socket.join(`clinic:${socket.data.user.clinicId}`);
});
setSocketServer(io);

if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5000;
  httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

export default app;
