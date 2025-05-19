import React from 'react';
import appLogo from '../assets/logos/brand-blue.png';

export default function ChartLogo() {
  return (
    <img
      src={appLogo}
      alt="App Logo"
      className="h-16 w-auto select-none"
      draggable={false}
    />
  );
} 