import React, { useEffect, useState, useContext } from "react";
import axiosInstance from "../services/api";
import { AuthContext } from "../context/AuthContext";

const ChatList = ({ onSelectChat }) => {
  const { auth } = useContext(AuthContext);
  const [chats, setChats] = useState([]);

  useEffect(() => {
    axiosInstance
      .get("/chats")
      .then((res) => setChats(res.data))
      .catch((err) => console.error("Failed to fetch chats", err));
  }, []);

  return (
    <div className="bg-white rounded shadow p-4">
      <h3 className="text-lg font-bold mb-2">Your Chats</h3>
      <ul>
        {chats.map((chat) => {
          const otherParticipant =
            chat.participants.find((p) => p._id !== auth.user.id) || {};
          return (
            <li
              key={chat._id}
              className="p-2 border-b cursor-pointer hover:bg-gray-100"
              onClick={() => onSelectChat(chat)}
            >
              <div className="flex justify-between">
                <span className="font-semibold">
                  {otherParticipant.username || "Unknown"}
                </span>
                <span className="text-sm text-gray-500">
                  {chat.lastMessage
                    ? new Date(chat.lastMessage.sentAt).toLocaleTimeString()
                    : ""}
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
