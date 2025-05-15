import React from 'react';
import { useAuth } from '@/context/AuthContext';

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">User Profile</h1>
      
      {user ? (
        <div className="bg-white shadow-md rounded-lg p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold mb-2">Email</h2>
            <p>{user.email}</p>
          </div>
          
          <div className="mb-4">
            <h2 className="text-lg font-semibold mb-2">User ID</h2>
            <p className="text-sm font-mono bg-gray-100 p-2 rounded">{user.uid}</p>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <p className="text-yellow-700">You need to be logged in to view profile information.</p>
        </div>
      )}
    </div>
  );
} 