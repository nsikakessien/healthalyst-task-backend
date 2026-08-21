import { Router } from "express";
import {
  holdSlot,
  createBooking,
  getAdminBookings,
  getPatientBookings,
  updateBookingStatus,
} from "../controllers/booking.controller";
import {
  authenticateJWT,
  requireRole,
  requireTenant,
} from "../middleware/authAndTenant";

const router = Router();

router.post(
  "/slots/:slotId/hold",
  authenticateJWT,
  requireRole("PATIENT"),
  requireTenant,
  holdSlot,
);
router.post(
  "/",
  authenticateJWT,
  requireRole("PATIENT"),
  requireTenant,
  createBooking,
);
router.get("/admin", authenticateJWT, requireRole("ADMIN"), getAdminBookings);
router.get(
  "/history",
  authenticateJWT,
  requireRole("PATIENT"),
  getPatientBookings,
);
router.patch(
  "/:bookingId/status",
  authenticateJWT,
  requireRole("ADMIN"),
  updateBookingStatus,
);

export default router;
