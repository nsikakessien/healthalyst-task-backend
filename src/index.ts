import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes";
import clinicRoutes from "./routes/clinic.routes";
import bookingRoutes from "./routes/booking.routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cookieParser());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true, // Required to allow cookies across origins
  }),
);
app.use(express.json());

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/clinics", clinicRoutes);
app.use("/api/v1/bookings", bookingRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
