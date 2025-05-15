# Sports Card Analyzer

A full-stack application for managing sports card collections with automatic market value tracking and display case features. Built with React, TypeScript, Tailwind CSS, and Firebase.

## Features

* **User Authentication & Authorization**: Secure user accounts via Firebase Authentication
* **Collection Management**: Add, edit, and organize your cards with detailed information
* **Display Cases**: Create virtual display cases to showcase your collection
* **Public Sharing**: Share your display cases with other collectors
* **Market Value Tracking**: Real-time value tracking using eBay completed listings data
* **Trade Analyzer**: Compare card values to make informed trading decisions
* **Subscription Tiers**: Free and premium subscription options with Stripe integration
* **Mobile Responsive**: Optimized for all device sizes with a modern UI

## Tech Stack

### Frontend
* React with TypeScript
* Vite for fast development
* Tailwind CSS for styling
* React Router for navigation
* TanStack Query for data fetching
* ApexCharts for data visualization

### Backend
* Express.js server
* Firebase Admin SDK
* Firestore database
* Stripe for subscription management
* Web scraping for real-time eBay data

## Live Demo

The application is deployed and can be accessed at [sportscardanalyzer.com](https://sportscardanalyzer.com).

## Getting Started

### Prerequisites
* Node.js (v18 or higher)
* Firebase account
* Stripe account (for subscription features)
* Git

### Local Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/jordanlinford/SportCardAnalyzer.git
   cd SportCardAnalyzer
   ```

2. Install dependencies:
   ```bash
   npm install
   cd server
   npm install
   cd ..
   ```

3. Set up environment variables:
   - Create a `.env.local` file in the root directory
   - Create a `.env` file in the server directory
   - Add the following variables:

   **.env.local**:
   ```
   VITE_FIREBASE_API_KEY=your-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-storage-bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   VITE_FIREBASE_APP_ID=your-app-id
   VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id
   VITE_API_URL=http://localhost:3001/api
   ```

   **server/.env**:
   ```
   STRIPE_SECRET_KEY=your-stripe-secret-key
   STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret
   FRONTEND_URL=http://localhost:5173
   ```

4. Create a Firebase Admin SDK Service Account:
   - Go to your Firebase console > Project settings > Service accounts
   - Generate a new private key
   - Save the JSON file as `server/serviceAccountKey.json`

5. Start the development servers:
   ```bash
   # In one terminal, start the frontend
   npm run dev

   # In another terminal, start the backend
   npm run dev:server
   ```

6. Open your browser and navigate to `http://localhost:5173`

## Deployment on Vercel

The application is configured for deployment on Vercel. Check out [VERCEL.md](VERCEL.md) for detailed deployment instructions.

## Project Structure

```
/
├── public/                # Static assets
├── server/                # Backend server
│   ├── api/               # API endpoints (for Vercel serverless)
│   └── index.js           # Express server entry point
├── src/
│   ├── components/        # React components
│   ├── context/           # Context providers
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utility functions and Firebase config
│   ├── pages/             # Page components
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Helper utilities
├── .env.local             # Local environment variables (frontend)
├── server/.env            # Local environment variables (backend)
└── vercel.json            # Vercel deployment configuration
```

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/new-feature`
3. Commit your changes: `git commit -m 'Add new feature'`
4. Push to the branch: `git push origin feature/new-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

* [Tailwind UI](https://tailwindui.com) for UI components inspiration
* [shadcn/ui](https://ui.shadcn.com/) for React component basis
* [Vercel](https://vercel.com) for hosting and serverless functions 