import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('401 (Unauthorized)'))errors.push(m.text());});
try{
  await page.goto(process.env.TEST_URL||'http://localhost:4173');await expect(page.locator('canvas')).toBeVisible({timeout:60000});await page.locator('.scene-loading').waitFor({state:'detached',timeout:60000});
  await page.getByRole('navigation',{name:'เส้นทางในสวน'}).getByRole('button').nth(1).click();await expect(page.locator('.chapter-1.is-active')).toBeVisible();await page.waitForTimeout(600);await page.screenshot({path:'/tmp/garden-plaza-centered.png'});
  for(const progress of [.38,.42]){await page.evaluate(p=>window.scrollTo({top:(document.documentElement.scrollHeight-innerHeight)*p,behavior:'instant'}),progress);await page.waitForTimeout(700);await page.screenshot({path:`/tmp/garden-plaza-walk-${progress}.png`});}
  await page.setViewportSize({width:390,height:844});await page.getByRole('navigation',{name:'เส้นทางในสวน'}).getByRole('button').nth(1).click();await page.waitForTimeout(600);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'/tmp/garden-plaza-mobile.png'});
  await expect(page.getByRole('button',{name:'เปิดเสียงบรรยากาศ',exact:true})).toBeVisible();
  expect(errors).toEqual([]);console.log('PASS plaza approach, fountain walking loop, mobile layout and sound control');
}finally{await browser.close();}
