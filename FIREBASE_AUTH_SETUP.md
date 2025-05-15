# Firebase Authentication Setup Guide

## Adding Your Domain to Firebase Authorized Domains

To fix the `auth/unauthorized-domain` error you're seeing, follow these steps:

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. In the left sidebar, click on "Authentication"
4. Click on the "Settings" tab at the top
5. Scroll down to the "Authorized domains" section
6. Click "Add domain"
7. Add your website domain (e.g., `www.sportscardanalyzer.com`)
8. Click "Add"

After completing these steps, Firebase Authentication will work on your domain.

## Troubleshooting

If you still see authentication errors after adding your domain:

1. Make sure you've added the exact domain that appears in your browser's address bar
2. Check for any subdomains - if you're using `www.sportscardanalyzer.com`, that's different from just `sportscardanalyzer.com`
3. Sometimes changes take a few minutes to propagate - try clearing your browser cache or using a private/incognito window
4. Ensure your Firebase config in the app has the correct project settings

## API Connection

The app is now configured to automatically use relative API paths in production, so the API connection issues should be resolved.

## Missing Assets

The placeholder icon files have been added to the project. For a production deployment, you should replace them with proper branded icons and logos. 