import React from 'react';

export default function About() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">About Sports Card Analyzer Pro</h1>

      <p>
        Sports Card Analyzer Pro is a powerful web application built to help collectors track,
        value, and analyze sports cards in real time. With tools for market analysis, collection
        tracking, and trade evaluation, our goal is to make your collecting smarter, easier, and
        more profitable.
      </p>

      <p>
        This project was created by a passionate collector to bridge the gap between raw eBay
        market data and real-time decision-making tools. Whether you collect vintage, modern, or
        prospecting cards, this app was made for you.
      </p>

      <h2 className="text-2xl font-semibold mt-6">FAQs</h2>

      <ul className="list-disc pl-5 space-y-2">
        <li><strong>Is this app free?</strong> You can get started for free with limited features. Advanced tools are available through a paid subscription.</li>
        <li><strong>Where does the pricing data come from?</strong> We scrape eBay data in real-time and apply AI models to analyze it.</li>
        <li><strong>Can I export my collection?</strong> Yes, you can export your collection to CSV from the dashboard.</li>
        <li><strong>How do I contact support?</strong> Email us at <a className="text-blue-500 underline" href="mailto:admin@sportsanalyzer.com">admin@sportsanalyzer.com</a>.</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-6">Legal</h2>
      <p>
        Read our <a href="/privacy" className="text-blue-500 underline">Privacy Policy</a> and <a href="/terms" className="text-blue-500 underline">Terms & Conditions</a> to understand how your data is used.
      </p>

      <section className="mb-8" id="privacy">
        <h2 className="text-xl font-semibold mb-2">Privacy Policy</h2>
        <p>
          We do not sell or share your data. We collect only what's necessary to provide you with an optimal user
          experience. Data such as your collection, account info, and browsing behavior stays private and secure.
        </p>
      </section>

      <section className="mb-8" id="terms">
        <h2 className="text-xl font-semibold mb-2">Terms & Conditions</h2>
        <p>
          By using Sports Card Analyzer, you agree not to misuse the platform for illegal purposes, scraping data,
          or violating any applicable laws. We reserve the right to revoke access for violations.
        </p>
      </section>

      <section className="mb-8" id="cookies">
        <h2 className="text-xl font-semibold mb-2">Cookies</h2>
        <p>
          We use essential cookies to keep you logged in and to enhance functionality. You can clear cookies in your
          browser at any time.
        </p>
      </section>
    </div>
  );
} 