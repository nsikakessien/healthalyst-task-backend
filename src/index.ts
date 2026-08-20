import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.routes";
import clinicRoutes from "./routes/clinic.routes";
import bookingRoutes from "./routes/booking.routes";

dotenv.config();

const app = express();

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

export default app;
