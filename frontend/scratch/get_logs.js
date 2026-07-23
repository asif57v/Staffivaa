import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`${msg.type()}: ${msg.text()}`);
    }
  });
  
  page.on('pageerror', error => {
    console.log(`pageerror: ${error.message}`);
  });
  
  try {
    await page.goto('http://localhost:5173/app/notifications', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));
    const html = await page.evaluate(() => document.body.outerHTML);
    console.log('HTML:', html);
  } catch (err) {
    console.log('Nav error:', err);
  }
  
  await browser.close();
})();
