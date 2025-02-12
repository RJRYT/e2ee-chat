import React, { useState, useEffect, useRef, useContext } from "react";
import axiosInstance from "../services/api";
import { Picker } from "emoji-mart";
import "emoji-mart/css/emoji-mart.css";
import { AuthContext } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";

const ChatWindow = ({ chatId }) => {
  const { auth } = useContext(AuthContext);
  const socket = useSocket(); // Use shared socket from context
  const [messages, setMessages] = useState([]);
  const [activeMenu, setActiveMenu] = useState(null);
  const [messageText, setMessageText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [skip, setSkip] = useState(0);
  const limit = 20;
  const messagesEndRef = useRef(null);
  const [hasMore, setHasMore] = useState(true);
  const scrollTimeoutRef = useRef(null);

  // Join the chat room when the component mounts
  useEffect(() => {
    if (socket) {
      fetchMessages(true).then(() => {
        scrollToBottom();
      });
      socket.emit("join-chat", chatId);
      socket.emit("batch-message-seen", { chatId });
      // When the socket reconnects, re-join the chat room
      const handleReconnect = () => {
        console.log("Socket reconnected, rejoining chat room", chatId);
        socket.emit("join-chat", chatId);
      };

      socket.on("reconnect", handleReconnect);
      return () => {
        socket.off("reconnect", handleReconnect);
      };
    }
  }, [chatId, socket]);

  const fetchMessages = async (reset = false) => {
    try {
      const response = await axiosInstance.get(
        `/chats/${chatId}/messages?skip=${reset ? 0 : skip}&limit=${limit}`
      );
      if (reset) {
        setMessages(response.data.messages);
        setSkip(response.data.messages.length);
        setHasMore(response.data.hasMore);
      } else {
        setMessages((prev) => [...response.data.messages, ...prev]);
        setSkip(skip + response.data.messages.length);
        setHasMore(response.data.hasMore);
      }
    } catch (err) {
      console.error("Failed to fetch messages", err);
    }
  };

  const handleChatScroll = (e) => {
    const scrollTop = e.target.scrollTop;
    if (scrollTop < 10 && hasMore) {
      if (!scrollTimeoutRef.current) {
        scrollTimeoutRef.current = setTimeout(() => {
          fetchMessages();
          scrollTimeoutRef.current = null;
        }, 500); // 500ms debounce interval
      }
    }
  };

  // When a message becomes visible (or via a "mark as seen" action):
  const markMessageSeen = (messageId) => {
    if (socket) {
      const msg = messages.find((msg) => msg._id === messageId);
      if (msg.sender._id !== auth.user._id) {
        socket.emit("message-seen", { messageId, chatId });
      }
    }
  };

  useEffect(() => {
    if (!socket) return;

    const handleChatMessage = (msg) => {
      if (msg.chat === chatId) {
        setMessages((prev) => [...prev, msg]);
        // Immediately acknowledge delivery back to server
        if (msg.sender._id !== auth.user._id) {
          socket.emit("message-delivered", { messageId: msg._id, chatId });
        }
        // Auto-scroll only if the message is sent by the current user
        if (msg.sender._id === auth.user._id) {
          scrollToBottom();
        }
      }
    };
    const handleBatchMessageSeen = ({ messageIds }) => {
      console.log("[Socket] Batch message seen event received:", messageIds);
      setMessages((prevMessages) =>
        prevMessages.map((msg) => {
          if (messageIds.includes(msg._id)) {
            return {
              ...msg,
              status: "seen",
              seenAt: new Date(), // current time
            };
          }
          return msg;
        })
      );
    };

    const handleMessageRead = ({ messageId }) => {
      console.log("Message read:", messageId);
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg._id === messageId
            ? { ...msg, status: "seen", seenAt: new Date() }
            : msg
        )
      );
    };

    const handleTyping = ({ userId }) => {
      if (userId !== auth.user.id && !typingUsers.includes(userId)) {
        setTypingUsers((prev) => [...prev, userId]);
      }
    };
    const handleStopTyping = ({ userId }) => {
      setTypingUsers((prev) => prev.filter((id) => id !== userId));
    };

    socket.on("new-message", handleChatMessage);
    socket.on("message-seen", handleMessageRead);
    socket.on("typing", handleTyping);
    socket.on("stopTyping", handleStopTyping);
    socket.on("batch-message-seen", handleBatchMessageSeen);

    return () => {
      socket.off("new-message", handleChatMessage);
      socket.off("message-seen", handleMessageRead);
      socket.off("typing", handleTyping);
      socket.off("stopTyping", handleStopTyping);
      socket.off("batch-message-seen", handleBatchMessageSeen);
    };
  }, [chatId, auth, socket, typingUsers]);

  const handleSend = async () => {
    try {
      await axiosInstance.post(`/chats/${chatId}/message`, {
        text: messageText,
        replyTo,
      });
      setMessageText("");
      setReplyTo(null);
      if (socket) {
        socket.emit("stopTyping", { chatId });
      }
      scrollToBottom();
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  const handleEmojiSelect = (emoji) => {
    setMessageText((prev) => prev + emoji.native);
    setShowEmojiPicker(false);
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 500);
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="p-4 bg-white shadow flex justify-between items-center">
        <h3 className="text-lg font-bold">Chat Room</h3>
        <button onClick={() => window.history.back()} className="text-blue-500">
          Back
        </button>
      </div>
      <div className="flex-1 overflow-y-scroll p-4" onScroll={handleChatScroll}>
        {messages.map((msg) => (
          <MessageItem
            key={msg._id}
            msg={msg}
            onSeen={markMessageSeen}
            activeMenu={activeMenu}
            setActiveMenu={setActiveMenu}
          />
        ))}

        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 bg-white">
        {typingUsers.length > 0 && (
          <div className="mb-2 text-sm text-gray-600">Typing...</div>
        )}
        <div className="flex items-center space-x-2">
          <textarea
            value={messageText}
            onChange={(e) => {
              setMessageText(e.target.value);
              if (socket) socket.emit("typing", { chatId });
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

const MessageItem = ({ msg, onSeen, activeMenu, setActiveMenu }) => {
  const ref = useRef();
  const { auth } = useContext(AuthContext);

  useEffect(() => {
    // Only observe if message is not already seen
    if (msg.status === "sent" || msg.status === "delivered") {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            onSeen(msg._id);
            // Once seen, unobserve so we don't call it repeatedly
            observer.unobserve(entry.target);
          }
        },
        { threshold: 0.5 } // Adjust threshold as needed
      );
      if (ref.current) observer.observe(ref.current);
      return () => observer.disconnect();
    }
  }, [msg, onSeen]);

  return (
    <div ref={ref} className="mb-4 relative">
      <div className="flex justify-between items-center">
        {/* Display the sender's name */}
        <span className="font-semibold">{msg.sender.username}</span>
        <div className="flex items-center">
          {msg.edited && <span> (edited)</span>}
          <span className="text-sm text-gray-500">
            {new Date(msg.sentAt).toLocaleTimeString()}
          </span>
          <span className="mx-2 text-sm text-gray-500">
            {msg.sender._id === auth.user._id
              ? msg.status
              : ""}
          </span>
          {/* Three dots button to toggle popup menu */}
          <button
            onClick={() =>
              setActiveMenu(activeMenu === msg._id ? null : msg._id)
            }
            className="mx-2 text-gray-500 focus:outline-none"
          >
            &#8942;
          </button>
        </div>
      </div>
      <div className="bg-gray-200 p-2 rounded">
        {msg.deleted ? "This message was deleted" : msg.text}
      </div>
      {/* Popup menu */}
      {activeMenu === msg._id && (
        <div className="absolute right-0 mt-1 bg-white border rounded shadow-lg p-2 z-10">
          {msg.sender._id === auth.user._id && (
            <div className="text-xs text-gray-400 mb-2 flex flex-col gap-2">
              <span>Sent: {new Date(msg.sentAt).toLocaleString()}</span>
              {msg.deliveredAt && (
                <span>
                  Delivered: {new Date(msg.deliveredAt).toLocaleString()}
                </span>
              )}
              {msg.seenAt && (
                <span>Seen: {new Date(msg.seenAt).toLocaleString()}</span>
              )}
            </div>
          )}
          <div className="flex flex-row gap-2">
            <button
              onClick={() => {
                setReplyTo(msg._id);
                setActiveMenu(null);
              }}
              className="text-blue-500 text-sm text-left"
            >
              Reply
            </button>
            {msg.sender._id === auth.user._id && (
              <>
                <button
                  onClick={() => {
                    // Implement edit functionality here
                    setActiveMenu(null);
                  }}
                  className="text-blue-500 text-sm text-left"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    // Implement delete functionality here
                    setActiveMenu(null);
                  }}
                  className="text-red-500 text-sm text-left"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
