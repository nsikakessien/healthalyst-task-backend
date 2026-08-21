import { Router } from "express";
import { getClinics, getClinicSlots } from "../controllers/clinic.controller";
import { authenticateJWT, requireRole } from "../middleware/authAndTenant";

const router = Router();

router.get("/", authenticateJWT, requireRole("PATIENT"), getClinics);
router.get(
  "/:clinicId/slots",
  authenticateJWT,
  requireRole("PATIENT"),
  getClinicSlots,
);

export default router;
