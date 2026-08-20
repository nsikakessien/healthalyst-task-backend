import { Router } from "express";
import {
  holdSlot,
  createBooking,
  getAdminBookings,
} from "../controllers/booking.controller";
import { authenticateJWT, requireTenant } from "../middleware/authAndTenant";

const router = Router();

router.post("/slots/:slotId/hold", authenticateJWT, requireTenant, holdSlot);
router.post("/", authenticateJWT, requireTenant, createBooking);
router.get("/admin", authenticateJWT, requireTenant, getAdminBookings);

export default router;
