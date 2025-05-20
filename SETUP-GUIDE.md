# Sports Card Market Analysis Setup Guide

Follow these steps to set up and run the market analysis pipeline.

## Initial Setup

1. **Firebase Setup**

   You need a Firebase project with Firestore enabled:

   ```bash
   # Install Firebase CLI if you don't have it
   npm install -g firebase-tools
   
   # Login to Firebase
   firebase login
   
   # Initialize Firebase in your project (if not already done)
   firebase init
   ```

2. **Create Firebase Service Account**

   a. Go to Firebase Console: https://console.firebase.google.com/
   b. Select your project
   c. Go to Project Settings > Service Accounts
   d. Click "Generate New Private Key"
   e. Save the JSON file to `credentials/service-account.json`

3. **Install Dependencies**

   ```bash
   npm install
   ```

## Adding Cards to Track

1. Edit `scripts/scrape-queue.txt` to add card queries you want to track:

   ```
   2020 Prizm Justin Jefferson #398 PSA 10
   2023 Donruss Bijan Robinson #305 PSA 10
   2023 Prizm Anthony Richardson #343 PSA 10
   ```

## Initial Data Population

1. Make the script executable:

   ```bash
   chmod +x scripts/populate-test-data.sh
   ```

2. Run the script to populate initial data:

   ```bash
   ./scripts/populate-test-data.sh
   ```

   This will:
   - Scrape eBay for each card in your queue
   - Save all listings to `sales_raw` collection
   - Process and save analytics to `cards` collection

## Setting Up Automated Data Collection

For GitHub repository automation:

1. Add the Firebase service account as a GitHub Secret:

   a. Go to your repository Settings > Secrets > Actions
   b. Add a new secret named `FIREBASE_SERVICE_ACCOUNT`
   c. Paste the entire contents of your service account JSON file

2. The GitHub Action will now run daily at 2:00 AM UTC, scraping data for all cards in the queue.

## Testing the Frontend

1. Start the development server:

   ```bash
   npm run dev
   ```

2. Open the Market Analysis page in your browser at `/market-analyzer`

3. Search for one of the cards you added to your scrape queue

## Troubleshooting

- **No data in Firebase?** Run `scripts/scrape-one.ts` manually for a specific card
- **Scraper errors?** Check the console output for eBay response issues
- **GitHub Action failing?** Verify your FIREBASE_SERVICE_ACCOUNT secret is correct

## Monitoring

You can monitor the data collection process:

1. Visit Firebase console to see documents in the collections
2. Check GitHub Actions tab for daily run results
3. Review added cards in the app search 