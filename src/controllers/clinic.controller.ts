import { Request, Response } from "express";
import { prisma } from "../utils/prisma";
import { AuthenticatedRequest } from "../middleware/authAndTenant";

export const getClinics = async (_req: Request, res: Response) => {
  const clinics = await prisma.clinic.findMany({
    select: { id: true, name: true, slug: true, address: true },
  });
  return res.status(200).json(clinics);
};

export const getClinicSlots = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  const { clinicId } = req.params;

  const slots = await prisma.appointmentSlot.findMany({
    where: { clinicId },
    orderBy: { startTime: "asc" },
  });

  return res.status(200).json(
    slots.map((slot) => ({
      ...slot,
      // Patients may restore their own hold, but never receive another user's ID.
      lockedBy:
        slot.lockedBy && slot.lockedBy === req.user?.id
          ? slot.lockedBy
          : slot.lockedBy
            ? "OTHER"
            : null,
    })),
  );
};
