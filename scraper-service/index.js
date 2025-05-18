import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import fs from 'fs/promises';
import path from 'path';
import { scrapeText } from './scrapeText.js';
import { scrapeImage } from './scrapeImage.js';
import { groupVariations } from './grouper.js';

const fastify = Fastify({ logger: true });
fastify.register(multipart);

fastify.post('/search', async (request, reply) => {
  const { query } = request.body;
  if (!query || query.trim() === '') {
    return reply.code(400).send({ success:false, message:'query required'});
  }
  const listings = await scrapeText(query.trim());
  const real = listings.filter(l=>l.imageUrl);
  if(real.length===0) return reply.code(404).send({success:false, message:'No listings with images'});
  return { success:true, listings:real, groupedListings: groupVariations(real), count:real.length };
});

fastify.post('/search/image', async (request, reply) => {
  const data = await request.file();
  if (!data) return reply.code(400).send({ success:false, message:'image file required'});
  const tempPath = path.join('/tmp', Date.now()+'_'+data.filename);
  await fs.writeFile(tempPath, await data.toBuffer());
  const listings = await scrapeImage(tempPath);
  await fs.unlink(tempPath).catch(()=>{});
  const real = listings.filter(l=>l.imageUrl);
  if(real.length===0) return reply.code(404).send({success:false, message:'No listings with images'});
  return { success:true, listings:real, groupedListings: groupVariations(real), count: real.length };
});

fastify.get('/', async ()=>({status:'ok'}));

fastify.listen({ port:4000, host:'0.0.0.0'}).then(()=>{
  console.log('Scraper service running on 4000');
}); 