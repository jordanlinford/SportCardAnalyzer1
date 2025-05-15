import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, collection, onSnapshot, updateDoc } from 'firebase/firestore';
import { updateEmail, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ProfilePage() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updateForm, setUpdateForm] = useState({
    username: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [updating, setUpdating] = useState({
    username: false,
    email: false,
    password: false
  });

  // Subscription plans with correct Stripe Price IDs
  const plans = [
    {
      id: 'rookie',
      name: 'Rookie Plan',
      price: 'Free',
      features: [
        'Basic card tracking',
        'Limited collection size',
        'Community access'
      ],
      priceId: 'price_1RN5t3GCix0pRkbmBX32A7AG',
      interval: 'free'
    },
    {
      id: 'star_monthly',
      name: 'Star Plan',
      price: '$9.99/month',
      features: [
        'All Rookie features',
        'Advanced card tracking',
        'Market analytics',
        'Price predictions'
      ],
      priceId: 'price_1RDB4fGCix0pRkbmlNdsyo7s',
      interval: 'monthly'
    },
    {
      id: 'star_annual',
      name: 'Star Plan (Annual)',
      price: '$99.99/year',
      features: [
        'All Star Monthly features',
        'Save 15% vs monthly'
      ],
      priceId: 'price_1RN5uOGCix0pRkbmK2kCjqw4',
      interval: 'annual'
    },
    {
      id: 'veteran_monthly',
      name: 'Veteran Plan',
      price: '$19.99/month',
      features: [
        'All Star features',
        'Unlimited collection size',
        'Advanced analytics',
        'Priority support'
      ],
      priceId: 'price_1RDB4fGCix0pRkbmmPrBX8FE',
      interval: 'monthly'
    },
    {
      id: 'veteran_annual',
      name: 'Veteran Plan (Annual)',
      price: '$249.99/year',
      features: [
        'All Veteran Monthly features',
        'Save 15% vs monthly'
      ],
      priceId: 'price_1RN5vwGCix0pRkbmT65EllS1',
      interval: 'annual'
    }
  ];

  // Fetch subscription data
  useEffect(() => {
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

  // Update username
  const handleUsernameUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setUpdating(prev => ({ ...prev, username: true }));

      // Update username in Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: updateForm.username
      });
      
      toast.success('Username updated successfully');
      setUpdateForm(prev => ({ ...prev, username: '' }));
      setUpdating(prev => ({ ...prev, username: false }));
    } catch (error: any) {
      console.error('Error updating username:', error);
      toast.error(error.message || 'Failed to update username');
      setUpdating(prev => ({ ...prev, username: false }));
    }
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
      const response = await fetch('http://localhost:3001/api/create-portal-session', {
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

  // Handle subscription upgrade
  const handleSubscribe = async (priceId: string) => {
    if (!user) {
      toast.error('You need to be logged in to subscribe');
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          userId: user.uid,
        }),
      });

      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast.error('Failed to start checkout process');
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString();
  };

  // Get current plan
  const getCurrentPlan = () => {
    if (!subscription || !subscription.priceId) return 'free';
    
    // Find the plan that matches the current subscription
    const currentPlan = plans.find(plan => plan.priceId === subscription.priceId);
    return currentPlan?.id || 'free';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">User Profile</h1>
      
      {user ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* User Info and Settings Column */}
          <div className="space-y-6">
            {/* Account Information Card */}
            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <h3 className="text-lg font-medium mb-2">Email</h3>
                  <p className="text-gray-700">{user.email}</p>
                </div>
                
                <div className="mb-4">
                  <h3 className="text-lg font-medium mb-2">User ID</h3>
                  <p className="text-sm font-mono bg-gray-100 p-2 rounded">{user.uid}</p>
                </div>
              </CardContent>
            </Card>

            {/* Username Update Card */}
            <Card>
              <CardHeader>
                <CardTitle>Update Username</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUsernameUpdate}>
                  <div className="mb-4">
                    <Label htmlFor="username">New Username</Label>
                    <Input
                      type="text"
                      id="username"
                      name="username"
                      value={updateForm.username}
                      onChange={handleInputChange}
                      className="w-full"
                      required
                    />
                  </div>
                  
                  <Button
                    type="submit"
                    disabled={updating.username}
                    className="w-full"
                  >
                    {updating.username ? 'Updating...' : 'Update Username'}
                  </Button>
                </form>
              </CardContent>
            </Card>
            
            {/* Email Update Card */}
            <Card>
              <CardHeader>
                <CardTitle>Update Email</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleEmailUpdate}>
                  <div className="mb-4">
                    <Label htmlFor="email">New Email</Label>
                    <Input
                      type="email"
                      id="email"
                      name="email"
                      value={updateForm.email}
                      onChange={handleInputChange}
                      className="w-full"
                      required
                    />
                  </div>
                  
                  <div className="mb-4">
                    <Label htmlFor="currentPasswordEmail">Current Password</Label>
                    <Input
                      type="password"
                      id="currentPasswordEmail"
                      name="currentPassword"
                      value={updateForm.currentPassword}
                      onChange={handleInputChange}
                      className="w-full"
                      required
                    />
                  </div>
                  
                  <Button
                    type="submit"
                    disabled={updating.email}
                    className="w-full"
                  >
                    {updating.email ? 'Updating...' : 'Update Email'}
                  </Button>
                </form>
              </CardContent>
            </Card>
            
            {/* Password Update Card */}
            <Card>
              <CardHeader>
                <CardTitle>Update Password</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordUpdate}>
                  <div className="mb-4">
                    <Label htmlFor="currentPasswordPwd">Current Password</Label>
                    <Input
                      type="password"
                      id="currentPasswordPwd"
                      name="currentPassword"
                      value={updateForm.currentPassword}
                      onChange={handleInputChange}
                      className="w-full"
                      required
                    />
                  </div>
                  
                  <div className="mb-4">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      type="password"
                      id="newPassword"
                      name="newPassword"
                      value={updateForm.newPassword}
                      onChange={handleInputChange}
                      className="w-full"
                      required
                      minLength={6}
                    />
                  </div>
                  
                  <div className="mb-4">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      type="password"
                      id="confirmPassword"
                      name="confirmPassword"
                      value={updateForm.confirmPassword}
                      onChange={handleInputChange}
                      className="w-full"
                      required
                      minLength={6}
                    />
                  </div>
                  
                  <Button
                    type="submit"
                    disabled={updating.password}
                    className="w-full"
                  >
                    {updating.password ? 'Updating...' : 'Update Password'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Subscription Column */}
          <div className="space-y-6">
            {/* Current Subscription Card */}
            <Card>
              <CardHeader>
                <CardTitle>Current Subscription</CardTitle>
              </CardHeader>
              <CardContent>
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
                    
                    <Button
                      onClick={handleManageSubscription}
                      className="w-full mt-4"
                    >
                      Manage Subscription
                    </Button>
                  </div>
                ) : (
                  <div>
                    <p className="mb-4">You're currently on the free plan.</p>
                    <p className="mb-4">Upgrade to unlock premium features!</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Subscription Plans Card */}
            <Card>
              <CardHeader>
                <CardTitle>Subscription Plans</CardTitle>
                <CardDescription>
                  Choose a plan that works best for your needs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {plans.map((plan) => {
                    const currentPlan = getCurrentPlan();
                    const isCurrentPlan = plan.id === currentPlan;
                    
                    return (
                      <div 
                        key={plan.id} 
                        className={`p-4 border rounded-lg ${isCurrentPlan ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="font-bold">{plan.name}</h3>
                          <span className="font-semibold">{plan.price}</span>
                        </div>
                        
                        <ul className="text-sm text-gray-600 mb-3">
                          {plan.features.map((feature, index) => (
                            <li key={index} className="flex items-start mt-1">
                              <svg className="h-4 w-4 text-green-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                        
                        {isCurrentPlan ? (
                          <div className="text-sm font-medium text-blue-700">Current Plan</div>
                        ) : (
                          <Button 
                            onClick={() => handleSubscribe(plan.priceId)}
                            className="w-full"
                            variant={plan.id === 'rookie' ? "outline" : "default"}
                          >
                            {plan.id === 'rookie' ? 'Continue with Free' : 'Upgrade'}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
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