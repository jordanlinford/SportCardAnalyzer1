import { firefox } from 'playwright';
import { isRealImage, parsePrice, parseDate } from './utils.js';

const SOLD_URL = (q)=>(`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}&_sacat=0&LH_Sold=1&LH_Complete=1&_ipg=240`);

export async function scrapeText(query, maxItems=120){
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
  const page = await browser.newPage({ 
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
  });
  try{
    await page.goto(SOLD_URL(query), {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await page.evaluate(()=>window.scrollBy(0,document.body.scrollHeight));
    const listings=await page.$$eval('.s-item',(els)=>{
      const clean=(s)=>s? s.replace(/\s+/g,' ').trim():'';
      const parseP=(t)=>parseFloat(t.replace(/[^0-9.]/g,''));
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
      });
    });
    const result=listings.filter(l=>l.title&&l.priceText&&isRealImage(l.img))
      .slice(0,maxItems)
      .map(l=>{
        const price=parsePrice(l.priceText);
        return {
          title:l.title,
          price,
          shipping:0,
          totalPrice:price,
          dateSold:parseDate(l.dateText),
          imageUrl:l.img.split('?')[0],
          url:l.link,
          source:'eBay'
        }
      });
    return result;
  }finally{await browser.close();}
} 