# Sports Card Price Analysis System

This document explains the pipeline for gathering and analyzing sports card market data, similar to SportCardsPro, CardLadder, and other professional platforms.

## System Overview

This system collects eBay sales data for sports cards, stores it in Firebase, and provides detailed market analysis through the app interface.

1. **Data Collection**: Automated scraping of eBay SOLD listings
2. **Data Processing**: Firebase-based aggregation and analysis 
3. **User Interface**: Intuitive search and display of market trends

## Components

### 1. Data Collection Scripts

- **`scripts/cron-scraper.ts`**: Batch script that processes a list of card queries from `scrape-queue.txt`
- **`scripts/scrape-one.ts`**: Manual tool to scrape data for a specific card
- **`.github/workflows/scrape-cards.yml`**: GitHub Action that runs the scraper daily

### 2. Data Storage

Data is stored in Firebase Firestore in two collections:

- **`sales_raw/{itemId}`**: Raw listing data from eBay
- **`cards/{id}`**: Processed market data with metrics

### 3. Firebase Functions

- **`functions/index.ts`**: Contains Cloud Function `processSale` that triggers when new raw sales are added

### 4. Frontend Integration

- **`src/services/MarketDataService.ts`**: Service for fetching processed market data
- **`src/pages/MarketAnalyzerPage.tsx`**: Integration with the UI

## Usage

### Adding Cards to Track

1. Edit `scripts/scrape-queue.txt` to add new card queries (one per line)
2. The GitHub Action will automatically scrape and process these cards daily

### Manual Data Collection

To manually scrape a specific card:

```bash
# Create service account file first
node --experimental-modules scripts/scrape-one.ts "2020 Prizm Justin Jefferson #398 PSA 10"
```

## Search Logic

The system uses a smart search approach to gather and match cards:

1. First checks Firebase for existing data matching the search parameters
2. Falls back to real-time eBay scraping if no data exists
3. Processes results with intelligent grouping algorithms

## Market Analysis Features

- **Price Trends**: Historical pricing data with visual charts
- **Comparable Sales**: Similar card variations grouped by condition and grade
- **Market Metrics**: Average price, min/max ranges, and sales volume

## Technical Details

### Firebase Schema

**`sales_raw/{itemId}`**:
```
{
  itemId: string,
  title: string,
  price: number,
  shipping: number,
  totalPrice: number,
  dateSold: string,
  imageUrl: string,
  query: string,
  status: "sold" | "active"
}
```

**`cards/{id}`**:
```
{
  year: string,
  cardNumber: string,
  grade: string,
  player: string,
  lastUpdated: timestamp,
  metrics: {
    averagePrice: number,
    minPrice: number,
    maxPrice: number,
    count: number
  },
  sales: [
    { price: number, date: string }
  ]
}
```

## Performance Considerations

- Scraping is done via a scheduled job, not at search time
- Common and popular cards are pre-cached for instant analysis
- The Firebase `cards` collection enables fast lookups by player, card number, and grade

## Future Improvements

- More sophisticated player and card set detection
- Image storage in Firebase Storage
- Better categorization of parallels and variations
- Automatic addition of trending cards to the scrape queue 