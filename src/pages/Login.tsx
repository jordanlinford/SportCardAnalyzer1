import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const Login = () => {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword, loading: authLoading, user } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleGoogleSignIn = async () => {
    try {
      setIsSigningIn(true);
      await signInWithGoogle();
    } catch (error) {
      console.error("Error signing in with Google:", error);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSigningIn(true);

    try {
      if (isRegistering) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
      navigate('/dashboard');
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      setError("Please enter your email address");
      return;
    }

    try {
      await resetPassword(email);
      setShowResetPassword(false);
    } catch (error: any) {
      setError(error.message);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {showResetPassword 
              ? "Reset your password"
              : isRegistering 
                ? "Create your account" 
                : "Sign in to your account"}
          </h2>
        </div>

        {!showResetPassword ? (
          <form className="mt-8 space-y-6" onSubmit={handleEmailAuth}>
            <div className="rounded-md shadow-sm space-y-4">
              <div>
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={isRegistering ? "new-password" : "current-password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
              </div>
            </div>

            {error && (
              <div className="text-red-600 text-sm text-center">
                {error}
              </div>
            )}

            <div className="flex flex-col space-y-4">
              <Button
                type="submit"
                disabled={isSigningIn}
                className="w-full"
              >
                {isSigningIn 
                  ? (isRegistering ? "Creating account..." : "Signing in...")
                  : (isRegistering ? "Create account" : "Sign in")}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                className="w-full"
              >
                <img
                  className="h-5 w-5 mr-2"
                  src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                  alt="Google logo"
                />
                Sign in with Google
              </Button>
            </div>
          </form>
        ) : (
          <div className="mt-8 space-y-6">
            <div>
              <Label htmlFor="reset-email">Email address</Label>
              <Input
                id="reset-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm text-center">
                {error}
              </div>
            )}

            <div className="flex flex-col space-y-4">
              <Button
                onClick={handlePasswordReset}
                className="w-full"
              >
                Send Reset Link
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowResetPassword(false)}
                className="w-full"
              >
                Back to login
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col items-center space-y-2">
          {!showResetPassword && (
            <>
              <button
                type="button"
                onClick={() => setIsRegistering(!isRegistering)}
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                {isRegistering 
                  ? "Already have an account? Sign in"
                  : "Don't have an account? Register"}
              </button>
              {!isRegistering && (
                <button
                  type="button"
                  onClick={() => setShowResetPassword(true)}
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  Forgot your password?
                </button>
              )}
            </>
          )}
          <Link
            to="/"
            className="text-sm text-blue-600 hover:text-blue-500"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;