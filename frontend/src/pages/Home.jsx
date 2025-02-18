import React, { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import UserSearch from "../components/UserSearch";
import ChatList from "../components/ChatList";
import { motion } from "framer-motion";

const Home = () => {
  const { auth, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  const handleChatSelect = (chat) => {
    navigate(`/chat/${chat._id}`);
  };

  // 🌟 Logout with Confirmation
  const handleLogout = () => {
    if (logoutConfirm) {
      logout();
    } else {
      setLogoutConfirm(true);
      setTimeout(() => setLogoutConfirm(false), 5000); // Reset after 5 sec
    }
  };

  if (!auth || !auth.user)
    return (
      <div className="flex items-center flex-col justify-center h-screen">
        <div className="text-2xl">Not authenticated</div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* 🌟 Header with Smooth Animation */}
      <motion.header
        className="p-4 bg-white shadow flex justify-between items-center sticky top-0 z-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-xl font-bold" aria-label="Chat App">
          Chat App
        </h1>

        <div className="flex items-center space-x-4">
          <span className="text-gray-700" aria-label="User Info">
            Welcome, {auth.user.username || auth.user.email}
          </span>
          {/* 🌟 Pair Button */}
          <button
            aria-label="Pair"
            className="px-4 py-2 rounded transition text-white bg-blue-500"
            onClick={()=>{navigate("/pair")}}
          >
            Pair
          </button>
          {/* 🌟 Logout Button with Confirmation */}
          <button
            onClick={handleLogout}
            className={`px-4 py-2 rounded transition ${
              logoutConfirm ? "bg-yellow-500" : "bg-red-500 hover:bg-red-600"
            } text-white`}
            aria-label={
              logoutConfirm ? "Click again to confirm logout" : "Logout"
            }
          >
            {logoutConfirm ? "Confirm Logout?" : "Logout"}
          </button>
        </div>
      </motion.header>

      {/* 🌟 Main Content with Smooth Load */}
      <motion.main
        className="p-4 max-w-screen-xl space-y-6 w-full mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        {/* 🌟 User Search with Autofocus for Better UX */}
        <UserSearch className="border rounded-lg p-2 bg-white shadow-md hover:shadow-lg transition" />

        {/* 🌟 Chat List with Improved Clickable UX */}
        <ChatList
          onSelectChat={handleChatSelect}
          className="border rounded-lg p-2 bg-white shadow-md hover:shadow-lg transition"
        />
      </motion.main>
    </div>
  );
};

export default Home;
