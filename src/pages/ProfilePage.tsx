import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useUserSubscription } from '@/hooks/useUserSubscription';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useNavigate } from 'react-router-dom';
import { db } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { API_URL } from '@/lib/firebase/config';

export default function ProfilePage() {
  const { user } = useAuth();
  const { tier: subscriptionTier, loading: subscriptionLoading } = useUserSubscription();
  const [managementUrl, setManagementUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

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
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
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
        console.error('No URL returned from portal session creation');
      }
    } catch (error) {
      console.error('Error creating portal session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const upgradeSubscription = () => {
    navigate('/pricing');
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
    <div className="container mx-auto py-8">
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
              <h3 className="font-medium">Account</h3>
              <div className="mt-2 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Member since</p>
                  <p>{userData.createdAt?.toLocaleDateString() || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Subscription</p>
                  <p className="capitalize">{subscriptionTier || userData.subscriptionTier} Plan</p>
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
        
        <CardFooter className="flex justify-between">
          {subscriptionTier === 'rookie' ? (
            <Button onClick={upgradeSubscription}>Upgrade Plan</Button>
          ) : (
            <Button variant="outline" onClick={createPortalSession} disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Manage Subscription'}
            </Button>
          )}
          <Button variant="ghost" onClick={() => navigate('/display-cases')}>View Display Cases</Button>
        </CardFooter>
      </Card>
    </div>
  );
} 