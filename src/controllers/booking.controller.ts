import { Response } from "express";
import { prisma } from "../utils/prisma";
import { AuthenticatedRequest } from "../middleware/authAndTenant";
import { emitBookingCreated } from "../utils/realtime";

const HOLD_TIME_MINUTES = 5;

export const holdSlot = async (req: AuthenticatedRequest, res: Response) => {
  const { slotId } = req.params;
  const userId = req.user!.id;
  const clinicId = req.tenantId!;

  try {
    const slot = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const lockedUntil = new Date(
        now.getTime() + HOLD_TIME_MINUTES * 60 * 1000,
      );

      const claimed = await tx.appointmentSlot.updateMany({
        where: {
          id: slotId,
          clinicId,
          isBooked: false,
          OR: [
            { lockedUntil: null },
            { lockedUntil: { lte: now } },
            { lockedBy: userId },
          ],
        },
        data: { lockedBy: userId, lockedUntil },
      });

      if (claimed.count === 0) {
        const target = await tx.appointmentSlot.findFirst({
          where: { id: slotId, clinicId },
          select: { id: true, isBooked: true },
        });
        if (!target) throw new Error("Slot not found in this clinic context.");
        if (target.isBooked) throw new Error("Slot has already been booked.");
        throw new Error("Slot is currently on hold by another patient.");
      }

      await tx.appointmentSlot.updateMany({
        where: {
          lockedBy: userId,
          lockedUntil: { gt: now },
          isBooked: false,
          id: { not: slotId },
        },
        data: { lockedBy: null, lockedUntil: null },
      });

      return await tx.appointmentSlot.update({
        where: { id: slotId },
        data: { lockedBy: userId, lockedUntil },
      });
    });

    return res
      .status(200)
      .json({ message: "Slot reserved on 5-minute lock", slot });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
};

export const createBooking = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  const { slotId, patientPhone, patientDateOfBirth, patientReason } = req.body;
  const userId = req.user!.id;
  const clinicId = req.tenantId!;

  if (!patientPhone || !patientDateOfBirth || !patientReason?.trim()) {
    return res.status(400).json({
      error:
        "Phone number, date of birth, and appointment reason are required.",
    });
  }

  const dateOfBirth = new Date(patientDateOfBirth);
  if (Number.isNaN(dateOfBirth.getTime())) {
    return res
      .status(400)
      .json({ error: "A valid date of birth is required." });
  }

  try {
    const booking = await prisma.$transaction(async (tx) => {
      const slot = await tx.appointmentSlot.findFirst({
        where: { id: slotId, clinicId },
      });

      if (!slot) throw new Error("Slot not found or tenant mismatch.");
      if (slot.isBooked) throw new Error("Slot has already been confirmed.");

      const now = new Date();
      if (
        slot.lockedBy &&
        slot.lockedBy !== userId &&
        slot.lockedUntil &&
        slot.lockedUntil > now
      ) {
        throw new Error("Reservation lock belongs to another user.");
      }

      await tx.appointmentSlot.update({
        where: { id: slotId },
        data: { isBooked: true, lockedBy: null, lockedUntil: null },
      });

      return await tx.booking.create({
        data: {
          clinicId,
          patientId: userId,
          patientPhone,
          patientDateOfBirth: dateOfBirth,
          patientReason: patientReason.trim(),
          slotId,
          status: "CONFIRMED",
        },
        include: {
          patient: { select: { id: true, name: true, email: true } },
          slot: true,
          clinic: true,
        },
      });
    });

    emitBookingCreated(clinicId, booking);

    return res.status(201).json(booking);
  } catch (error: any) {
    return res.status(409).json({ error: error.message });
  }
};

export const getAdminBookings = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  const clinicId = req.user?.clinicId;

  if (!clinicId || req.user?.role !== "ADMIN") {
    return res
      .status(403)
      .json({ error: "Access denied. Clinic Admin access only." });
  }

  const bookings = await prisma.booking.findMany({
    where: { clinicId },
    include: {
      patient: { select: { id: true, name: true, email: true } },
      slot: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return res.status(200).json(bookings);
};
