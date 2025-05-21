import axios from 'axios';
import { normalizeQuery, generateEbayUrl, proxyEbayImage, detectGrade } from '../utils/ebay.js';
import { cacheImage, getKnownCardImage } from '../utils/image.js';

// Helper function to scrape eBay listings
export async function scrapeEbayListings(query) {
  try {
    const normalizedQuery = normalizeQuery(query);
    const url = generateEbayUrl(normalizedQuery);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    const html = response.data;
    const listings = [];

    // Extract listings using regex patterns
    const listingPattern = /<div class="s-item__info clearfix">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
    let match;

    while ((match = listingPattern.exec(html)) !== null) {
      const listingHtml = match[1];
      
      // Extract title
      const titleMatch = listingHtml.match(/<h3 class="s-item__title">([\s\S]*?)<\/h3>/);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      
      // Extract price
      const priceMatch = listingHtml.match(/<span class="s-item__price">([\s\S]*?)<\/span>/);
      const price = priceMatch ? priceMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      
      // Extract image URL
      const imgMatch = listingHtml.match(/<img[^>]*src="([^"]*)"[^>]*>/);
      const imgUrl = imgMatch ? imgMatch[1] : '';
      
      // Extract listing URL
      const urlMatch = listingHtml.match(/<a[^>]*href="([^"]*)"[^>]*>/);
      const listingUrl = urlMatch ? urlMatch[1] : '';
      
      // Extract date sold
      const dateMatch = listingHtml.match(/<span class="s-item__title--tagblock">([\s\S]*?)<\/span>/);
      const dateSold = dateMatch ? dateMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      
      // Extract grade if present
      const grade = detectGrade(title);
      
      // Get known card image if available
      const knownImage = getKnownCardImage(title);
      
      if (title && price && imgUrl && listingUrl) {
        listings.push({
          title,
          price,
          imgUrl: knownImage || proxyEbayImage(imgUrl),
          listingUrl,
          dateSold,
          grade
        });
      }
    }

    // Enrich listings with full-size images
    for (const listing of listings) {
      if (listing.imgUrl && !listing.imgUrl.startsWith('/api/ebay/image-proxy')) {
        const proxyUrl = proxyEbayImage(listing.imgUrl);
        if (proxyUrl) {
          listing.imgUrl = proxyUrl;
        }
      }
    }

    return listings;
  } catch (error) {
    console.error('Error scraping eBay listings:', error);
    throw error;
  }
} 