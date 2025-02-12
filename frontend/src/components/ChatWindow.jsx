import React, { useState, useEffect, useRef, useContext } from "react";
import axiosInstance from "../services/api";
import io from "socket.io-client";
import { Picker } from "emoji-mart";
import "emoji-mart/css/emoji-mart.css";
import { AuthContext } from "../context/AuthContext";

const socket = io(import.meta.env.VITE_SOCKET_URL, {
  auth: { token: localStorage.getItem("token") },
});

const ChatWindow = ({ chatId }) => {
  const { auth } = useContext(AuthContext);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [skip, setSkip] = useState(0);
  const limit = 20;
  const messagesEndRef = useRef(null);

  const fetchMessages = async (reset = false) => {
    try {
      const response = await axiosInstance.get(
        `/chats/${chatId}/messages?skip=${reset ? 0 : skip}&limit=${limit}`
      );
      if (reset) {
        setMessages(response.data);
        setSkip(response.data.length);
      } else {
        setMessages((prev) => [...response.data, ...prev]);
        setSkip(skip + response.data.length);
      }
    } catch (err) {
      console.error("Failed to fetch messages", err);
    }
  };

  useEffect(() => {
    fetchMessages(true);
  }, [chatId]);

  useEffect(() => {
    socket.on("chat-message", (msg) => {
      if (msg.chat === chatId) {
        setMessages((prev) => [...prev, msg]);
      }
    });
    socket.on("typing", ({ userId }) => {
      if (userId !== auth.user.id && !typingUsers.includes(userId)) {
        setTypingUsers((prev) => [...prev, userId]);
      }
    });
    socket.on("stopTyping", ({ userId }) => {
      setTypingUsers((prev) => prev.filter((id) => id !== userId));
    });
    return () => {
      socket.off("chat-message");
      socket.off("typing");
      socket.off("stopTyping");
    };
  }, [chatId, auth, typingUsers]);

  const handleSend = async () => {
    try {
      await axiosInstance.post(`/chats/${chatId}/message`, {
        text: messageText,
        replyTo,
      });
      setMessageText("");
      setReplyTo(null);
      socket.emit("stopTyping", { chatId });
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  const handleEmojiSelect = (emoji) => {
    setMessageText((prev) => prev + emoji.native);
    setShowEmojiPicker(false);
  };

  const handleScroll = (e) => {
    if (e.target.scrollTop === 0) {
      fetchMessages();
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="p-4 bg-white shadow flex justify-between items-center">
        <h3 className="text-lg font-bold">Chat</h3>
        <button onClick={() => window.history.back()} className="text-blue-500">
          Back
        </button>
      </div>
      <div className="flex-1 overflow-y-scroll p-4" onScroll={handleScroll}>
        {messages.map((msg) => (
          <div key={msg._id} className="mb-4">
            <div className="flex justify-between">
              <span className="font-semibold">
                {msg.sender === auth.user.id ? "Me" : "Them"}
              </span>
              <span className="text-sm text-gray-500">
                {new Date(msg.sentAt).toLocaleTimeString()}
              </span>
            </div>
            <div className="bg-gray-200 p-2 rounded">
              {msg.deleted ? "This message was deleted" : msg.text}
            </div>
            <div className="text-xs text-gray-400">
              Sent: {new Date(msg.sentAt).toLocaleString()}
              {msg.deliveredAt &&
                ` | Delivered: ${new Date(msg.deliveredAt).toLocaleString()}`}
              {msg.seenAt &&
                ` | Seen: ${new Date(msg.seenAt).toLocaleString()}`}
              {msg.edited && " (edited)"}
            </div>
            <div className="flex space-x-2 mt-1">
              <button
                className="text-blue-500 text-sm"
                onClick={() => setReplyTo(msg._id)}
              >
                Reply
              </button>
              {msg.sender === auth.user.id && (
                <>
                  <button className="text-blue-500 text-sm">Edit</button>
                  <button className="text-red-500 text-sm">Delete</button>
                </>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 bg-white">
        {typingUsers.length > 0 && (
          <div className="mb-2 text-sm text-gray-600">Someone is typing...</div>
        )}
        <div className="flex items-center space-x-2">
          <textarea
            value={messageText}
            onChange={(e) => {
              setMessageText(e.target.value);
              socket.emit("typing", { chatId });
            }}
            placeholder="Type your message"
            className="flex-1 border rounded p-2"
          />
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 border rounded"
          >
            😊
          </button>
          <button
            onClick={handleSend}
            className="bg-blue-500 text-white p-2 rounded"
          >
            Send
          </button>
        </div>
        {showEmojiPicker && (
          <Picker
            onSelect={handleEmojiSelect}
            style={{ position: "absolute", bottom: "80px", right: "20px" }}
          />
        )}
      </div>
    </div>
  );
};

export default ChatWindow;
