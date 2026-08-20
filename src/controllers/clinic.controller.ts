import { Request, Response } from "express";
import { prisma } from "../utils/prisma";

export const getClinics = async (_req: Request, res: Response) => {
  const clinics = await prisma.clinic.findMany({
    select: { id: true, name: true, slug: true, address: true },
  });
  return res.status(200).json(clinics);
};

export const getClinicSlots = async (req: Request, res: Response) => {
  const { clinicId } = req.params;

  const slots = await prisma.appointmentSlot.findMany({
    where: { clinicId },
    orderBy: { startTime: "asc" },
  });

  return res.status(200).json(slots);
};
