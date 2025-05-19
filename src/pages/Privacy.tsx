import React from 'react';

export default function Privacy() {
  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
      <p className="mb-4">At Sports Card Analyzer Pro, we value your privacy. This policy explains how we collect, use, and protect your data.</p>

      <h2 className="text-xl font-semibold mt-6 mb-2">What We Collect</h2>
      <ul className="list-disc ml-6 mb-4">
        <li>Personal account info (e.g., email address)</li>
        <li>Card collection and display data you add</li>
        <li>Basic usage analytics (no sensitive data)</li>
      </ul>

      <h2 className="text-xl font-semibold mt-6 mb-2">How We Use It</h2>
      <ul className="list-disc ml-6 mb-4">
        <li>To operate your account and collection</li>
        <li>To improve app performance and experience</li>
        <li>To contact you with important updates</li>
      </ul>

      <h2 className="text-xl font-semibold mt-6 mb-2">Your Rights</h2>
      <p className="mb-4">You can request deletion of your data at any time by emailing <a href="mailto:admin@sportsanalyzer.com" className="text-blue-600 underline">admin@sportsanalyzer.com</a>.</p>

      <p className="text-sm text-gray-600 mt-6">Last updated: May 2025</p>
    </div>
  );
} 