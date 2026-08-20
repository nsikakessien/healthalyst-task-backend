import { Router } from "express";
import { getClinics, getClinicSlots } from "../controllers/clinic.controller";

const router = Router();

router.get("/", getClinics);
router.get("/:clinicId/slots", getClinicSlots);

export default router;
