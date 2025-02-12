import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import UserSearch from "../components/UserSearch";
import ChatList from "../components/ChatList";

const Home = () => {
  const { auth, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleChatSelect = (chat) => {
    navigate(`/chat/${chat._id}`);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="p-4 bg-white shadow flex justify-between items-center">
        <h1 className="text-xl font-bold">Job Portal Chat</h1>
        <div>
          <span className="mr-4">
            Welcome, {auth.user.username || auth.user.email}
          </span>
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-500 text-white rounded"
          >
            Logout
          </button>
        </div>
      </header>
      <main className="p-4">
        <UserSearch />
        <ChatList onSelectChat={handleChatSelect} />
      </main>
    </div>
  );
};

export default Home;
