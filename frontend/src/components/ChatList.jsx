import React, { useState, useEffect, useContext } from 'react';
import axiosInstance from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useNavigate } from 'react-router-dom';

const ChatList = () => {
  const { auth } = useContext(AuthContext);
  const socket = useSocket();
  const [chats, setChats] = useState([]);
  const navigate = useNavigate();

  const fetchChats = async () => {
    try {
      const res = await axiosInstance.get('/chats');
      setChats(res.data);
    } catch (err) {
      console.error('Failed to fetch chats:', err);
    }
  };

  // Initial fetch on component mount
  useEffect(() => {
    fetchChats();
  }, []);

  // Listen for real-time updates via the shared socket connection
  useEffect(() => {
    if (!socket) return;

    // Handle chat-updated event to update a chat's lastMessage and unreadCount
    const handleChatUpdated = (data) => {
      // Expected payload: { chatId, lastMessage, unreadCount }
      console.log("[Socket] Chat updated event received:", data);
      setChats((prevChats) => {
        return prevChats.map((chat) => {
          if (chat._id === data.chatId) {
            return {
              ...chat,
              lastMessage: data.lastMessage,
            };
          }
          return chat;
        });
      });
    };

    // Handle new-chat event: append the chat if it doesn't already exist
    const handleNewChat = (chat) => {
      console.log("[Socket] New chat event received:", chat);
      setChats((prevChats) => {
        const exists = prevChats.some((c) => c._id === chat._id);
        if (!exists) {
          return [chat, ...prevChats];
        }
        return prevChats;
      });
    };

    // Handle user-status event: update online status for participants
    const handleUserStatus = ({ userId, online }) => {
      console.log("[Socket] User status event received:", userId, online);
      setChats((prevChats) => {
        return prevChats.map((chat) => {
          // For each chat, update the online status for the participant that matches userId
          const updatedParticipants = chat.participants.map((participant) => {
            if (participant._id === userId) {
              return { ...participant, online };
            }
            return participant;
          });
          return { ...chat, participants: updatedParticipants };
        });
      });
    };

    const handleBatchDelivered = (data) => {
      console.log("[Socket] Batch message delivered event received:", data);
      // Option 1: Re-fetch chats
      fetchChats();

      // Option 2 (advanced): Update local state by iterating through chats and updating messages that match any id in data.messageIds.
      // For simplicity, re-fetching is shown here.
    };

    // Listen for both chat-list-updated and new-chat events
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
    <div className="bg-white rounded shadow p-4">
      <h3 className="text-lg font-bold mb-2">Your Chats</h3>
      <ul>
        {chats.map(chat => {
          // Determine the other participant (assuming participants is populated)
          const otherParticipant = chat.participants.find(p => p._id !== auth.user.id) || {};
          return (
            <li
              key={chat._id}
              className="p-2 border-b cursor-pointer hover:bg-gray-100"
              onClick={() => navigate(`/chat/${chat._id}`)}
            >
              <div className="flex justify-between">
                <span className="font-semibold">
                  {otherParticipant.username || "Unknown"}
                  {otherParticipant.online ? (
                    <span className="ml-2 inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                  ) : (
                    <span className="ml-2 inline-block w-2 h-2 bg-gray-500 rounded-full"></span>
                  )}
                </span>
                <span className="text-sm text-gray-500">
                  {chat.lastMessage
                    ? new Date(chat.lastMessage.sentAt).toLocaleTimeString()
                    : ""}{" "}
                  {chat.lastMessage && chat.lastMessage.status !== "seen" && (
                    <span className="ml-2 inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                  )}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                {chat.lastMessage ? chat.lastMessage.text : "No messages yet"}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ChatList;
