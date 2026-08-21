import type { Server } from "socket.io";

let socketServer: Server | undefined;

export const setSocketServer = (server: Server) => {
  socketServer = server;
};

export const emitBookingCreated = (clinicId: string, booking: unknown) => {
  socketServer?.to(`clinic:${clinicId}`).emit("booking:created", booking);
};
