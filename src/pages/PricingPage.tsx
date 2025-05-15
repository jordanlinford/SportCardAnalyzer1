import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function PricingPage() {
  const { user } = useAuth();
  const [subscriptionInterval, setSubscriptionInterval] = useState<'monthly' | 'annual'>('monthly');
  const [isLoading, setIsLoading] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);

  const plans = [
    {
      id: 'free',
      name: 'Free',
      monthlyPrice: 0,
      annualPrice: 0,
      features: [
        'Basic Card Tracking',
        '5 Display Cases',
        'Limited Collection Size',
        'Community Access',
      ],
      priceId: {
        monthly: 'price_1RN5t3GCix0pRkbmBX32A7AG',
        annual: 'price_1RN5t3GCix0pRkbmBX32A7AG',
      },
    },
    {
      id: 'star',
      name: 'Star Rookie',
      monthlyPrice: 9.99,
      annualPrice: 99.99,
      features: [
        'Basic Collection Management',
        'Market Price Tracking',
        'Trade Analyzer Access',
        '25 Display Cases',
      ],
      priceId: {
        monthly: 'price_1RDB4fGCix0pRkbmlNdsyo7s',
        annual: 'price_1RN5uOGCix0pRkbmK2kCjqw4',
      },
    },
    {
      id: 'veteran',
      name: 'Hall of Fame',
      monthlyPrice: 19.99,
      annualPrice: 199.99,
      features: [
        'Advanced Collection Management',
        'Real-time Market Analytics',
        'Price Prediction Tools',
        'Unlimited Display Cases',
        'Priority Support',
      ],
      priceId: {
        monthly: 'price_1RDB4fGCix0pRkbmmPrBX8FE',
        annual: 'price_1RN5vwGCix0pRkbmT65EllS1',
      },
      recommended: true,
    },
  ];

  // Define the debug mode - set this to true when you need to debug pricing plans
  const isDebugMode = false;

  // For debugging purposes - view available pricing plans in Stripe
  useEffect(() => {
    if (isDebugMode) {
      const checkServer = async () => {
        try {
          const serverCheck = await fetch('http://localhost:3001/api/health-check');
          if (serverCheck.ok) {
            console.log('Server is running');
          } else {
            console.error('Server returned error:', await serverCheck.text());
          }
        } catch (error) {
          console.error('Error checking server:', error);
        }
      };
      
      checkServer();
    }
  }, [isDebugMode]);

  const handleSubscribe = async (planId: string) => {
    if (planId === 'free') {
      // For free tier, just redirect to profile
      window.location.href = '/profile';
      return;
    }
    
    if (!user) {
      window.location.href = '/login?redirect=pricing';
      return;
    }

    setIsLoading(true);
    setStripeError(null);
    
    try {
      const plan = plans.find(p => p.id === planId);
      if (!plan) throw new Error('Invalid plan selected');

      const priceId = plan.priceId[subscriptionInterval];
      
      console.log(`Subscribing to ${plan.name} with price ID: ${priceId}`);
      
      const response = await fetch('http://localhost:3001/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          userId: user.uid,
          planName: plan.name,
          interval: subscriptionInterval
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        const errorMessage = data.message || `Server error: ${response.status}`;
        console.error('Checkout error:', errorMessage);
        setStripeError(`Failed to start checkout process: ${errorMessage}`);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        setStripeError('No checkout URL in response. Please try again or contact support.');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setStripeError(`Failed to start checkout process: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container max-w-6xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">Choose Your Subscription Plan</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Get access to premium features and take your sports card collection to the next level
        </p>

        {stripeError && (
          <div className="mt-4 p-4 bg-red-100 text-red-800 rounded-md max-w-2xl mx-auto">
            {stripeError}
            <div className="mt-2 text-sm">
              The server might be offline or there could be an issue with Stripe. Please try again later or contact support.
            </div>
          </div>
        )}
        
        <div className="flex justify-center mt-8 bg-gray-100 p-1 rounded-lg inline-flex">
          <button
            onClick={() => setSubscriptionInterval('monthly')}
            className={`px-4 py-2 rounded-md ${
              subscriptionInterval === 'monthly' ? 'bg-white shadow-sm' : 'text-gray-600'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setSubscriptionInterval('annual')}
            className={`px-4 py-2 rounded-md ${
              subscriptionInterval === 'annual' ? 'bg-white shadow-sm' : 'text-gray-600'
            }`}
          >
            Annual <span className="text-sm text-green-600 font-medium">Save 15%</span>
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {plans.map((plan) => (
          <Card key={plan.id} className={`overflow-hidden ${plan.recommended ? 'border-blue-500 border-2' : ''}`}>
            {plan.recommended && (
              <div className="bg-blue-500 text-white text-center py-1 text-sm font-medium">
                RECOMMENDED
              </div>
            )}
            <div className="p-6">
              <h3 className="text-2xl font-bold">{plan.name}</h3>
              <div className="mt-4 mb-6">
                <span className="text-4xl font-bold">
                  ${subscriptionInterval === 'monthly' ? plan.monthlyPrice : plan.annualPrice}
                </span>
                <span className="text-gray-600">
                  {plan.id === 'free' ? '' : subscriptionInterval === 'monthly' ? '/month' : '/year'}
                </span>
              </div>
              
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              
              <Button
                onClick={() => handleSubscribe(plan.id)}
                disabled={isLoading}
                className={`w-full py-2 ${plan.id === 'free' ? 'bg-gray-500 hover:bg-gray-600' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {plan.id === 'free' ? 'Start Free' : isLoading ? 'Processing...' : 'Subscribe Now'}
              </Button>
              
              {isDebugMode && (
                <div className="mt-4 text-xs text-gray-500">
                  Price ID ({subscriptionInterval}): {plan.priceId[subscriptionInterval]}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      <div className="text-center mt-12 text-gray-600 text-sm">
        <p>Paid plans include a 7-day free trial. Cancel anytime.</p>
        <p className="mt-2">Questions? Contact our support team at support@sportscardanalyzer.com</p>
      </div>
    </div>
  );
} 