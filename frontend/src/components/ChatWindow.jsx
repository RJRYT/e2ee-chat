import React, { useState, useEffect, useRef, useContext } from "react";
import { FaPaperPlane, FaTimes } from "react-icons/fa";
import { HiDotsVertical } from "react-icons/hi";
import {
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileCode,
  FileSpreadsheet,
  FileType,
  Play,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
} from "lucide-react";
import axiosInstance from "../services/api";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { AuthContext } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import MultimediaUpload from "./MultimediaUpload";
import { ArrowLeft, Circle } from "lucide-react";
import { FaCircle } from "react-icons/fa";
import { decryptWithAES, encryptWithAES } from "../utils/ECDH";
import { getRecipientAESKey } from "../utils/getkeys";

const safeText = (value) => (typeof value === "string" ? value : "");

const getFileNameFromUrl = (url = "") => {
  try {
    const cleanUrl = url.split("?")[0];
    return decodeURIComponent(cleanUrl.substring(cleanUrl.lastIndexOf("/") + 1));
  } catch {
    return "file";
  }
};

const getExtension = (filename = "") => {
  const idx = filename.lastIndexOf(".");
  if (idx === -1 || idx === filename.length - 1) return "";
  return filename.substring(idx + 1).toLowerCase();
};

const getFileVisual = (ext) => {
  const groups = {
    image: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "heic"],
    video: ["mp4", "mov", "mkv", "avi", "webm", "m4v"],
    audio: ["mp3", "wav", "ogg", "aac", "flac", "m4a", "webm"],
    archive: ["zip", "rar", "7z", "tar", "gz"],
    code: ["js", "ts", "jsx", "tsx", "json", "html", "css", "py", "java", "c", "cpp"],
    sheet: ["xls", "xlsx", "csv"],
    text: ["txt", "md", "rtf", "doc", "docx", "pdf"],
  };

  if (groups.image.includes(ext)) return { icon: FileImage, color: "text-pink-600", label: ext.toUpperCase() };
  if (groups.video.includes(ext)) return { icon: FileVideo, color: "text-red-600", label: ext.toUpperCase() };
  if (groups.audio.includes(ext)) return { icon: FileAudio, color: "text-green-600", label: ext.toUpperCase() };
  if (groups.archive.includes(ext)) return { icon: FileArchive, color: "text-amber-600", label: ext.toUpperCase() };
  if (groups.code.includes(ext)) return { icon: FileCode, color: "text-indigo-600", label: ext.toUpperCase() };
  if (groups.sheet.includes(ext)) return { icon: FileSpreadsheet, color: "text-emerald-600", label: ext.toUpperCase() };
  if (groups.text.includes(ext)) return { icon: FileText, color: "text-blue-600", label: ext.toUpperCase() };
  return { icon: FileType, color: "text-gray-600", label: ext ? ext.toUpperCase() : "FILE" };
};

const ChatVideoPlayer = ({ src }) => {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    const onLoadedMetadata = () => setDuration(video.duration || 0);
    const onTimeUpdate = () => setCurrentTime(video.currentTime || 0);
    const onVolumeChange = () => setIsMuted(video.muted);
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === container);
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("volumechange", onVolumeChange);
    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("volumechange", onVolumeChange);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (video.paused) {
        await video.play();
      } else {
        video.pause();
      }
    } catch (err) {
      // Ignore autoplay/promise errors in custom interaction flow.
    }
  };

  const toggleFullscreen = async (event) => {
    event.stopPropagation();
    const container = containerRef.current;
    if (!container) return;
    try {
      if (document.fullscreenElement === container) {
        await document.exitFullscreen();
      } else {
        await container.requestFullscreen();
      }
    } catch (err) {
      // Ignore fullscreen API errors.
    }
  };

  const toggleMute = (event) => {
    event.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleSeek = (event) => {
    event.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    const nextTime = Number(event.target.value);
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-[320px] sm:max-w-[380px] md:max-w-[440px] rounded-lg overflow-hidden border border-gray-300 bg-black cursor-pointer select-none"
      onClick={togglePlay}
    >
      <video
        ref={videoRef}
        src={src}
        controls={false}
        playsInline
        preload="metadata"
        className="w-full h-auto block max-h-[420px] bg-black"
      >
        Your browser does not support the video tag.
      </video>

      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="h-14 w-14 rounded-full bg-black/55 text-white flex items-center justify-center shadow-lg">
            <Play size={28} fill="currentColor" />
          </div>
        </div>
      )}

      {isFullscreen && (
        <div
          className="absolute left-2 right-2 bottom-2 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="range"
            min={0}
            max={duration || 0}
            step="0.1"
            value={Math.min(currentTime, duration || 0)}
            onChange={handleSeek}
            className="w-full accent-blue-500"
            aria-label="Video progress"
          />
        </div>
      )}

      <div className="absolute bottom-2 right-2 flex items-center gap-2 z-10">
        <button
          type="button"
          onClick={toggleMute}
          className="h-8 w-8 rounded-md bg-black/55 text-white flex items-center justify-center hover:bg-black/70"
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="h-8 w-8 rounded-md bg-black/55 text-white flex items-center justify-center hover:bg-black/70"
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>
    </div>
  );
};

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
  const [fullscreenImage, setFullscreenImage] = useState(null);
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

  const decryptMessageForChat = async (msg, otherUserId) => {
    if (!msg?.encryptedText) {
      return {
        ...msg,
        text: safeText(msg?.text),
        decrypted: Boolean(msg?.text),
      };
    }
    if (!otherUserId) {
      return {
        ...msg,
        text: safeText(msg?.text) || "unknown message",
        decrypted: false,
      };
    }

    try {
      const aesKey = await getRecipientAESKey(otherUserId, auth.user._id);
      const decryptedText = await decryptWithAES(aesKey, msg.encryptedText);
      return { ...msg, text: decryptedText, decrypted: true };
    } catch (firstErr) {
      try {
        const refreshedKey = await getRecipientAESKey(otherUserId, auth.user._id, {
          forceRefresh: true,
        });
        const decryptedText = await decryptWithAES(
          refreshedKey,
          msg.encryptedText
        );
        return { ...msg, text: decryptedText, decrypted: true };
      } catch (secondErr) {
        return {
          ...msg,
          text: safeText(msg?.text) || "unknown message",
          decrypted: false,
        };
      }
    }
  };

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

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") setFullscreenImage(null);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const fetchMessages = async (reset = false) => {
    try {
      setError(null);
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      const response = await axiosInstance.get(
        `/chats/${chatId}/messages?skip=${reset ? 0 : skip}&limit=${limit}`
      );
      const msgs = response.data.messages;
      const decryptedMessages = await Promise.all(
        msgs.map((msg) => {
          const otherUserId =
            msg?.sender?._id === auth.user._id
              ? msg?.recipient?._id
              : msg?.sender?._id;
          return decryptMessageForChat(msg, otherUserId);
        })
      );

      if (reset) {
        if (response?.data?.sender) {
          setSender(response.data.sender);
        }
        setMessages(decryptedMessages);
        setSkip(decryptedMessages.length);
        setHasMore(response.data.hasMore);
        setLoading(false);
      } else {
        // Record current scroll height before updating state
        const container = scrollContainerRef.current;
        const prevScrollHeight = container ? container.scrollHeight : 0;

        // Prepend older messages
        setMessages((prev) => [...decryptedMessages, ...prev]);
        setSkip((prev) => prev + decryptedMessages.length);
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
      if (reset) {
        setError("Failed to load messages");
        setLoading(false);
      }
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
      if (msg && msg.sender._id !== auth.user._id) {
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
        const normalizedMessage = await decryptMessageForChat(
          msg,
          senderCheck._id
        );
        setMessages((prev) => [...prev, normalizedMessage]);
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
      setTypingUsers((prev) => {
        if (userId === auth.user._id || prev.includes(userId)) return prev;
        return [...prev, userId];
      });
    };

    const handleStopTyping = ({ userId }) => {
      setTypingUsers((prev) => prev.filter((id) => id !== userId));
    };

    const handleMessageEdited = async (editedMessage) => {
      console.log("[Socket] Message edited event received:", editedMessage);
      const otherUserId =
        editedMessage?.recipient?._id === auth.user._id
          ? editedMessage?.sender?._id
          : editedMessage?.recipient?._id;
      try {
        if (!otherUserId) throw new Error("Missing participant in edited message");
        const normalizedMessage = await decryptMessageForChat(
          editedMessage,
          otherUserId
        );
        editedMessage = normalizedMessage;
      } catch (err) {
        editedMessage.text = safeText(editedMessage.text) || "unknown message";
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
  }, [chatId, auth, socket, sender?._id]);

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
      if (messageText.trim() === safeText(editingMessage.text).trim()) {
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
        const normalizedEdited = {
          ...response.data,
          text: messageText,
          decrypted: true,
        };
        // Update the local messages state with the edited message
        setMessages((prev) =>
          prev.map((m) => (m._id === editingMessage._id ? normalizedEdited : m))
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

  if (auth?.key === false)
    return (
      <div className="flex items-center flex-col justify-center h-screen">
        <div className="text-2xl mb-2">Encryption key not found on this device</div>
        <button
          className="px-4 py-2 rounded bg-blue-500 text-white"
          onClick={() => (window.location.hash = "#/recover")}
        >
          Recover Key
        </button>
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
                  <FaCircle
                    size={12}
                    className="text-green-500 mr-1"
                    aria-label="Online"
                  />
                ) : (
                  <FaCircle
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
                    {sender.lastActive
                      ? new Date(sender.lastActive).toLocaleString()
                      : "Unknown"}
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
                    onImageOpen={setFullscreenImage}
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
              Replying to: {safeText(replyTo.text).slice(0, 50)}...
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
      {fullscreenImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4"
          onClick={() => setFullscreenImage(null)}
        >
          <button
            onClick={() => setFullscreenImage(null)}
            className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2"
            aria-label="Close full screen image"
          >
            <FaTimes size={18} />
          </button>
          <img
            src={fullscreenImage}
            alt="Full screen preview"
            className="max-w-full max-h-full object-contain rounded"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
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
  onImageOpen,
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
  const hasMedia = Boolean(msg?.media?.url);
  const fileName = hasMedia ? getFileNameFromUrl(msg.media.url) : "";
  const extension = getExtension(fileName);
  const fileVisual = getFileVisual(extension);

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
            Replied to: {safeText(msg.replyTo.text).slice(0, 50)}...
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
                    <span>Replied: {safeText(msg.replyTo.text).slice(0, 50)}...</span>
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
            className={`bg-gray-200 p-2 shadow-md rounded text-sm ${
              hasMedia
                ? "max-w-[88%] sm:max-w-[74%] md:max-w-[64%]"
                : "min-w-[150px] max-w-[75%] sm:max-w-[65%] md:max-w-[55%]"
            }`}
            style={{ whiteSpace: "pre-wrap" }}
          >
            {msg.text && (
              <div className={`relative ${hasMedia ? "mb-2" : ""}`}>
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
            {/* Media Rendering Section */}
            {msg.media && (
              <div
                className={`mt-2 flex flex-col gap-2 ${
                  isMine ? "items-end" : "items-start"
                }`}
              >
                {msg.media.type === "image" && (
                  <button
                    type="button"
                    className="w-full max-w-[320px] sm:max-w-[380px] md:max-w-[440px] rounded-lg overflow-hidden border border-gray-300 bg-black/5 focus:outline-none focus:ring cursor-zoom-in"
                    onClick={() => onImageOpen?.(msg.media.url)}
                    aria-label="Open image in full screen"
                  >
                    <img
                      src={msg.media.url}
                      alt="Uploaded"
                      className="w-full h-auto block object-contain max-h-[420px]"
                    />
                  </button>
                )}
                {msg.media.type === "video" && (
                  <ChatVideoPlayer src={msg.media.url} />
                )}
                {(msg.media.type === "voice" || msg.media.type === "audio") && (
                  <div className="w-full max-w-[340px] min-w-[240px] sm:min-w-[280px] rounded-xl border border-gray-300 bg-white p-2 text-left shadow-sm">
                    <audio
                      controls
                      controlsList="nodownload noplaybackrate"
                      className="block w-full h-10"
                      src={msg.media.url}
                    >
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )}
                {msg.media.type === "document" && (
                  <a
                    href={msg.media.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded border border-gray-300 bg-white px-3 py-2 text-blue-600 hover:bg-gray-50"
                  >
                    <fileVisual.icon size={16} className={fileVisual.color} />
                    <span className="font-medium">{fileVisual.label}</span>
                    <span className="text-xs text-gray-600 max-w-[160px] truncate">
                      {fileName}
                    </span>
                  </a>
                )}
                {msg.media.type === "file" && (
                  <a
                    href={msg.media.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded border border-gray-300 bg-white px-3 py-2 text-blue-600 hover:bg-gray-50"
                    download
                  >
                    <fileVisual.icon size={16} className={fileVisual.color} />
                    <span className="font-medium">{fileVisual.label}</span>
                    <span className="text-xs text-gray-600 max-w-[160px] truncate">
                      {fileName}
                    </span>
                  </a>
                )}
                {msg.media.caption && (
                  <div className="text-sm text-gray-700 mt-2">
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
