import { Response } from "express";
import { prisma } from "../utils/prisma";
import { AuthenticatedRequest } from "../middleware/authAndTenant";
import { emitBookingCreated } from "../utils/realtime";
import {
  sendAppointmentStatusEmail,
  sendBookingConfirmation,
} from "../utils/mailer";

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
  const {
    slotId,
    patientEmail,
    patientPhone,
    patientDateOfBirth,
    patientReason,
  } = req.body;
  const userId = req.user!.id;
  const clinicId = req.tenantId!;

  if (
    !patientEmail ||
    !patientPhone ||
    !patientDateOfBirth ||
    !patientReason?.trim()
  ) {
    return res.status(400).json({
      error:
        "Email, phone number, date of birth, and appointment reason are required.",
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patientEmail.trim())) {
    return res.status(400).json({
      error:
        "Please provide a valid email address for appointment notifications.",
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
      const now = new Date();
      const claim = await tx.appointmentSlot.updateMany({
        where: {
          id: slotId,
          clinicId,
          isBooked: false,
          lockedBy: userId,
          lockedUntil: { gt: now },
        },
        data: { isBooked: true, lockedBy: null, lockedUntil: null },
      });

      if (claim.count === 0) {
        const slot = await tx.appointmentSlot.findFirst({
          where: { id: slotId, clinicId },
          select: {
            id: true,
            isBooked: true,
            lockedBy: true,
            lockedUntil: true,
          },
        });
        if (!slot) throw new Error("Slot not found or tenant mismatch.");
        if (slot.isBooked) throw new Error("Slot has already been confirmed.");
        if (slot.lockedUntil && slot.lockedUntil > now) {
          throw new Error(
            "You must hold this slot before confirming it, and another patient's hold cannot be used.",
          );
        }
        throw new Error(
          "This slot hold has expired. Please select the slot again.",
        );
      }

      const slot = await tx.appointmentSlot.findUnique({
        where: { id: slotId },
        select: { startTime: true, endTime: true },
      });
      if (!slot) throw new Error("Slot not found or tenant mismatch.");

      return await tx.booking.create({
        data: {
          clinicId,
          patientId: userId,
          patientEmail: patientEmail.trim().toLowerCase(),
          patientPhone,
          patientDateOfBirth: dateOfBirth,
          patientReason: patientReason.trim(),
          slotId,
          appointmentStart: slot.startTime,
          appointmentEnd: slot.endTime,
          status: "PENDING",
        },
        include: {
          patient: { select: { id: true, name: true, email: true } },
          slot: true,
          clinic: true,
        },
      });
    });

    emitBookingCreated(clinicId, booking);
    let emailSent = false;
    if (booking.slot) {
      try {
        emailSent = await sendBookingConfirmation({
          patientName: booking.patient.name,
          patientEmail: booking.patientEmail || booking.patient.email,
          clinicName: booking.clinic.name,
          startTime: booking.slot.startTime,
          endTime: booking.slot.endTime,
          reason: booking.patientReason || "General consultation",
        });
      } catch (emailError) {
        console.error(
          "Booking created but confirmation email failed:",
          emailError,
        );
      }
    }

    return res.status(201).json({ ...booking, emailSent });
  } catch (error: any) {
    return res.status(409).json({ error: error.message });
  }
};

export const getPatientBookings = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  const bookings = await prisma.booking.findMany({
    where: { patientId: req.user!.id },
    include: { clinic: true, slot: true },
    orderBy: { createdAt: "desc" },
  });
  return res.status(200).json(bookings);
};

export const updateBookingStatus = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  const { bookingId } = req.params;
  const { status } = req.body as { status?: "CONFIRMED" | "CANCELLED" };
  const clinicId = req.user?.clinicId;

  if (!clinicId || req.user?.role !== "ADMIN") {
    return res.status(403).json({ error: "Clinic admin access required." });
  }
  if (status !== "CONFIRMED" && status !== "CANCELLED") {
    return res
      .status(400)
      .json({ error: "Status must be CONFIRMED or CANCELLED." });
  }

  try {
    const booking = await prisma.$transaction(async (tx) => {
      const existing = await tx.booking.findFirst({
        where: { id: bookingId, clinicId },
        include: { slot: true },
      });
      if (!existing) throw new Error("Appointment not found in your clinic.");
      if (existing.status !== "PENDING")
        throw new Error("Only pending appointments can be reviewed.");

      if (
        status === "CANCELLED" &&
        existing.slot &&
        existing.slot.startTime > new Date()
      ) {
        await tx.appointmentSlot.update({
          where: { id: existing.slot.id },
          data: { isBooked: false, lockedBy: null, lockedUntil: null },
        });
        return tx.booking.update({
          where: { id: bookingId },
          data: { status, slot: { disconnect: true } },
          include: {
            patient: { select: { id: true, name: true, email: true } },
            clinic: true,
            slot: true,
          },
        });
      }

      return tx.booking.update({
        where: { id: bookingId },
        data: { status },
        include: {
          patient: { select: { id: true, name: true, email: true } },
          clinic: true,
          slot: true,
        },
      });
    });

    emitBookingCreated(clinicId, booking);
    try {
      await sendAppointmentStatusEmail({
        patientName: booking.patient.name,
        patientEmail: booking.patientEmail || booking.patient.email,
        clinicName: booking.clinic.name,
        startTime: booking.appointmentStart,
        endTime: booking.appointmentEnd,
        reason: booking.patientReason || "General consultation",
        status,
      });
    } catch (emailError) {
      console.error(
        "Appointment status updated but notification email failed:",
        emailError,
      );
    }
    return res.status(200).json(booking);
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
