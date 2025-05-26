import { firefox } from 'playwright';
import { isRealImage, parsePrice } from './utils.js';

export async function scrapeImage(localPath, maxItems=60){
  const browser = await firefox.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ],
    firefoxUserPrefs: {
      'media.navigator.streams.fake': true,
      'browser.cache.disk.enable': false
    },
    executablePath: process.env.PLAYWRIGHT_FIREFOX_PATH || '/usr/bin/firefox-esr'
  });
  const page = await browser.newPage();
  try {
    await page.goto('https://www.ebay.com/sl/img', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    let input = await page.$('input[type="file"]');
    // eBay often hides the file input behind an "Add a photo" button. Click it if necessary.
    if (!input) {
      const addBtn = await page.$('button:has-text("Add a photo"), [data-test-id="upload-image-button"]');
      if (addBtn) {
        try {
          await addBtn.click();
          // wait for the input to appear
          await page.waitForSelector('input[type="file"]', { timeout: 10000 });
          input = await page.$('input[type="file"]');
        } catch (_) {
          /* fall through */
        }
      }
    }
    if(!input) throw new Error('image input not found');
    await input.setInputFiles(localPath);
    await page.waitForSelector('.s-item');
    const listings=await page.$$eval('.s-item',(els)=>{
      const clean=s=>s? s.replace(/\s+/g,' ').trim():'';
      return els.map(el=>{
        const title=clean(el.querySelector('.s-item__title')?.textContent);
        const priceText=clean(el.querySelector('.s-item__price')?.textContent);
        const imgTag   = el.querySelector('img.s-item__image-img, img.s-item__image, img');
        let img='';
        if(imgTag){
          img = imgTag.getAttribute('data-src') || imgTag.getAttribute('src') || imgTag.getAttribute('data-image-src') || '';
          if(!img){ const ss = imgTag.getAttribute('srcset') || imgTag.getAttribute('data-srcset'); if(ss){ img = ss.split(',').pop().split(' ')[0]; } }
        }
        const link=el.querySelector('a.s-item__link')?.href||'';
        const dateText=clean(el.querySelector('.s-item__endedDate, .s-item__listingDate')?.textContent);
        return { title, priceText, img, link, dateText };
      })
    });
    const out=listings.filter(l=>l.title&&l.priceText&&isRealImage(l.img)).slice(0,maxItems).map(l=>{
      const price=parsePrice(l.priceText);
      return {title:l.title,price,shipping:0,totalPrice:price,dateSold:new Date().toISOString().split('T')[0],imageUrl:l.img.split('?')[0],url:l.link,source:'eBay'}
    });
    return out;
  }finally{await browser.close();}
} 