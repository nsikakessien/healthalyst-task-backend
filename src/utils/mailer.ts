import nodemailer from "nodemailer";

interface BookingEmail {
  patientName: string;
  patientEmail: string;
  clinicName: string;
  startTime: Date;
  endTime: Date;
  reason: string;
}

interface AppointmentStatusEmail extends BookingEmail {
  status: "CONFIRMED" | "CANCELLED";
}

const getTransporter = () => {
  const host =
    process.env.SMTP_HOST ||
    (process.env.NODE_ENV !== "production" ? "localhost" : "");
  const port =
    process.env.SMTP_PORT ||
    (process.env.NODE_ENV !== "production" ? "1025" : "");
  if (!host || !port) return null;
  const auth = process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD || "" }
    : undefined;
  return nodemailer.createTransport({
    host,
    port: Number(port),
    secure: process.env.SMTP_SECURE === "true",
    ...(auth ? { auth } : {}),
  });
};

export const sendBookingConfirmation = async (booking: BookingEmail) => {
  const transporter = getTransporter();
  const from =
    process.env.SMTP_FROM ||
    (process.env.NODE_ENV !== "production"
      ? "PulseBook <appointments@localhost>"
      : "");
  if (!transporter || !from) {
    console.warn("Booking email skipped: SMTP configuration is incomplete.");
    return false;
  }

  await transporter.sendMail({
    from,
    to: booking.patientEmail,
    subject: `Appointment request received for ${booking.clinicName}`,
    text: [
      `Hello ${booking.patientName},`,
      "",
      "Your appointment request has been received and is pending clinic review.",
      `Clinic: ${booking.clinicName}`,
      `Date and time: ${booking.startTime.toLocaleString()}`,
      `Ends: ${booking.endTime.toLocaleTimeString()}`,
      `Reason: ${booking.reason}`,
      "",
      "Please arrive a few minutes early.",
    ].join("\n"),
  });
  return true;
};

export const sendAppointmentStatusEmail = async (
  appointment: AppointmentStatusEmail,
) => {
  const transporter = getTransporter();
  const from =
    process.env.SMTP_FROM ||
    (process.env.NODE_ENV !== "production"
      ? "PulseBook <appointments@localhost>"
      : "");
  if (!transporter || !from) {
    console.warn(
      "Appointment status email skipped: SMTP configuration is incomplete.",
    );
    return false;
  }

  const accepted = appointment.status === "CONFIRMED";
  await transporter.sendMail({
    from,
    to: appointment.patientEmail,
    subject: accepted
      ? `Appointment accepted by ${appointment.clinicName}`
      : `Appointment rejected by ${appointment.clinicName}`,
    text: [
      `Hello ${appointment.patientName},`,
      "",
      accepted
        ? "Your appointment request has been accepted by the clinic."
        : "Your appointment request has been rejected by the clinic.",
      `Clinic: ${appointment.clinicName}`,
      `Date and time: ${appointment.startTime.toLocaleString()}`,
      `Reason: ${appointment.reason}`,
      "",
      accepted
        ? "Please arrive a few minutes early."
        : "Please return to the patient portal to choose another available slot.",
    ].join("\n"),
  });
  return true;
};
