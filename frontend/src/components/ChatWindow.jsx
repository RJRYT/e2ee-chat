import React, { useState, useEffect, useRef, useContext } from "react";
import { FaPaperPlane, FaTimes } from "react-icons/fa";
import { HiDotsVertical } from "react-icons/hi";
import axiosInstance from "../services/api";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { AuthContext } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import MultimediaUpload from "./MultimediaUpload";
import { ArrowLeft, Circle } from "lucide-react";
import { decryptWithAES, encryptWithAES } from "../utils/ECDH";
import { getRecipientAESKey } from "../utils/getkeys";

const ChatWindow = ({ chatId }) => {
  const { auth } = useContext(AuthContext);
  const socket = useSocket(); // Use shared socket from context
  const [messages, setMessages] = useState([]);
  const [activeMenu, setActiveMenu] = useState(null);
  const [messageText, setMessageText] = useState("");
  const [sender, setSender] = useState({});
  const [replyTo, setReplyTo] = useState(null);
  const [error, setError] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMediaPopup, setShowMediaPopup] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isSendingDisabled, setIsSendingDisabled] = useState(false);
  const limit = 20;
  const messagesEndRef = useRef(null);
  const [hasMore, setHasMore] = useState(true);
  const scrollTimeoutRef = useRef(null);
  const typingDebounceRef = useRef(null);
  const stopTypingTimeoutRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const mediaPopupRef = useRef(null);

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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target)
      ) {
        setShowEmojiPicker(false);
      }
      if (
        mediaPopupRef.current &&
        !mediaPopupRef.current.contains(event.target)
      ) {
        setShowMediaPopup(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const fetchMessages = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      const response = await axiosInstance.get(
        `/chats/${chatId}/messages?skip=${reset ? 0 : skip}&limit=${limit}`
      );
      const msgs = response.data.messages;
      const aesKey = await getRecipientAESKey(
        response.data.sender._id,
        auth.user._id
      );
      const decryptedMessages = await Promise.all(
        msgs.map(async (msg) => {
          try {
            const decryptedText = await decryptWithAES(
              aesKey,
              msg.encryptedText
            );
            return { ...msg, text: decryptedText, decrypted: true };
          } catch (err) {
            return {};
          }
        })
      );
      const filteredMsgs = decryptedMessages.filter(
        (msg) => Object.keys(msg).length !== 0
      );
      if (reset) {
        setSender(response.data.sender);
        setMessages(filteredMsgs);
        setSkip(decryptedMessages.length);
        setHasMore(response.data.hasMore);
        setLoading(false);
      } else {
        // Record current scroll height before updating state
        const container = scrollContainerRef.current;
        const prevScrollHeight = container ? container.scrollHeight : 0;

        // Prepend older messages
        setMessages((prev) => [...filteredMsgs, ...prev]);
        setSkip(skip + decryptedMessages.length);
        setHasMore(response.data.hasMore);
        setLoadingMore(false);

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
      setError("Failed to load messages");
      setLoading(false);
      setLoadingMore(false);
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

    const handleChatMessage = async (msg) => {
      if (msg.chat._id === chatId) {
        console.log(
          "[Socket] new chat recivied:",
          msg.recipient._id,
          auth.user._id
        );
        const senderCheck =
          msg.recipient._id === auth.user._id ? msg.sender : msg.recipient;
        try {
          const aesKey = await getRecipientAESKey(
            senderCheck._id,
            auth.user._id
          );
          const decryptedText = await decryptWithAES(aesKey, msg.encryptedText);
          msg.text = decryptedText;
          msg.decrypted = true;
        } catch (err) {
          msg.text = "unknown message";
          msg.decrypted = false;
        }
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

    const handleMessageEdited = async (editedMessage) => {
      console.log("[Socket] Message edited event received:", editedMessage);
      try {
        const aesKey = await getRecipientAESKey(sender._id, auth.user._id);
        const decryptedText = await decryptWithAES(aesKey, msg.encryptedText);
        editedMessage.text = decryptedText;
        editedMessage.decrypted = true;
      } catch (err) {
        editedMessage.text = "unknown message";
        editedMessage.decrypted = false;
      }
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
    if (!messageText.trim()) return;
    // Prevent spam: disable sending for 3 seconds after a message is sent
    setIsSendingDisabled(true);
    setTimeout(() => setIsSendingDisabled(false), 3000);

    if (editingMessage) {
      // If editing message and text is unchanged, cancel edit
      if (messageText.trim() === editingMessage.text.trim()) {
        setEditingMessage(null);
        setMessageText("");
        return;
      }
      // Edit message flow
      try {
        const aesKey = await getRecipientAESKey(sender._id, auth.user._id);
        // Encrypt the message text:
        const encryptedText = await encryptWithAES(aesKey, messageText);

        const response = await axiosInstance.put(
          `/chats/${chatId}/message/${editingMessage._id}`,
          { encryptedText } // Adjust as needed
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
        const aesKey = await getRecipientAESKey(sender._id, auth.user._id);
        // Encrypt the message text:
        const encryptedText = await encryptWithAES(aesKey, messageText);
        const payload = {
          encryptedText,
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

  if (!auth || !auth.user)
    return (
      <div className="flex items-center flex-col justify-center h-screen">
        <div className="text-2xl">Not authenticated</div>
      </div>
    );

  if (error)
    return (
      <div className="flex items-center flex-col justify-center h-screen">
        <div className="text-2xl">{error}</div>
      </div>
    );

  return (
    <div className="flex flex-col h-screen">
      <div className="p-4 bg-white shadow flex justify-between items-center">
        {loading ? (
          // Fallback skeleton while data is loading
          <div className="flex flex-col space-y-2 animate-pulse w-full">
            <div className="h-6 bg-gray-300 rounded w-1/2"></div>
            <div className="h-4 bg-gray-300 rounded w-3/4"></div>
          </div>
        ) : (
          <div className="flex flex-col">
            <span
              className="font-bold text-lg"
              aria-label={`Chat with ${sender.username}`}
            >
              {sender.username}
            </span>
            {sender && (
              <span className="mt-1 text-sm text-gray-600 flex items-center">
                {sender.online ? (
                  <Circle
                    size={12}
                    className="text-green-500 mr-1"
                    aria-label="Online"
                  />
                ) : (
                  <Circle
                    size={12}
                    className="text-gray-500 mr-1"
                    aria-label="Offline"
                  />
                )}
                {sender.online ? (
                  <span>Online</span>
                ) : (
                  <span>
                    Last active:{" "}
                    {new Date(sender.lastActive).toLocaleString() || ""}
                  </span>
                )}
              </span>
            )}
          </div>
        )}
        <button
          onClick={() => window.history.back()}
          className="text-blue-500 flex items-center focus:outline-none focus:ring"
          aria-label="Go back"
        >
          <ArrowLeft size={20} className="mr-1" />
          <span className="hidden sm:inline">Back</span>
        </button>
      </div>
      <div
        className="flex-1 overflow-y-scroll p-4"
        ref={scrollContainerRef}
        onScroll={handleChatScroll}
      >
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <span className="text-gray-500">Loading messages...</span>
          </div>
        ) : (
          <>
            {loadingMore && (
              <div className="text-center text-gray-500 mb-2">
                Loading more messages...
              </div>
            )}
            {messages.map((msg, index) => {
              const currentDate = new Date(msg.sentAt).toLocaleDateString();
              const prevDate =
                index > 0
                  ? new Date(messages[index - 1].sentAt).toLocaleDateString()
                  : null;
              return (
                <React.Fragment key={msg._id}>
                  {(index === 0 || currentDate !== prevDate) && (
                    <div className="text-center text-sm text-gray-500 my-2">
                      {currentDate}
                    </div>
                  )}
                  <MessageItem
                    msg={msg}
                    chatId={chatId}
                    onSeen={markMessageSeen}
                    activeMenu={activeMenu}
                    setReplyTo={setReplyTo}
                    setActiveMenu={setActiveMenu}
                    setMessageText={setMessageText}
                    setEditingMessage={setEditingMessage}
                    deleteMessage={deleteMessage}
                  />
                </React.Fragment>
              );
            })}
          </>
        )}

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
              className="text-red-500 focus:outline-none focus:ring"
              aria-label="Cancel reply"
            >
              <FaTimes size={16} />
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
              className="text-red-500 focus:outline-none focus:ring"
              aria-label="Cancel edit"
            >
              <FaTimes size={16} />
            </button>
          </div>
        )}
        <div className="flex items-center space-x-2">
          {/* Multimedia toggle button as icon */}
          <button
            onClick={() => setShowMediaPopup((prev) => !prev)}
            className="p-1 focus:outline-none focus:ring"
            aria-label="Toggle multimedia options"
          >
            <HiDotsVertical size={25} className="text-gray-500" />
          </button>
          {/* Custom input instead of textarea */}
          <div className="flex-1 relative">
            <label htmlFor="chat-input" className="sr-only">
              Type your message
            </label>
            <textarea
              id="chat-input"
              value={messageText}
              onChange={handleTypingChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!isSendingDisabled) handleSend();
                }
              }}
              placeholder="Type your message (Enter to send, Shift+Enter for new line)"
              className="w-full border rounded p-2 resize-none focus:outline-none focus:ring focus:border-blue-300 transition-colors"
              aria-label="Message input"
              rows={2}
            />
          </div>
          {/* Send button with spam protection as icon */}
          <button
            onClick={handleSend}
            className="p-1 focus:outline-none focus:ring"
            disabled={isSendingDisabled}
            aria-label="Send message"
          >
            <FaPaperPlane size={25} className="text-blue-500" />
          </button>
        </div>
        {/* Multimedia Popup List */}
        <div ref={mediaPopupRef}>
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
        <div ref={emojiPickerRef} className="absolute bottom-20 right-5">
          {showEmojiPicker && (
            <Picker
              onEmojiSelect={handleEmojiSelect}
              previewPosition="none"
              theme="light"
              data={data}
            />
          )}
        </div>
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
  const [isExpanded, setIsExpanded] = useState(false);

  // Observe message visibility for "seen" status
  useEffect(() => {
    if (msg.status === "sent" || msg.status === "delivered") {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            onSeen(msg._id);
            observer.unobserve(entry.target);
          }
        },
        { threshold: 0.5 }
      );
      if (ref.current) observer.observe(ref.current);
      return () => observer.disconnect();
    }
  }, [msg, onSeen]);

  const isMine = msg.sender._id === auth.user._id;
  const TEXT_THRESHOLD = 200; // Adjust as needed (based on character length)

  const toggleExpand = () => setIsExpanded((prev) => !prev);

  return (
    <div
      ref={ref}
      className={`mb-4 relative px-2 ${isMine ? "text-right" : "text-left"}`}
    >
      {/* If this is a reply, show reply header */}
      {msg.replyTo && (
        <div className="p-2 bg-gray-100 border-l-4 border-blue-500 text-sm mb-1 inline-block max-w-[80%]">
          <span className="italic text-gray-600">
            Replied to: {msg.replyTo.text.slice(0, 50)}...
          </span>
        </div>
      )}
      <div className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
        <div className="flex items-center gap-2 mb-1 relative">
          <span className="font-semibold">{msg.sender.username}</span>
          {msg.edited && (
            <span className="text-xs text-gray-500">(edited)</span>
          )}
          <span className="text-xs text-gray-500">
            {new Date(msg.sentAt).toLocaleTimeString()}
          </span>
          {isMine && (
            <span className="text-xs text-gray-500">{msg.status}</span>
          )}
          {/* Popup menu trigger */}
          <button
            onClick={() =>
              setActiveMenu(activeMenu === msg._id ? null : msg._id)
            }
            className="mx-2 text-gray-500 focus:outline-none"
            aria-label="More options"
          >
            &#8942;
          </button>
          {/* Info Popup Menu */}
          {activeMenu === msg._id && (
            <div className="absolute top-full right-0 mt-1 bg-white border rounded shadow-lg p-2 z-10">
              {isMine && (
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
                  {msg.replyTo && (
                    <span>Replied: {msg.replyTo.text.slice(0, 50)}...</span>
                  )}
                  {msg.edited && <span>Edited</span>}
                </div>
              )}
              <div className="flex flex-row gap-2">
                <button
                  onClick={() => {
                    setReplyTo(msg);
                    setEditingMessage(null);
                    setActiveMenu(null);
                  }}
                  className="text-blue-500 text-xs focus:outline-none"
                >
                  Reply
                </button>
                {isMine && !msg.deleted && (
                  <>
                    <button
                      onClick={() => {
                        setEditingMessage(msg);
                        setMessageText(msg.text);
                        setReplyTo(null);
                        setActiveMenu(null);
                      }}
                      className="text-blue-500 text-xs focus:outline-none"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        deleteMessage(msg._id);
                        setActiveMenu(null);
                      }}
                      className="text-red-500 text-xs focus:outline-none"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        {/* Message content area */}
        {msg.deleted ? (
          <div className="bg-gray-300 p-2 rounded text-sm italic">
            This message was deleted
          </div>
        ) : (
          <div
            className={`bg-gray-200 p-2 rounded text-sm shadow-md min-w-[150px] max-w-[75%] sm:max-w-[65%] md:max-w-[55%]`}
            style={{ whiteSpace: "pre-wrap" }}
          >
            {msg.text && (
              <div className="relative">
                <div
                  className={`overflow-hidden ${
                    !isExpanded && msg.text.length > TEXT_THRESHOLD
                      ? "max-h-20"
                      : ""
                  }`}
                >
                  {msg.text}
                </div>
                {msg.text.length > TEXT_THRESHOLD && (
                  <button
                    onClick={toggleExpand}
                    className="text-blue-500 text-xs mt-1 focus:outline-none"
                  >
                    {isExpanded ? "Show less" : "Show more"}
                  </button>
                )}
              </div>
            )}
            {/* Media Rendering Section (unchanged) */}
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
                  <div className="text-sm text-gray-600">
                    {msg.media.caption}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatWindow;
