import React from 'react';

export default function Terms() {
  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-4">Terms &amp; Conditions</h1>
      <p className="mb-4">Welcome to Sports Card Analyzer Pro. By using our app, you agree to the following terms and conditions. Please read them carefully.</p>

      <h2 className="text-xl font-semibold mt-6 mb-2">Use of Service</h2>
      <ul className="list-disc ml-6 mb-4">
        <li>You must be at least 13 years old to use this app.</li>
        <li>Do not use the app for unlawful or prohibited activities.</li>
        <li>Respect the intellectual property rights of others.</li>
      </ul>

      <h2 className="text-xl font-semibold mt-6 mb-2">Subscriptions &amp; Payments</h2>
      <ul className="list-disc ml-6 mb-4">
        <li>Some features require a paid subscription.</li>
        <li>All payments are processed securely. No payment info is stored on our servers.</li>
        <li>Subscriptions can be cancelled at any time from your account settings.</li>
      </ul>

      <h2 className="text-xl font-semibold mt-6 mb-2">Liability</h2>
      <ul className="list-disc ml-6 mb-4">
        <li>We do our best to provide accurate data, but we do not guarantee the accuracy or completeness of any information.</li>
        <li>Sports Card Analyzer Pro is not responsible for any losses or damages resulting from use of the app.</li>
      </ul>

      <p className="text-sm text-gray-600 mt-6">Last updated: May 2025</p>
    </div>
  );
} 