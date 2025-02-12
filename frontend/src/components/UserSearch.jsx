import React, { useState } from "react";
import axiosInstance from "../services/api";
import { useNavigate } from "react-router-dom";

const UserSearch = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const navigate = useNavigate();

  const handleSearch = async () => {
    try {
      const res = await axiosInstance.get(`/users/search?query=${query}`);
      setResults(res.data);
    } catch (err) {
      console.error("Search error:", err);
    }
  };

  const handleSelectUser = async (user) => {
    try {
      // Create a new chat (or retrieve an existing chat) with the selected user
      const res = await axiosInstance.post("/chats/create", {
        participantId: user._id,
      });
      // Navigate to the chat page using the chat id returned from the backend
      navigate(`/chat/${res.data._id}`);
    } catch (err) {
      console.error("Failed to create chat:", err);
    }
  };

  return (
    <div className="bg-white rounded shadow p-4 mb-4">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search users"
        className="border p-2 rounded w-full mb-2"
      />
      <button
        onClick={handleSearch}
        className="bg-blue-500 text-white p-2 rounded w-full"
      >
        Search
      </button>
      <ul className="mt-2">
        {results.map((u) => (
          <li
            key={u._id}
            className="p-2 border-b cursor-pointer hover:bg-gray-100"
            onClick={() => handleSelectUser(u)}
          >
            {u.username} ({u.email})
          </li>
        ))}
      </ul>
    </div>
  );
};

export default UserSearch;
