import React from 'react';
import { Link } from 'react-router-dom';
import logo from '@/assets/logos/brand-blue.png';

export default function Footer() {
  return (
    <footer className="w-full bg-gray-100 dark:bg-background-dark text-gray-700 dark:text-white py-6 px-4 mt-12 border-t border-gray-300 dark:border-gray-700">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Logo and Brand Name */}
        <div className="flex items-center gap-3">
          <img
            src={logo}
            alt="Sports Card Analyzer Logo"
            className="h-10 w-auto object-contain select-none"
            draggable={false}
          />
          <span className="text-lg font-bold tracking-tight">Sports Card Analyzer Pro</span>
        </div>

        {/* Navigation Links */}
        <div className="flex flex-wrap justify-center gap-4 text-sm">
          <Link to="/about" className="hover:underline">About</Link>
          <Link to="/privacy" className="hover:underline">Privacy Policy</Link>
          <a href="mailto:admin@sportsanalyzer.com" className="hover:underline">Contact Support</a>
        </div>

        {/* Copyright */}
        <div className="text-xs text-center md:text-right">
          &copy; {new Date().getFullYear()} Sports Card Analyzer. All rights reserved.
        </div>
      </div>
    </footer>
  );
} 