import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase/config';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Bell } from 'lucide-react';
import brandLogo from '@/assets/logos/brand-blue.png';
import About from '@/pages/About';

export default function Navbar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [totalComments, setTotalComments] = useState(0);
  const [totalNotifications, setTotalNotifications] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user) return;

    setIsLoading(true);

    const messagesRef = collection(db, "messages");
    const messagesQuery = query(
      messagesRef,
      where("recipientId", "==", user.uid),
      where("read", "==", false),
      orderBy("timestamp", "desc")
    );

    const unsubMessages = onSnapshot(messagesQuery, (snapshot) => {
      setUnreadMessages(snapshot.docs.length);
      updateTotalNotifications(snapshot.docs.length, totalComments);
      setIsLoading(false);
    }, (error) => {
      console.error("Error getting unread messages:", error);
      setIsLoading(false);
    });

    const fetchDisplayCasesAndComments = async () => {
      try {
        const publicCasesRef = collection(db, "public_display_cases");
        const publicCasesQuery = query(publicCasesRef, where("userId", "==", user.uid));
        const publicCasesSnap = await getDocs(publicCasesQuery);

        let commentCount = 0;
        for (const displayCaseDoc of publicCasesSnap.docs) {
          const displayCaseData = displayCaseDoc.data();
          if (displayCaseData.comments && Array.isArray(displayCaseData.comments)) {
            commentCount += displayCaseData.comments.length;
          }
        }

        setTotalComments(commentCount);
        updateTotalNotifications(unreadMessages, commentCount);

        return () => {};
      } catch (error) {
        console.error("Error fetching display cases or comments:", error);
        return () => {};
      }
    };

    fetchDisplayCasesAndComments();
    return () => {
      unsubMessages();
    };
  }, [user]);

  const updateTotalNotifications = (messages: number, comments: number) => {
    setTotalNotifications(messages + comments);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <>
      <nav className="w-full h-16 bg-white dark:bg-background-dark shadow-md px-6 flex items-center justify-between relative z-50">
        <Link to="/" className="flex items-center gap-3 pl-1">
          <img
            src={brandLogo}
            alt="Sports Card Analyzer Logo"
            className="h-24 max-h-24 w-auto object-contain select-none"
            style={{ maxHeight: '60px' }}
            draggable={false}
          />
          <span className="text-2xl font-bold text-primary whitespace-nowrap">
            Sports Card Analyzer
          </span>
        </Link>

        <button
          className="md:hidden p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
          onClick={toggleMobileMenu}
          aria-label="Toggle menu"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            className="h-6 w-6"
          >
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>

        <div className="hidden md:flex gap-4 ml-8 items-center">
          <NavLink to="/dashboard" label="Dashboard" active={location.pathname === '/dashboard'} />
          <NavLink to="/collection" label="Collection" active={location.pathname === '/collection'} />
          <NavLink to="/display-cases" label="Display Cases" active={location.pathname === '/display-cases'} />
          <NavLink to="/market-analyzer" label="Market Analyzer" active={location.pathname === '/market-analyzer'} />
          <NavLink to="/trade-analyzer" label="Trade Analyzer" active={location.pathname.startsWith('/trade-analyzer')} />
          {user && <NavLink to="/profile" label="Profile" active={location.pathname === '/profile'} />}
        </div>

        <div className="hidden md:flex items-center gap-4">
          {user && (
            <div className="relative">
              <Link to="/dashboard" className="flex items-center gap-1">
                <Bell className="h-5 w-5 text-gray-500" />
                {totalNotifications > 0 && !isLoading && (
                  <Badge className="absolute -top-2 -right-2 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
                    {totalNotifications}
                  </Badge>
                )}
              </Link>
            </div>
          )}
          {user ? (
            <button
              onClick={handleLogout}
              className="text-sm text-red-600 hover:text-red-900 font-bold px-3 py-1 rounded-2xl bg-red-50 dark:bg-red-900/20"
            >
              Sign Out
            </button>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-primary hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              Sign in
            </Link>
          )}
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-white dark:bg-background-dark shadow-lg p-4 flex flex-col gap-2 border-t border-gray-200">
            <MobileNavLink to="/dashboard" label="Dashboard" active={location.pathname === '/dashboard'} onClick={() => setMobileMenuOpen(false)} />
            <MobileNavLink to="/collection" label="Collection" active={location.pathname === '/collection'} onClick={() => setMobileMenuOpen(false)} />
            <MobileNavLink to="/display-cases" label="Display Cases" active={location.pathname === '/display-cases'} onClick={() => setMobileMenuOpen(false)} />
            <MobileNavLink to="/market-analyzer" label="Market Analyzer" active={location.pathname === '/market-analyzer'} onClick={() => setMobileMenuOpen(false)} />
            <MobileNavLink to="/trade-analyzer" label="Trade Analyzer" active={location.pathname.startsWith('/trade-analyzer')} onClick={() => setMobileMenuOpen(false)} />
            {user && (
              <div className="flex items-center">
                <MobileNavLink to="/profile" label="Profile" active={location.pathname === '/profile'} onClick={() => setMobileMenuOpen(false)} />
                {totalNotifications > 0 && (
                  <Badge className="ml-2 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
                    {totalNotifications}
                  </Badge>
                )}
              </div>
            )}

            <div className="border-t border-gray-200 dark:border-gray-700 mt-2 pt-2">
              {user ? (
                <button
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-left text-red-600 hover:text-red-900 py-2 px-3 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Sign Out
                </button>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block w-full text-left text-primary hover:text-secondary py-2 px-3 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>
    </>
  );
}

function NavLink({ to, label, active }: { to: string; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      className={`font-body text-lg px-3 py-1 rounded-2xl transition-colors ${
        active
          ? 'bg-primary text-white dark:bg-secondary dark:text-background-dark'
          : 'text-primary dark:text-secondary hover:bg-primary/10 dark:hover:bg-secondary/20'
      }`}
    >
      {label}
    </Link>
  );
}

function MobileNavLink({ to, label, active, onClick }: { to: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`block py-2 px-3 rounded-md transition-colors ${
        active
          ? 'bg-primary text-white dark:bg-secondary dark:text-background-dark'
          : 'text-primary dark:text-secondary hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
    >
      {label}
    </Link>
  );
}
