import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Trophy, Youtube, Star, BarChart4, TrendingUp, MonitorPlay } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-700 to-indigo-900 text-white py-20 px-6 text-center">
        <h1 className="text-4xl md:text-6xl font-bold mb-4">Welcome to Sports Card Analyzer Pro</h1>
        <p className="text-xl md:text-2xl max-w-3xl mx-auto mb-6">
          The most advanced sports card pricing and portfolio platform on the web — totally free to join.
        </p>
        <Link to="/login">
          <Button size="lg" className="bg-white text-blue-700 font-bold text-lg hover:bg-blue-100">
            Get Started For Free <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Link>
      </section>

      {/* Value Props */}
      <section className="py-16 px-6 bg-gray-50 text-center">
        <h2 className="text-3xl font-bold mb-10">Why Collectors Love Sports Card Analyzer</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <ValueProp icon={TrendingUp} title="Accurate Price Forecasting" text="Leverage real market trends to see where your cards are headed next." />
          <ValueProp icon={BarChart4} title="Dynamic Profit Calculator" text="See ROI on every card — raw or graded — in your collection or wishlist." />
          <ValueProp icon={MonitorPlay} title="In-Depth Trade Analyzer" text="Compare any trade scenario and determine real-world fairness instantly." />
          <ValueProp icon={Star} title="Digital Display Cases" text="Show off your collection with sleek, shareable digital cases." />
          <ValueProp icon={Trophy} title="Promos & Giveaways" text="We regularly reward users with rare cards, swag, and insider perks." />
          <ValueProp icon={Youtube} title="Social & Content Feed" text="Watch the latest TikToks, YouTube breakdowns, and card drops — right from your dashboard." />
        </div>
      </section>

      {/* Featured Content */}
      <section className="bg-white py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-10">Coming Soon: Top Display Cases Contest!</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="w-full aspect-video">
              <iframe
                width="100%"
                height="100%"
                className="rounded-lg"
                src="https://www.youtube.com/embed/YOUR_VIDEO_ID"
                title="YouTube video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
            <div className="bg-gray-100 p-6 rounded-lg shadow-md">
              <h3 className="text-2xl font-semibold mb-2">Coming Soon: Top Display Cases Contest!</h3>
              <p className="mb-4 text-gray-700">Show off your best display case for a chance to win exclusive prizes. Stay tuned for details and how to enter!</p>
              <Link to="/display-cases">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                  Build Your Display Case
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ValueProp({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center text-center p-4 bg-white shadow-sm rounded-md">
      <Icon className="h-10 w-10 text-blue-600 mb-3" />
      <h3 className="text-xl font-semibold mb-1">{title}</h3>
      <p className="text-gray-600">{text}</p>
    </div>
  );
} 