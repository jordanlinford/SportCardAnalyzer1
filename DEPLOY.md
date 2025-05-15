# Sports Card Analyzer - Vercel Deployment Guide

This guide will help you deploy the Sports Card Analyzer application to Vercel.

## Prerequisites

- A [Vercel account](https://vercel.com/signup)
- Your Firebase project with Firestore and Authentication enabled
- Firebase Admin SDK credentials (Service Account key)
- Stripe account with API keys
- GitHub repository with your code pushed

## Deployment Steps

### 1. Prepare Your GitHub Repository

Ensure your latest code is pushed to GitHub at https://github.com/jordanlinford/SportCardAnalyzer.

### 2. Connect Your Repository to Vercel

1. Log in to your [Vercel dashboard](https://vercel.com/dashboard)
2. Click "Add New" > "Project"
3. Select your GitHub repository (Sports Card Analyzer)
4. Vercel will detect it as a Vite app. Configure the deployment with:
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

### 3. Configure Environment Variables

In the "Environment Variables" section, add the following variables:

```
# Firebase Configuration
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-storage-bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id

# API URL (for serverless functions)
VITE_API_URL=/api

# Frontend URL (replace with your Vercel URL after deployment)
FRONTEND_URL=https://your-app.vercel.app

# Stripe Configuration
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret
```

### 4. Add Firebase Admin SDK Credentials

Add your Firebase Admin SDK credentials as a special environment variable:

1. Obtain your service account JSON file from the Firebase console
2. Create a new environment variable named `FIREBASE_ADMIN_CREDENTIALS`
3. Paste the **entire JSON content** of your service account file as the value
4. Make sure to properly escape any newlines in the private key portion:
   - Replace all instances of `\n` with actual newlines in the environment variable editor
   - Or use the CLI to set this variable

### 5. Deploy Your Project

1. Click "Deploy"
2. Vercel will build and deploy your project
3. After deployment, your site will be live at `https://your-app.vercel.app`

### 6. Update Webhook Endpoints

If you're using Stripe webhooks, update your Stripe webhook endpoint to point to:
`https://your-app.vercel.app/api/webhook`

### 7. Update Frontend URL

After the first deployment, go back to your environment variables and update the `FRONTEND_URL` to match your Vercel URL.

## Troubleshooting

### Firebase Admin SDK Issues

If you encounter Firebase Admin SDK initialization errors, check:

1. The `FIREBASE_ADMIN_CREDENTIALS` environment variable contains valid JSON
2. The private key section has proper newline formatting:
   ```
   "private_key": "-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
   ```

### API Calls Not Working

If API calls fail:

1. Ensure your `VITE_API_URL` is correctly set to `/api`
2. Check the API routes are correctly defined in `vercel.json`
3. Verify serverless function logs in the Vercel dashboard

### CORS Issues

If you encounter CORS errors:

1. Make sure the `FRONTEND_URL` environment variable is set correctly
2. Check that your API routes properly handle CORS headers

## Monitoring and Logs

After deployment, you can monitor your app's performance and view logs in the Vercel dashboard:

1. Go to your project in the Vercel dashboard
2. Click on "Functions" to see serverless function performance
3. Click on "Logs" to view runtime logs for debugging 