/**
 * PERMANENT PROFILE PAGE STRUCTURE
 * 
 * This file defines the core profile page structure and must not be modified without careful consideration.
 * Any changes must be documented in src/pages/PROFILE_README.md
 * 
 * Last Updated: [Current Date]
 * Commit: PERMANENT: Profile page structure with subscription management and account settings
 * 
 * Core Features:
 * 1. Profile Overview
 * 2. Account Settings
 * 3. Subscription Management
 * 
 * DO NOT MODIFY THIS STRUCTURE WITHOUT UPDATING THE DOCUMENTATION
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useUserSubscription } from '@/hooks/useUserSubscription';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useNavigate } from 'react-router-dom';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { API_URL } from '@/lib/firebase/config';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';

export default function ProfilePage() {
  const { user, updateProfile, updateEmail } = useAuth();
  const { tier: subscriptionTier, loading: subscriptionLoading } = useUserSubscription();
  const [managementUrl, setManagementUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const auth = getAuth();

  // Form states
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // User data
  const [userData, setUserData] = useState<any>({
    name: '',
    email: '',
    createdAt: null,
    photoURL: '',
    subscriptionTier: 'rookie',
    displayCaseCount: 0,
    cardCount: 0
  });

  // Load user data
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData({
            name: user.displayName || 'User',
            email: user.email || 'No email',
            photoURL: user.photoURL,
            createdAt: user.metadata?.creationTime ? new Date(user.metadata.creationTime) : new Date(),
            subscriptionTier: data.subscriptionTier || 'rookie',
            displayCaseCount: data.displayCaseCount || 0,
            cardCount: data.cardCount || 0
          });
          setUsername(user.displayName || '');
          setEmail(user.email || '');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        toast.error('Failed to load user data');
      }
    };

    fetchUserData();
  }, [user]);

  // Create stripe portal session for subscription management
  const createPortalSession = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/create-portal-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid })
      });
      
      const { url } = await response.json();
      
      if (url) {
        window.location.href = url;
      } else {
        toast.error('Failed to create portal session');
      }
    } catch (error) {
      console.error('Error creating portal session:', error);
      toast.error('Failed to create portal session');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateUsername = async () => {
    if (!user) return;
    if (!username.trim()) {
      toast.error('Username cannot be empty');
      return;
    }
    
    setIsLoading(true);
    try {
      await updateProfile({ displayName: username });
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: username
      });
      toast.success('Username updated successfully');
    } catch (error: any) {
      console.error('Error updating username:', error);
      toast.error(error.message || 'Failed to update username');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!user) return;
    if (!email.trim()) {
      toast.error('Email cannot be empty');
      return;
    }
    
    setIsLoading(true);
    try {
      await updateEmail(email);
      await updateDoc(doc(db, 'users', user.uid), {
        email: email
      });
      toast.success('Email updated successfully');
    } catch (error: any) {
      console.error('Error updating email:', error);
      toast.error(error.message || 'Failed to update email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!user) return;
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('All password fields are required');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }
    
    setIsLoading(true);
    try {
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email!, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Update password
      await updatePassword(user, newPassword);
      toast.success('Password updated successfully');
      
      // Clear password fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error updating password:', error);
      if (error.code === 'auth/wrong-password') {
        toast.error('Current password is incorrect');
      } else {
        toast.error(error.message || 'Failed to update password');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const upgradeSubscription = async (planId: string) => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          priceId: planId,
          userId: user.uid,
          planName: planId.includes('star') ? 'Star Plan' : 'Veteran Plan',
          interval: planId.includes('annual') ? 'annual' : 'monthly'
        })
      });
      
      const { url } = await response.json();
      
      if (url) {
        window.location.href = url;
      } else {
        toast.error('Failed to create checkout session');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast.error('Failed to create checkout session');
    } finally {
      setIsLoading(false);
    }
  };

  // Determine subscription badge color
  const getSubscriptionBadgeColor = (tier: string) => {
    switch (tier) {
      case 'veteran':
        return 'bg-gold text-black';
      case 'star':
        return 'bg-silver text-black';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>You must be logged in to view your profile</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => navigate('/login')}>Login</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Profile Overview Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center space-x-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={userData.photoURL || ''} alt={userData.name} />
              <AvatarFallback>{userData.name?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-2xl">{userData.name}</CardTitle>
              <CardDescription>{userData.email}</CardDescription>
              <div className="mt-1">
                <Badge className={getSubscriptionBadgeColor(subscriptionTier || userData.subscriptionTier)}>
                  {subscriptionTier === 'veteran' 
                    ? 'Veteran Plan' 
                    : subscriptionTier === 'star' 
                      ? 'Star Plan' 
                      : 'Rookie Plan'}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="mt-2 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Member since</p>
                  <p>{userData.createdAt?.toLocaleDateString() || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Subscription</p>
                  <p>{subscriptionTier === 'veteran' 
                    ? 'Veteran Plan' 
                    : subscriptionTier === 'star' 
                      ? 'Star Plan' 
                      : 'Rookie Plan'}</p>
                </div>
              </div>
            </div>
            
            <Separator />
            
            <div>
              <h3 className="font-medium">Collection Stats</h3>
              <div className="mt-2 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Display Cases</p>
                  <p>{userData.displayCaseCount}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Cards</p>
                  <p>{userData.cardCount}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle>Account Settings</CardTitle>
          <CardDescription>Update your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Username Update */}
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <div className="flex gap-2">
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter new username"
              />
              <Button 
                onClick={handleUpdateUsername}
                disabled={isLoading || !username.trim()}
              >
                Update
              </Button>
            </div>
          </div>

          {/* Email Update */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="flex gap-2">
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter new email"
              />
              <Button 
                onClick={handleUpdateEmail}
                disabled={isLoading || !email.trim()}
              >
                Update
              </Button>
            </div>
          </div>

          {/* Password Update */}
          <div className="space-y-4">
            <Label>Password</Label>
            <div className="space-y-2">
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
              />
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
              />
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
              <Button 
                onClick={handleUpdatePassword}
                disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
              >
                Update Password
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscription Management Card */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription Management</CardTitle>
          <CardDescription>Upgrade your plan to unlock more features</CardDescription>
        </CardHeader>
        <CardContent>
          {subscriptionTier === 'rookie' ? (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Star Plan */}
              <Card>
                <CardHeader>
                  <CardTitle>Star Plan</CardTitle>
                  <CardDescription>Perfect for serious collectors</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    <li>Everything in Rookie Plan</li>
                    <li>Advanced analytics</li>
                    <li>Price predictions</li>
                    <li>Grading recommendations</li>
                    <li>Priority support</li>
                  </ul>
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Button 
                    onClick={() => upgradeSubscription('price_1RDB4fGCix0pRkbmlNdsyo7s')}
                    disabled={isLoading}
                  >
                    Monthly
                  </Button>
                  <Button 
                    onClick={() => upgradeSubscription('price_1RN5uOGCix0pRkbmK2kCjqw4')}
                    disabled={isLoading}
                  >
                    Annual
                  </Button>
                </CardFooter>
              </Card>

              {/* Veteran Plan */}
              <Card>
                <CardHeader>
                  <CardTitle>Veteran Plan</CardTitle>
                  <CardDescription>For professional collectors</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    <li>Everything in Star Plan</li>
                    <li>Bulk card management</li>
                    <li>Custom reports</li>
                    <li>API access</li>
                    <li>Dedicated support</li>
                  </ul>
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Button 
                    onClick={() => upgradeSubscription('price_1RDB4fGCix0pRkbmmPrBX8FE')}
                    disabled={isLoading}
                  >
                    Monthly
                  </Button>
                  <Button 
                    onClick={() => upgradeSubscription('price_1RN5vwGCix0pRkbmT65EllS1')}
                    disabled={isLoading}
                  >
                    Annual
                  </Button>
                </CardFooter>
              </Card>
            </div>
          ) : (
            <div className="space-y-4">
              <p>You are currently on the {subscriptionTier} plan.</p>
              <Button 
                onClick={createPortalSession}
                disabled={isLoading}
              >
                Manage Subscription
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 