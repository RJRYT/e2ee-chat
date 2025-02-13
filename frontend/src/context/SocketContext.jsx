// src/context/SocketContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { AuthContext } from "./AuthContext";

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const { auth } = useContext(AuthContext);

  useEffect(() => {
    if (auth && auth.token) {
      const newSocket = io(import.meta.env.VITE_SOCKET_URL, {
        auth: { token: auth.token },
      });

      // Patch the emit method to log outgoing events
      const originalEmit = newSocket.emit;
      newSocket.emit = function (event, ...args) {
        console.log(`[Socket] Outgoing event: ${event}`, args);
        originalEmit.apply(newSocket, [event, ...args]);
      };

      setSocket(newSocket);

      newSocket.on("connect", () => {
        console.log("[Server]: Connection established");
      });

      newSocket.on("connect_error", (error) => {
        if (newSocket.active) {
          console.log(
            "[Server]: A temporary failure occoured. will reconnect."
          );
        } else {
          console.log("[Server]: An error occoured on connection ", error);
        }
      });

      newSocket.on("disconnect", (reason, details) => {
        console.log("[Server]: Disconnected...!");
        console.log("[Server]: reason: ", reason);
      });

      newSocket.onAny((eventname, ...args) => {
        console.log(`[Server]: Event triggered: ${eventname} `, ...args);
      });

      return () => {
        newSocket.close()
        setSocket(null);
      };
    } else {
      // If not authenticated, ensure any existing socket is disconnected
      if (socket) {
        console.log("[Socket] No auth found, disconnecting socket");
        socket.close();
        setSocket(null);
      }
    }
  }, [auth]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
};
