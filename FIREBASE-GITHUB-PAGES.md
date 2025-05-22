# Setting Up Firebase for GitHub Pages Deployment

To properly deploy this application to GitHub Pages with Firebase authentication working, you need to set up the necessary Firebase credentials as GitHub repository secrets.

## 1. Add Firebase Credentials as GitHub Secrets

1. Go to your GitHub repository
2. Click on "Settings" tab
3. In the left sidebar, click on "Secrets and variables" → "Actions"
4. Add the following secrets by clicking "New repository secret" for each one:

| Secret Name | Value |
|-------------|-------|
| `FIREBASE_API_KEY` | Your Firebase API Key |
| `FIREBASE_AUTH_DOMAIN` | Your Firebase Auth Domain (e.g., `your-project-id.firebaseapp.com`) |
| `FIREBASE_PROJECT_ID` | Your Firebase Project ID |
| `FIREBASE_STORAGE_BUCKET` | Your Firebase Storage Bucket |
| `FIREBASE_MESSAGING_SENDER_ID` | Your Firebase Messaging Sender ID |
| `FIREBASE_APP_ID` | Your Firebase App ID |
| `FIREBASE_MEASUREMENT_ID` | Your Firebase Measurement ID (optional) |

You can find all these values in your Firebase project settings.

## 2. Configure CORS in Firebase

For authentication to work properly with GitHub Pages, you need to add your GitHub Pages domain to the authorized domains in Firebase:

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to "Authentication" → "Settings" → "Authorized domains"
4. Add your GitHub Pages domain (e.g., `username.github.io`)

## 3. Deploy to GitHub Pages

After setting up the secrets, push your changes to the main branch. GitHub Actions will automatically build and deploy your application to GitHub Pages with the Firebase configuration.

## Troubleshooting

If you're encountering issues with Firebase authentication after deployment:

1. Check that all the required secrets are set up correctly in GitHub
2. Verify that your GitHub Pages domain is added to Firebase authorized domains
3. Look at the browser console for any Firebase-related errors
4. Make sure your Firebase project has Authentication enabled with the desired providers (Email/Password, Google, etc.)

## Local Testing

To test locally with the same environment setup, create a `.env.local` file in the root directory with the same Firebase configuration variables:

```
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id
```

Then run `npm run dev:client` to start the development server. 