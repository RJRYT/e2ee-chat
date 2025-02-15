import React, { useState, useCallback } from "react";
import axiosInstance from "../services/api";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { debounce } from "lodash";
import { Loader2, Search, XCircle } from "lucide-react";

const UserSearch = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // 🔍 Debounced Search API Call
  const handleSearch = useCallback(
    debounce(async (searchTerm) => {
      if (!searchTerm) return setResults([]);
      setLoading(true);
      setError("");

      try {
        const res = await axiosInstance.get(
          `/users/search?query=${searchTerm}`
        );
        setResults(res.data);
      } catch (err) {
        setError("Failed to fetch users. Please try again.");
        console.error("Search error:", err);
      } finally {
        setLoading(false);
      }
    }, 500),
    []
  );

  // 🌟 Handle Input Change
  const handleChange = (e) => {
    setQuery(e.target.value);
    handleSearch(e.target.value);
  };

  // ✅ Handle User Selection & Navigate to Chat
  const handleSelectUser = async (user) => {
    try {
      setLoading(true);
      const res = await axiosInstance.post("/chats/create", {
        participantId: user._id,
      });
      navigate(`/chat/${res.data._id}`);
    } catch (err) {
      setError("Failed to create chat. Try again later.");
      console.error("Failed to create chat:", err);
    } finally {
      setLoading(false);
    }
  };

  // ❌ Clear Input
  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setError("");
  };

  return (
    <motion.div
      className="bg-white rounded-lg shadow-md p-4 mb-4"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Search Input */}
      <div className="relative">
        <input
          value={query}
          onChange={handleChange}
          placeholder="Search users..."
          className="border p-3 rounded w-full text-gray-400 pl-10 pr-10 focus:ring-2 focus:ring-blue-400 outline-none transition"
          aria-label="Search users"
        />
        <Search className="absolute left-3 top-3 text-gray-400" size={20} />
        {query && (
          <XCircle
            className="absolute right-3 top-3 text-gray-400 cursor-pointer hover:text-gray-600"
            size={20}
            onClick={clearSearch}
            aria-label="Clear search"
          />
        )}
      </div>

      {/* Error Message */}
      {error && (
        <motion.div
          className="text-red-500 text-sm mt-2 flex items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <XCircle size={16} className="mr-2" /> {error}
        </motion.div>
      )}

      {/* Search Results */}
      <ul className="mt-3 space-y-2">
        {loading ? (
          <div className="flex justify-center mt-3">
            <Loader2 className="animate-spin text-gray-500" size={24} />
          </div>
        ) : (
          results.map((user) => (
            <motion.li
              key={user._id}
              className="p-3 border rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-between cursor-pointer transition"
              onClick={() => handleSelectUser(user)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="text-gray-800 font-medium">{user.username}</span>
              <span className="text-sm text-gray-500">{user.email}</span>
            </motion.li>
          ))
        )}
      </ul>
    </motion.div>
  );
};

export default UserSearch;
