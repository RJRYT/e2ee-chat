import React, { useState, useEffect, useRef, useContext } from "react";
import { FaEllipsisH, FaPaperPlane } from "react-icons/fa";
import axiosInstance from "../services/api";
import { Picker } from "emoji-mart";
import "emoji-mart/css/emoji-mart.css";
import { AuthContext } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import MultimediaUpload from "./MultimediaUpload";

const ChatWindow = ({ chatId }) => {
  const { auth } = useContext(AuthContext);
  const socket = useSocket(); // Use shared socket from context
  const [messages, setMessages] = useState([]);
  const [activeMenu, setActiveMenu] = useState(null);
  const [messageText, setMessageText] = useState("");
  const [sender, setSender] = useState({});
  const [replyTo, setReplyTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMediaPopup, setShowMediaPopup] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [skip, setSkip] = useState(0);
  const limit = 20;
  const messagesEndRef = useRef(null);
  const [hasMore, setHasMore] = useState(true);
  const scrollTimeoutRef = useRef(null);
  const typingDebounceRef = useRef(null);
  const stopTypingTimeoutRef = useRef(null);
  const scrollContainerRef = useRef(null);

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
        setSender(response.data.sender);
        setMessages(response.data.messages);
        setSkip(response.data.messages.length);
        setHasMore(response.data.hasMore);
      } else {
        // Record current scroll height before updating state
        const container = scrollContainerRef.current;
        const prevScrollHeight = container ? container.scrollHeight : 0;

        // Prepend older messages
        setMessages((prev) => [...response.data.messages, ...prev]);
        setSkip(skip + response.data.messages.length);
        setHasMore(response.data.hasMore);

        // Wait for the new messages to render, then adjust scrollTop
        setTimeout(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            // Increase scrollTop by the difference in scrollHeight
            container.scrollTop = newScrollHeight - prevScrollHeight;
          }
        }, 0);
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

    const handleUserStatus = ({ userId, online, lastActive }) => {
      if (userId === sender?._id) {
        setSender((prevSender) => ({
          ...prevSender,
          online,
          lastActive,
        }));
      }
    };

    const handleChatMessage = (msg) => {
      if (msg.chat._id === chatId) {
        console.log("[Socket] new chat recivied:", msg);
        setMessages((prev) => [...prev, msg]);
        // Immediately acknowledge delivery back to server
        if (msg.sender._id !== auth.user._id) {
          socket.emit("message-delivered", { messageId: msg._id, chatId });
          handleUserStatus({
            userId: msg.sender._id,
            online: true,
            lastActive: new Date(),
          });
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

    const handleMessageDelivered = ({ messageId }) => {
      console.log("Message Delivered:", messageId);
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg._id === messageId
            ? { ...msg, status: "delivered", deliveredAt: new Date() }
            : msg
        )
      );
    };

    const handleBulkChatDelivered = ({ chatId: eventChatId, messageIds }) => {
      // Only process if this event is for the current chat
      if (eventChatId !== chatId) return;
      console.log("[Socket] Bulk chat delivered event received:", {
        eventChatId,
        messageIds,
      });

      // Update the local messages state for messages that match the given IDs.
      setMessages((prevMessages) =>
        prevMessages.map((msg) => {
          if (messageIds.includes(msg._id)) {
            return {
              ...msg,
              status: "delivered",
              deliveredAt: new Date(), // You might use the timestamp from the event if available.
            };
          }
          return msg;
        })
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

    const handleMessageEdited = (editedMessage) => {
      console.log("[Socket] Message edited event received:", editedMessage);
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg._id === editedMessage._id ? editedMessage : msg
        )
      );
    };

    const handleMessageDeleted = ({ messageId }) => {
      console.log("[Socket] Message deleted event received:", messageId);
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg._id === messageId ? { ...msg, deleted: true, media: null } : msg
        )
      );
    };

    socket.on("new-message", handleChatMessage);
    socket.on("message-seen", handleMessageRead);
    socket.on("message-delivered", handleMessageDelivered);
    socket.on("typing", handleTyping);
    socket.on("stopTyping", handleStopTyping);
    socket.on("user-status", handleUserStatus);
    socket.on("batch-message-seen", handleBatchMessageSeen);
    socket.on("bulk-chat-delivered", handleBulkChatDelivered);
    socket.on("message-edited", handleMessageEdited);
    socket.on("message-deleted", handleMessageDeleted);

    return () => {
      socket.off("new-message", handleChatMessage);
      socket.off("message-seen", handleMessageRead);
      socket.off("message-delivered", handleMessageDelivered);
      socket.off("typing", handleTyping);
      socket.off("stopTyping", handleStopTyping);
      socket.off("user-status", handleUserStatus);
      socket.off("batch-message-seen", handleBatchMessageSeen);
      socket.off("bulk-chat-delivered", handleBulkChatDelivered);
      socket.off("message-edited", handleMessageEdited);
      socket.off("message-deleted", handleMessageDeleted);
    };
  }, [chatId, auth, socket, typingUsers]);

  const deleteMessage = async (messageId) => {
    try {
      await axiosInstance.delete(`/chats/${chatId}/message/${messageId}`);
    } catch (err) {
      console.error("Failed to delete message", err);
    }
  };

  const handleSend = async () => {
    if (editingMessage) {
      // Edit message flow
      try {
        const response = await axiosInstance.put(
          `/chats/${chatId}/message/${editingMessage._id}`,
          { text: messageText, encryptedText: "" } // Adjust as needed
        );
        // Update the local messages state with the edited message
        setMessages((prev) =>
          prev.map((m) => (m._id === editingMessage._id ? response.data : m))
        );
        setEditingMessage(null);
        setMessageText("");
      } catch (err) {
        console.error("Failed to edit message", err);
      }
    } else {
      // New message flow (includes reply if replyTo is set)
      try {
        const payload = {
          text: messageText,
          replyTo: replyTo ? replyTo._id : null,
        };
        await axiosInstance.post(`/chats/${chatId}/message`, payload);
        setMessageText("");
        setReplyTo(null);
        if (socket) socket.emit("stopTyping", { chatId });
        scrollToBottom();
      } catch (err) {
        console.error("Failed to send message", err);
      }
    }
  };

  const handleEmojiSelect = (emoji) => {
    setMessageText((prev) => prev + emoji.native);
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 500);
  };

  const handleTypingChange = (e) => {
    const value = e.target.value;
    setMessageText(value);

    // Debounce the typing event: clear any pending debounce timer
    if (typingDebounceRef.current) {
      clearTimeout(typingDebounceRef.current);
    }
    typingDebounceRef.current = setTimeout(() => {
      if (socket) {
        socket.emit("typing", { chatId });
        console.log("Emitted 'typing' event");
      }
      typingDebounceRef.current = null;
    }, 500); // adjust debounce time as needed

    // Inactivity timer: clear any pending stopTyping timeout
    if (stopTypingTimeoutRef.current) {
      clearTimeout(stopTypingTimeoutRef.current);
    }
    stopTypingTimeoutRef.current = setTimeout(() => {
      if (socket) {
        socket.emit("stopTyping", { chatId });
        console.log("Emitted 'stopTyping' event due to inactivity");
      }
      stopTypingTimeoutRef.current = null;
    }, 3000); // 3000ms = 3 seconds inactivity threshold
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="p-4 bg-white shadow flex justify-between items-center">
        <div>
          <span className="font-bold text-lg">{sender.username}</span>
          {sender && (
            <span className="ml-2 text-sm text-gray-600">
              {sender.online ? (
                <span className="ml-2 inline-block w-2 h-2 bg-green-500 rounded-full"></span>
              ) : (
                <>
                  <span className="ml-2 inline-block w-2 h-2 bg-gray-500 rounded-full"></span>
                  Last active: {new Date(sender.lastActive).toLocaleString()}
                </>
              )}
            </span>
          )}
        </div>
        <button onClick={() => window.history.back()} className="text-blue-500">
          Back
        </button>
      </div>
      <div
        className="flex-1 overflow-y-scroll p-4"
        ref={scrollContainerRef}
        onScroll={handleChatScroll}
      >
        {messages.map((msg) => (
          <MessageItem
            key={msg._id}
            msg={msg}
            chatId
            onSeen={markMessageSeen}
            activeMenu={activeMenu}
            setReplyTo={setReplyTo}
            setActiveMenu={setActiveMenu}
            setMessageText={setMessageText}
            setEditingMessage={setEditingMessage}
            deleteMessage={deleteMessage}
          />
        ))}

        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 bg-white">
        {typingUsers.length > 0 && (
          <div className="mb-2 text-sm text-gray-600">Typing...</div>
        )}
        {replyTo && (
          <div className="mb-2 p-2 bg-gray-100 rounded flex justify-between items-center">
            <span className="text-sm text-gray-600">
              Replying to: {replyTo.text.slice(0, 50)}...
            </span>
            <button
              onClick={() => setReplyTo(null)}
              className="text-red-500 text-sm"
            >
              Cancel
            </button>
          </div>
        )}
        {editingMessage && (
          <div className="mb-2 p-2 bg-gray-100 rounded flex justify-between items-center">
            <span className="text-sm text-gray-600">Editing message...</span>
            <button
              onClick={() => {
                setEditingMessage(null);
                setMessageText("");
              }}
              className="text-red-500 text-sm"
            >
              Cancel
            </button>
          </div>
        )}
        <div className="flex items-center space-x-2">
          <textarea
            value={messageText}
            onChange={handleTypingChange}
            placeholder="Type your message"
            className="flex-1 border rounded p-2"
          />

          {/* Three dots icon that toggles the multimedia popup */}
          <button
            onClick={() => setShowMediaPopup((prev) => !prev)}
            className="p-1"
          >
            <FaEllipsisH size={18} className="text-gray-500" />
          </button>
          {/* Send icon */}
          <button onClick={handleSend} className="p-1">
            <FaPaperPlane size={18} className="text-blue-500" />
          </button>
          {/* Multimedia Popup List */}
          {showMediaPopup && (
            <MultimediaUpload
              chatId={chatId}
              onUploadSuccess={(newMsg) => {
                setShowMediaPopup(false);
                setMessageText("");
              }}
              onCancel={() => setShowMediaPopup(false)}
              setShowEmojiPicker={setShowEmojiPicker}
              messageText={messageText}
            />
          )}
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

const MessageItem = ({
  msg,
  onSeen,
  chatId,
  setReplyTo,
  activeMenu,
  setActiveMenu,
  setMessageText,
  setEditingMessage,
  deleteMessage,
}) => {
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
      {msg.replyTo && (
        <div className="p-2 bg-gray-100 border-l-4 border-blue-500 text-sm mb-1">
          Replying to: {msg.replyTo.text.slice(0, 50)}...
        </div>
      )}
      <div className="flex justify-between items-center">
        {/* Display the sender's name */}
        <span className="font-semibold">{msg.sender.username}</span>
        <div className="flex items-center">
          {msg.edited && (
            <span className="text-sm text-gray-500"> (edited)</span>
          )}
          <span className="text-sm text-gray-500">
            {new Date(msg.sentAt).toLocaleTimeString()}
          </span>
          <span className="mx-2 text-sm text-gray-500">
            {msg.sender._id === auth.user._id ? msg.status : ""}
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
      {msg.text && !msg.media && (
        <div className="bg-gray-200 p-2 rounded">
          {msg.deleted ? "This message was deleted" : msg.text}
        </div>
      )}
      {/* Render uploaded media if present */}
      {msg.media && (
        <div className="mt-2">
          {msg.media.type === "image" && (
            <img
              src={msg.media.url}
              alt="Uploaded"
              className="max-w-xs rounded"
            />
          )}
          {msg.media.type === "video" && (
            <video controls className="max-w-xs rounded">
              <source src={msg.media.url} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          )}
          {(msg.media.type === "voice" || msg.media.type === "audio") && (
            <audio controls className="w-full">
              <source src={msg.media.url} type="audio/webm" />
              Your browser does not support the audio element.
            </audio>
          )}
          {msg.media.type === "document" && (
            <a
              href={msg.media.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 underline"
            >
              View File
            </a>
          )}
          {msg.media.type === "file" && (
            <a
              href={msg.media.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 underline"
              download
            >
              Download File
            </a>
          )}
          {msg.media.caption && (
            <div className="text-sm text-gray-600">{msg.media.caption}</div>
          )}
        </div>
      )}
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
                setReplyTo(msg);
                setEditingMessage(null);
                setActiveMenu(null);
              }}
              className="text-blue-500 text-sm text-left"
            >
              Reply
            </button>
            {msg.sender._id === auth.user._id && !msg.deleted && (
              <>
                <button
                  onClick={() => {
                    setEditingMessage(msg);
                    setMessageText(msg.text);
                    setReplyTo(null);
                    setActiveMenu(null);
                  }}
                  className="text-blue-500 text-sm text-left"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    deleteMessage(msg._id);
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
