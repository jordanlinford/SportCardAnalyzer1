# Sports Card App Deployment Guide

This guide explains how to deploy the Sports Card App to Vercel, ensuring both the frontend React application and backend Python API work correctly.

## Deployment Architecture

The application consists of two parts that need to be deployed:

1. **Frontend**: React/TypeScript application (main app)
2. **Backend**: Python FastAPI service for market analysis and card scraping

## Preparing for Deployment

Before deploying, ensure:

1. All code changes are committed to GitHub
2. Your Firebase project is properly configured
3. You have a Vercel account connected to your GitHub

## Deployment Steps

### Step 1: Deploy the Backend API

The backend needs to be deployed first as a separate service:

1. Navigate to the `/backend` directory
2. Make sure `requirements.txt` contains all needed dependencies
3. Deploy to Vercel using one of these methods:

   **Using Vercel CLI:**

   ```bash
   cd backend
   vercel
   # Follow the prompts
   vercel --prod  # When ready for production
   ```

   **Using Vercel Dashboard:**

   - Import your GitHub project
   - Set the root directory to `/backend`
   - Set the build command to empty
   - Set the output directory to empty
   - Set the install command to `pip install -r requirements.txt`
   - Add environment variables if needed (e.g., Firebase credentials)

4. Note the deployed URL (should be something like `https://sports-card-api.vercel.app`)

### Step 2: Update API URL in Frontend Configuration

1. Open `/src/lib/firebase/config.ts`
2. Update the `API_URL` variable to point to your deployed backend:

   ```typescript
   export const API_URL = import.meta.env.PROD 
     ? 'https://your-backend-url.vercel.app/api'  // Update with actual URL
     : 'http://localhost:8000/api';
   ```

3. Commit and push this change to GitHub

### Step 3: Deploy the Frontend Application

1. Deploy the main application:

   **Using Vercel CLI:**

   ```bash
   cd /Users/jordanreedlinford/Desktop/sports-card-starter
   vercel
   # Follow the prompts
   vercel --prod  # When ready for production
   ```

   **Using Vercel Dashboard:**

   - Import your GitHub project
   - Use the root directory (don't change)
   - Let Vercel auto-detect settings for a React application
   - Add environment variables for Firebase (VITE_FIREBASE_*)

2. Test the deployed application

## Troubleshooting

If the market analyzer doesn't work in production:

1. Verify API connectivity using the test utility:

   ```typescript
   import { testMarketAnalyzerConnection } from "@/utils/testApiConnection";
   
   // In your app initialization
   testMarketAnalyzerConnection().then(result => {
     console.log("API Connection Test:", result);
   });
   ```

2. Check CORS settings in the backend
3. Verify API logs in Vercel dashboard
4. Try the alternative endpoints test if the main one fails

## Separate Backend Deployment (Recommended Approach)

For better scalability, we recommend deploying the backend as a completely separate Vercel project:

1. Create a new GitHub repository for just the backend code
2. Copy the `/backend` directory there
3. Set up CI/CD in Vercel for this repository
4. Update the `API_URL` in the frontend to point to this dedicated backend service

This separation allows independent scaling and updates of the frontend and backend.

## Environment Variables

**Frontend (set in Vercel):**

```
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

**Backend (set in Vercel):**

```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
``` 