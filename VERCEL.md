# Sports Card Analyzer - Vercel Deployment Guide

This document provides instructions for deploying the Sports Card Analyzer application to Vercel.

## Prerequisites

- A Vercel account
- A Firebase project with Firestore and Authentication enabled
- Your Firebase Admin SDK credentials

## Deployment Steps

### 1. Prepare Your Environment Variables

You'll need to add the following environment variables in your Vercel project settings:

```
# Firebase Configuration
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-storage-bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id

# API URLs
VITE_API_URL=https://your-vercel-deployment.vercel.app/api
FRONTEND_URL=https://your-vercel-deployment.vercel.app

# Stripe Configuration
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret
```

### 2. Firebase Admin SDK Credentials

For Firebase Admin SDK to work correctly in serverless functions, you need to add your Firebase Admin SDK credentials as environment variables. In Vercel:

1. Go to your project settings
2. Navigate to the Environment Variables section
3. Add a new environment variable called `FIREBASE_ADMIN_CREDENTIALS`
4. Paste the entire contents of your `firebase-adminsdk.json` file as the value
5. Make sure to properly escape any quotes or special characters

### 3. Deploy to Vercel

You can deploy to Vercel directly using one of these methods:

#### Using Vercel CLI

```bash
# Install Vercel CLI if you haven't already
npm i -g vercel

# Login to Vercel
vercel login

# Deploy from your project root
vercel
```

#### Using GitHub Integration

1. Push your code to GitHub
2. Import your repository in the Vercel dashboard
3. Configure your project settings
4. Deploy

### 4. Serverless Functions Configuration

The provided `vercel.json` file in this repository configures your application for Vercel's serverless architecture:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    },
    {
      "src": "server/api/*.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "server/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

### 5. Environment Variable Access in Serverless Functions

In your serverless functions, you'll need to access environment variables like this:

```javascript
// For Firebase Admin SDK credentials
const firebaseAdminCredentials = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS);
admin.initializeApp({
  credential: admin.credential.cert(firebaseAdminCredentials)
});
```

### 6. Troubleshooting

If you encounter the following issues:

1. **Firebase Admin SDK Initialization Errors**: Make sure your FIREBASE_ADMIN_CREDENTIALS environment variable is properly formatted JSON without extra escaping.

2. **CORS Issues**: Check that your serverless functions have proper CORS headers as already configured in the API endpoints.

3. **Serverless Function Timeouts**: For long-running operations like eBay scraping, you may need to upgrade your Vercel plan or optimize the functions to execute more quickly.

## Important Notes

- The Firebase Admin SDK is initialized with service account credentials in the serverless functions
- All API routes are available at `/api/*` path
- Frontend routes will be handled by the React Router 