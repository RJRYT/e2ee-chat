import React, { useState, useEffect, useContext } from "react";
import axiosInstance from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Circle, MessageSquare, Clock } from "lucide-react";

const ChatList = () => {
  const { auth } = useContext(AuthContext);
  const socket = useSocket();
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchChats = async () => {
    try {
      const res = await axiosInstance.get("/chats");
      setChats(res.data);
    } catch (err) {
      console.error("Failed to fetch chats:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChats();
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.emit("bulk-chat-message-delivered");

    const handleChatUpdated = (data) => {
      setChats((prevChats) =>
        prevChats.map((chat) =>
          chat._id === data.chatId
            ? { ...chat, lastMessage: data.lastMessage }
            : chat
        )
      );
    };

    const handleNewChat = (chat) => {
      setChats((prevChats) =>
        !prevChats.some((c) => c._id === chat._id)
          ? [chat, ...prevChats]
          : prevChats
      );
    };

    const handleUserStatus = ({ userId, online, lastActive }) => {
      setChats((prevChats) =>
        prevChats.map((chat) => ({
          ...chat,
          participants: chat.participants.map((p) =>
            p._id === userId ? { ...p, online, lastActive } : p
          ),
        }))
      );
    };

    const handleBatchDelivered = () => fetchChats();

    socket.on("chat-list-updated", handleChatUpdated);
    socket.on("new-chat", handleNewChat);
    socket.on("user-status", handleUserStatus);
    socket.on("batch-message-delivered", handleBatchDelivered);

    return () => {
      socket.off("chat-list-updated", handleChatUpdated);
      socket.off("new-chat", handleNewChat);
      socket.off("user-status", handleUserStatus);
      socket.off("batch-message-delivered", handleBatchDelivered);
    };
  }, [socket]);

  return (
    <div className="bg-white rounded-lg shadow-md p-4 w-full">
      <h3 className="text-lg font-semibold text-center mb-4">Your Chats</h3>
      {loading ? (
        <p className="text-center text-gray-500">Loading chats...</p>
      ) : chats.length === 0 ? (
        <p className="text-center text-gray-500">No active chats yet</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {chats.map((chat) => {
            const otherParticipant =
              chat.participants.find((p) => p._id !== auth.user._id) || {};
            return (
              <motion.li
                key={chat._id}
                className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-100 rounded-lg transition-all"
                onClick={() => navigate(`/chat/${chat._id}`)}
                whileTap={{ scale: 0.98 }}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800">
                      {otherParticipant.username || "Unknown"}
                    </span>
                    {otherParticipant.online ? (
                      <Circle className="w-3 h-3 text-green-500" />
                    ) : (
                      <Circle className="w-3 h-3 text-gray-400" />
                    )}
                  </div>
                  <p className="text-sm text-gray-600 truncate w-48">
                    {chat.lastMessage ? (
                      chat.lastMessage.media ? (
                        chat.lastMessage.media.type.startsWith("image") ? (
                          <span className="text-blue-500">📷 Photo</span>
                        ) : chat.lastMessage.media.type.startsWith("video") ? (
                          <span className="text-red-500">🎥 Video</span>
                        ) : (
                          <span className="text-gray-500">
                            📎 File Attachment
                          </span>
                        )
                      ) : (
                        chat.lastMessage.text
                      )
                    ) : (
                      "No messages yet"
                    )}
                  </p>
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  {chat.lastMessage ? (
                    <>
                      <Clock className="w-3 h-3" />
                      {new Date(chat.lastMessage.sentAt).toLocaleTimeString()}
                      {chat.lastMessage.status !== "seen" &&
                        chat.lastMessage.sender._id !== auth.user._id && (
                          <MessageSquare className="w-3 h-3 text-blue-500" />
                        )}
                    </>
                  ) : null}
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default ChatList;
