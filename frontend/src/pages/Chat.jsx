import React from "react";
import ChatWindow from "../components/ChatWindow";
import { useParams } from "react-router-dom";

const Chat = () => {
  const { chatId } = useParams();
  return (
    <div className="min-h-screen bg-gray-100">
      <ChatWindow chatId={chatId} />
    </div>
  );
};

export default Chat;
