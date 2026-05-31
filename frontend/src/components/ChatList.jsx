import React, { useState, useEffect, useContext } from "react";
import axiosInstance from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FaCircle, FaClock } from "react-icons/fa";
import { BiSolidMessageRounded } from "react-icons/bi";
import { decryptWithAES } from "../utils/ECDH";
import { getRecipientAESKey } from "../utils/getkeys";

const ChatList = () => {
  const { auth, refreshKeyState } = useContext(AuthContext);
  const socket = useSocket();
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typingByChat, setTypingByChat] = useState({});

  async function decryptChatLastMessage(chat) {
    if (!chat?.lastMessage) return chat;

    if (!chat.lastMessage.encryptedText) {
      return {
        ...chat,
        lastMessage: {
          ...chat.lastMessage,
          text: chat.lastMessage.text || "",
          decrypted: Boolean(chat.lastMessage.text),
        },
      };
    }

    const otherUser =
      chat.participants[0]._id.toString() === auth.user._id
        ? chat.participants[1]
        : chat.participants[0];

    try {
      const aesKey = await getRecipientAESKey(otherUser._id, auth.user._id);
      const decryptedText = await decryptWithAES(
        aesKey,
        chat.lastMessage.encryptedText
      );
      return {
        ...chat,
        lastMessage: {
          ...chat.lastMessage,
          text: decryptedText,
          decrypted: true,
        },
      };
    } catch (err) {
      return {
        ...chat,
        lastMessage: {
          ...chat.lastMessage,
          text: "unknown message",
          decrypted: false,
        },
      };
    }
  }

  async function updateChatWithDecryptedLastMessage(chat, lastMessage) {
    const otherUser =
      chat.participants[0]._id.toString() === auth.user._id
        ? chat.participants[1]
        : chat.participants[0];

    try {
      if (!lastMessage?.encryptedText) {
        const updatedChat = {
          ...chat,
          lastMessage: {
            ...lastMessage,
            text: lastMessage?.text || "",
            decrypted: Boolean(lastMessage?.text),
          },
        };
        setChats((prev) =>
          prev.map((c) => (c._id === chat._id ? updatedChat : c))
        );
        return;
      }

      const aesKey = await getRecipientAESKey(otherUser._id, auth.user._id);
      const decryptedText = await decryptWithAES(
        aesKey,
        lastMessage.encryptedText
      );
      const updatedChat = {
        ...chat,
        lastMessage: { ...lastMessage, text: decryptedText, decrypted: true },
      };
      setChats((prev) =>
        prev.map((c) => (c._id === chat._id ? updatedChat : c))
      );
    } catch (err) {}
  }

  const fetchChats = async () => {
    try {
      const res = await axiosInstance.get("/chats");
      const chatsWithDecryptedLastMsg = await Promise.all(
        res.data.map((chat) => decryptChatLastMessage(chat))
      );
      setChats(chatsWithDecryptedLastMsg);
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
    if (auth?.key === false) {
      refreshKeyState(auth.user);
    }
  }, [auth?.key, auth?.user?._id]);

  useEffect(() => {
    if (!socket) return;
    socket.emit("bulk-chat-message-delivered");

    const handleChatUpdated = (data) => {
      if (data?.chatId) {
        setTypingByChat((prev) => ({ ...prev, [data.chatId]: false }));
      }
      setChats((prevChats) => {
        const chatToUpdate = prevChats.find((chat) => chat._id === data.chatId);
        if (chatToUpdate && data.lastMessage) {
          updateChatWithDecryptedLastMessage(chatToUpdate, data.lastMessage);
        }
        return prevChats;
      });
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
    const handleChatTyping = ({ chatId }) => {
      if (!chatId) return;
      setTypingByChat((prev) => ({ ...prev, [chatId]: true }));
    };
    const handleChatStopTyping = ({ chatId }) => {
      if (!chatId) return;
      setTypingByChat((prev) => ({ ...prev, [chatId]: false }));
    };

    socket.on("chat-list-updated", handleChatUpdated);
    socket.on("new-chat", handleNewChat);
    socket.on("user-status", handleUserStatus);
    socket.on("batch-message-delivered", handleBatchDelivered);
    socket.on("chat-typing", handleChatTyping);
    socket.on("chat-stop-typing", handleChatStopTyping);

    return () => {
      socket.off("chat-list-updated", handleChatUpdated);
      socket.off("new-chat", handleNewChat);
      socket.off("user-status", handleUserStatus);
      socket.off("batch-message-delivered", handleBatchDelivered);
      socket.off("chat-typing", handleChatTyping);
      socket.off("chat-stop-typing", handleChatStopTyping);
    };
  }, [socket]);

  return (
    <div className="bg-white rounded-lg shadow-md p-4 w-full">
      <h3 className="text-lg font-semibold text-center mb-4">Your Chats</h3>
      {loading ? (
        <p className="text-center text-gray-500">Loading chats...</p>
      ) : auth?.key === false ? (
        <div className="text-center text-gray-600 space-y-3">
          <p>Your encryption key is not available on this device.</p>
          <div className="flex justify-center gap-2">
            <button
              className="px-3 py-2 rounded bg-blue-500 text-white"
              onClick={() => navigate("/recover")}
            >
              Recover Key
            </button>
            <button
              className="px-3 py-2 rounded bg-gray-200 text-gray-800"
              onClick={() => navigate("/pair")}
            >
              Pair Device
            </button>
          </div>
        </div>
      ) : chats.length === 0 ? (
        <p className="text-center text-gray-500">No active chats yet</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {chats.map((chat) => {
            const otherParticipant =
              chat.participants.find((p) => p._id !== auth.user._id) || {};
            const mediaType = chat?.lastMessage?.media?.type || "";
            const isTyping = Boolean(typingByChat[chat._id]);

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
                      <FaCircle className="w-3 h-3 text-green-500" />
                    ) : (
                      <FaCircle className="w-3 h-3 text-gray-400" />
                    )}
                  </div>
                  <p className="text-sm text-gray-600 truncate w-48">
                    {isTyping ? (
                      <span className="text-green-600 italic">Typing...</span>
                    ) : chat.lastMessage ? (
                      chat.lastMessage.media ? (
                        mediaType.startsWith("image") ? (
                          <span className="text-blue-500">Photo</span>
                        ) : mediaType.startsWith("video") ? (
                          <span className="text-red-500">Video</span>
                        ) : mediaType === "voice" || mediaType === "audio" ? (
                          <span className="text-green-600">Audio</span>
                        ) : (
                          <span className="text-gray-500">File Attachment</span>
                        )
                      ) : (
                        chat.lastMessage.text || "Message"
                      )
                    ) : (
                      "No messages yet"
                    )}
                  </p>
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  {chat.lastMessage ? (
                    <>
                      <FaClock className="w-3 h-3" />
                      {new Date(chat.lastMessage.sentAt).toLocaleTimeString()}
                      {chat.lastMessage.status !== "seen" &&
                        chat.lastMessage.sender?._id !== auth.user._id && (
                          <BiSolidMessageRounded className="w-3 h-3 text-blue-500" />
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
