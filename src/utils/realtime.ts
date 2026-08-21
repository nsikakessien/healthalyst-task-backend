import type { Server } from "socket.io";

let socketServer: Server | undefined;

export const setSocketServer = (server: Server) => {
  socketServer = server;
};

export const emitBookingCreated = (clinicId: string, booking: unknown) => {
  socketServer?.to(`clinic:${clinicId}`).emit("booking:updated", booking);
  const patientId = (booking as { patient?: { id?: string } })?.patient?.id;
  if (patientId) {
    socketServer?.to(`patient:${patientId}`).emit("booking:updated", booking);
  }
};
