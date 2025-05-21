import fs from 'fs';
import axios from 'axios';
import path from 'path';

// Helper function to cache images
export async function cacheImage(localPath, remoteUrl) {
  if (!localPath || !remoteUrl) return false;
  if (fs.existsSync(localPath)) return true; // already cached
  
  try {
    const response = await axios.get(remoteUrl, { 
      responseType: 'arraybuffer', 
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
      }
    });
    
    fs.writeFileSync(localPath, response.data);
    return true;
  } catch(err) {
    console.warn('cacheImage: failed', remoteUrl.substring(0, 120), err.message);
    return false;
  }
}

// Hard-coded images for certain popular cards
export const CARD_IMAGES = {
  // Justin Jefferson base
  'justin jefferson 2020 prizm base psa 10': 'https://i.ebayimg.com/images/g/mVwAAOSwsjVkTBkq/s-l1600.jpg',
  'justin jefferson 2020 prizm base psa 9': 'https://i.ebayimg.com/images/g/YkIAAOSwK3VkoBj3/s-l1600.jpg',
  'justin jefferson 2020 prizm base': 'https://i.ebayimg.com/images/g/EkoAAOSwasFll1PQ/s-l1600.jpg',
  'justin jefferson 2020 prizm silver': 'https://i.ebayimg.com/images/g/JToAAOSwAiVncY-S/s-l1600.jpg',
  'justin jefferson 2020 prizm red white blue': 'https://i.ebayimg.com/images/g/PQMAAOSwwSRnEP2H/s-l1600.jpg',
  'justin jefferson 2020 prizm psa 10': 'https://i.ebayimg.com/images/g/mVwAAOSwsjVkTBkq/s-l1600.jpg',
  'justin jefferson 2020 prizm psa 9': 'https://i.ebayimg.com/images/g/YkIAAOSwK3VkoBj3/s-l1600.jpg',
  'justin jefferson 2020 prizm #398 psa 10': 'https://i.ebayimg.com/images/g/mVwAAOSwsjVkTBkq/s-l1600.jpg',
  'justin jefferson 2020 prizm #398 psa 9': 'https://i.ebayimg.com/images/g/YkIAAOSwK3VkoBj3/s-l1600.jpg',
  'justin jefferson 2020 prizm 398 psa 10': 'https://i.ebayimg.com/images/g/mVwAAOSwsjVkTBkq/s-l1600.jpg',
  'justin jefferson 2020 prizm 398 psa 9': 'https://i.ebayimg.com/images/g/YkIAAOSwK3VkoBj3/s-l1600.jpg',
  // Additional backups with different variations
  'justin jefferson prizm psa 10': 'https://i.ebayimg.com/images/g/mVwAAOSwsjVkTBkq/s-l1600.jpg',
  'justin jefferson prizm psa 9': 'https://i.ebayimg.com/images/g/YkIAAOSwK3VkoBj3/s-l1600.jpg',
  'justin jefferson psa 10': 'https://i.ebayimg.com/images/g/mVwAAOSwsjVkTBkq/s-l1600.jpg',
  'justin jefferson psa 9': 'https://i.ebayimg.com/images/g/YkIAAOSwK3VkoBj3/s-l1600.jpg',
  'justin jefferson rookie': 'https://i.ebayimg.com/images/g/EkoAAOSwasFll1PQ/s-l1600.jpg',
};

// Helper function to get a known card image if available
export function getKnownCardImage(title) {
  if (!title) return null;
  
  const normalizedTitle = title.toLowerCase();
  
  // Check for exact matches
  for (const [key, url] of Object.entries(CARD_IMAGES)) {
    if (normalizedTitle.includes(key)) {
      return url;
    }
  }
  
  // Try to match by components
  if (normalizedTitle.includes('justin jefferson') && 
      normalizedTitle.includes('2020') && 
      normalizedTitle.includes('prizm')) {
    
    // Check for graded versions
    if (normalizedTitle.includes('psa 10')) {
      return CARD_IMAGES['justin jefferson 2020 prizm base psa 10'];
    } else if (normalizedTitle.includes('psa 9')) {
      return CARD_IMAGES['justin jefferson 2020 prizm base psa 9'];
    } 
    // Check for parallels
    else if (normalizedTitle.includes('silver')) {
      return CARD_IMAGES['justin jefferson 2020 prizm silver'];
    } else if (normalizedTitle.includes('red white blue') || normalizedTitle.includes('rwb')) {
      return CARD_IMAGES['justin jefferson 2020 prizm red white blue'];
    }
    
    // Default to base
    return CARD_IMAGES['justin jefferson 2020 prizm base'];
  }
  
  return null;
} 