import nodemailer from "nodemailer";

interface BookingEmail {
  patientName: string;
  patientEmail: string;
  clinicName: string;
  startTime: Date;
  endTime: Date;
  reason: string;
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
