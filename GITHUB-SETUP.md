# Setting Up GitHub Actions for Automated Market Data Collection

This guide will help you set up GitHub Actions to automatically fetch sports card market data every day.

## 1. Push Your Code to GitHub

First, make sure your local repository is pushed to GitHub:

```bash
# If you haven't already initialized Git
git init

# Add your files
git add .

# Commit the changes
git commit -m "Added market analysis pipeline"

# Add your GitHub repository as remote
git remote add origin https://github.com/YOUR-USERNAME/sports-card-starter.git

# Push to GitHub
git push -u origin main
```

## 2. Add Firebase Service Account as a GitHub Secret

1. Go to your GitHub repository
2. Click on "Settings" tab
3. In the left sidebar, click on "Secrets and variables" → "Actions"
4. Click "New repository secret"
5. Set the name to `FIREBASE_SERVICE_ACCOUNT`
6. In the value field, paste the entire contents of your `credentials/service-account.json` file
7. Click "Add secret"

## 3. Verify Workflow File

Make sure the workflow file exists at `.github/workflows/daily-scraper.yml`. This file defines:

- A daily schedule (2:00 AM UTC)
- Manual trigger option
- Necessary environment setup
- The script to run for fetching market data

## 4. Run Your First Workflow Manually

1. Go to your GitHub repository
2. Click on the "Actions" tab
3. Click on "Daily Card Market Data Scraper" in the left sidebar
4. Click "Run workflow" dropdown on the right
5. Click the green "Run workflow" button

## 5. What to Expect

- The action will run and populate your Firebase database with fresh market data
- If successful, your next web app visit will use this pre-cached data
- The workflow will automatically run every day at the scheduled time

## 6. Adding More Cards

To track more cards:

1. Edit `scripts/scrape-queue.txt`
2. Add one card query per line with specific details (year, card number, grade)
3. Commit and push the changes
4. All cards in the list will be automatically scraped on the next run

## Troubleshooting

If the workflow fails:

1. Check the "Actions" tab in your repository
2. Click on the failed workflow run
3. Look for error messages in the logs
4. Check if your Firebase service account secret is properly set up 