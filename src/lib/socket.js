import { io } from "socket.io-client";
let socket = null;

export function connectLiveSocket() {
  if (socket && socket.connected) return socket;
  socket = io((process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000") + "/live", {
    autoConnect: false,
    transports: ["websocket"],
  });
  socket.connect();
  return socket;
}

export function getSocket() {
  return socket;
}
