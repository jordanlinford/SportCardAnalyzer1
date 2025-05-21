#!/bin/bash

# This script runs the card scraper for every entry in the scrape-queue.txt file
# to populate the database with initial test data

# Check if we have a service account file
if [ ! -f "./credentials/service-account.json" ]; then
  echo "❌ Error: No service account file found."
  echo "Please create a Firebase service account key and save it to:"
  echo "  ./credentials/service-account.json"
  exit 1
fi

# Process each line in the scrape queue
while IFS= read -r line; do
  # Skip empty lines
  if [ -z "$line" ]; then
    continue
  fi
  
  echo "🔍 Processing: $line"
  node --experimental-modules scripts/scrape-one.ts "$line"
  
  # Pause between requests to avoid rate limiting
  echo "   Waiting 10 seconds before next request..."
  sleep 10
done < scripts/scrape-queue.txt

echo "✅ Done! All cards in the queue have been processed." 