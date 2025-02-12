import React from "react";
import { Link } from "react-router-dom";

const NotFound = () => (
  <div className="min-h-screen flex flex-col justify-center items-center">
    <h2 className="text-2xl font-bold">404 - Not Found</h2>
    <Link to="/" className="text-blue-500 underline">
      Go to Home
    </Link>
  </div>
);

export default NotFound;
