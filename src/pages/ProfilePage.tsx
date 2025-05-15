import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, collection, onSnapshot } from 'firebase/firestore';
import { updateEmail, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { toast } from 'sonner';

export default function ProfilePage() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updateForm, setUpdateForm] = useState({
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [updating, setUpdating] = useState({
    email: false,
    password: false
  });

  // Fetch subscription data
  React.useEffect(() => {
    if (!user) return;

    const subscriptionRef = collection(doc(db, 'users', user.uid), 'subscriptions');
    const activeSubDoc = doc(subscriptionRef, 'active');

    const unsubscribe = onSnapshot(activeSubDoc, (docSnap) => {
      setLoading(false);
      if (docSnap.exists()) {
        setSubscription(docSnap.data());
      } else {
        setSubscription(null);
      }
    }, (error) => {
      console.error("Error fetching subscription:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUpdateForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Update email
  const handleEmailUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setUpdating(prev => ({ ...prev, email: true }));

      // Re-authenticate user
      const credential = EmailAuthProvider.credential(
        user.email!,
        updateForm.currentPassword
      );
      
      await reauthenticateWithCredential(user, credential);
      
      // Update email
      await updateEmail(user, updateForm.email);
      
      toast.success('Email updated successfully');
      setUpdateForm(prev => ({ ...prev, email: '', currentPassword: '' }));
      setUpdating(prev => ({ ...prev, email: false }));
    } catch (error: any) {
      console.error('Error updating email:', error);
      toast.error(error.message || 'Failed to update email');
      setUpdating(prev => ({ ...prev, email: false }));
    }
  };

  // Update password
  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      // Validation
      if (updateForm.newPassword !== updateForm.confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }

      setUpdating(prev => ({ ...prev, password: true }));

      // Re-authenticate user
      const credential = EmailAuthProvider.credential(
        user.email!,
        updateForm.currentPassword
      );
      
      await reauthenticateWithCredential(user, credential);
      
      // Update password
      await updatePassword(user, updateForm.newPassword);
      
      toast.success('Password updated successfully');
      setUpdateForm(prev => ({ 
        ...prev, 
        currentPassword: '', 
        newPassword: '', 
        confirmPassword: '' 
      }));
      setUpdating(prev => ({ ...prev, password: false }));
    } catch (error: any) {
      console.error('Error updating password:', error);
      toast.error(error.message || 'Failed to update password');
      setUpdating(prev => ({ ...prev, password: false }));
    }
  };

  // Handle subscription management
  const handleManageSubscription = async () => {
    try {
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user?.uid }),
      });

      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error creating customer portal session:', error);
      toast.error('Failed to open subscription management portal');
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString();
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">User Profile</h1>
      
      {user ? (
        <div className="flex flex-col md:flex-row gap-6">
          {/* User Info Section */}
          <div className="w-full md:w-1/2">
            <div className="bg-white shadow-md rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Account Information</h2>
              
              <div className="mb-4">
                <h3 className="text-lg font-medium mb-2">Email</h3>
                <p className="text-gray-700">{user.email}</p>
              </div>
              
              <div className="mb-4">
                <h3 className="text-lg font-medium mb-2">User ID</h3>
                <p className="text-sm font-mono bg-gray-100 p-2 rounded">{user.uid}</p>
              </div>
            </div>

            {/* Subscription Section */}
            <div className="bg-white shadow-md rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Subscription</h2>
              
              {loading ? (
                <p>Loading subscription details...</p>
              ) : subscription ? (
                <div>
                  <div className="mb-4">
                    <h3 className="text-lg font-medium mb-2">Status</h3>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      subscription.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {subscription.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  
                  {subscription.currentPeriodEnd && (
                    <div className="mb-4">
                      <h3 className="text-lg font-medium mb-2">Renews On</h3>
                      <p>{formatDate(subscription.currentPeriodEnd)}</p>
                    </div>
                  )}
                  
                  <button
                    onClick={handleManageSubscription}
                    className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                  >
                    Manage Subscription
                  </button>
                </div>
              ) : (
                <div>
                  <p className="mb-4">You don't have an active subscription.</p>
                  <button
                    onClick={() => window.location.href = '/pricing'}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                  >
                    View Plans
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Update Section */}
          <div className="w-full md:w-1/2">
            {/* Update Email */}
            <div className="bg-white shadow-md rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Update Email</h2>
              <form onSubmit={handleEmailUpdate}>
                <div className="mb-4">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    New Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={updateForm.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  />
                </div>
                
                <div className="mb-4">
                  <label htmlFor="currentPasswordEmail" className="block text-sm font-medium text-gray-700 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    id="currentPasswordEmail"
                    name="currentPassword"
                    value={updateForm.currentPassword}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={updating.email}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:bg-blue-400"
                >
                  {updating.email ? 'Updating...' : 'Update Email'}
                </button>
              </form>
            </div>
            
            {/* Update Password */}
            <div className="bg-white shadow-md rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Update Password</h2>
              <form onSubmit={handlePasswordUpdate}>
                <div className="mb-4">
                  <label htmlFor="currentPasswordPwd" className="block text-sm font-medium text-gray-700 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    id="currentPasswordPwd"
                    name="currentPassword"
                    value={updateForm.currentPassword}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  />
                </div>
                
                <div className="mb-4">
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    id="newPassword"
                    name="newPassword"
                    value={updateForm.newPassword}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                    minLength={6}
                  />
                </div>
                
                <div className="mb-4">
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={updateForm.confirmPassword}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                    minLength={6}
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={updating.password}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:bg-blue-400"
                >
                  {updating.password ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </div>
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