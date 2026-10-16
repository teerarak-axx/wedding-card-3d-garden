import {chromium,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const base=process.env.TEST_URL||'http://localhost:4173';
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto(base);await expect(page.locator('canvas')).toBeVisible({timeout:60000});await page.locator('.scene-loading').waitFor({state:'detached',timeout:60000});
  await page.screenshot({path:'/tmp/garden-white-bricks.png'});
  await page.getByRole('navigation',{name:'เส้นทางในสวน'}).getByRole('button').nth(1).click();await expect(page.locator('.chapter-1.is-active')).toBeVisible();await page.waitForTimeout(500);
  await page.screenshot({path:'/tmp/garden-new-fountain.png'});
  await page.getByRole('navigation',{name:'เส้นทางในสวน'}).getByRole('button').nth(3).click();await expect(page.locator('.chapter-3.is-active')).toBeVisible();await page.waitForTimeout(500);await page.screenshot({path:'/tmp/garden-new-pavilion.png'});
  await page.evaluate(()=>window.scrollTo({top:(document.documentElement.scrollHeight-innerHeight)*.89,behavior:'instant'}));await page.waitForTimeout(600);await page.screenshot({path:'/tmp/garden-pavilion-walk-through.png'});
  await page.setViewportSize({width:390,height:844});await page.getByRole('navigation',{name:'เส้นทางในสวน'}).getByRole('button').nth(1).click();await page.waitForTimeout(600);await page.screenshot({path:'/tmp/garden-fountain-mobile.png'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.goto(base+'/admin');const password=readFileSync('.env','utf8').match(/ADMIN_PASSWORD=(.*)/)[1];await page.getByLabel('รหัสผ่าน',{exact:true}).fill(password);await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();await expect(page.locator('.admin-stats')).toBeVisible();
  await page.setViewportSize({width:1440,height:1000});
  if(await page.locator('.guest-table').count()){await expect(page.locator('.guest-table thead')).toContainText('คำอวยพร');await expect(page.locator('.guest-table thead')).not.toContainText('อาหาร');}
  const csv=await page.request.get(base+'/api/admin/export');expect(csv.status()).toBe(200);const header=(await csv.text()).split('\r\n')[0];expect(header).toContain('คำอวยพร');expect(header).not.toContain('อาหาร');
  await page.screenshot({path:'/tmp/garden-admin-soft-colors.png'});
  expect(errors).toEqual([]);console.log('PASS white-brick garden, fountain, pavilion approach and walk-through, mobile, Admin and CSV');
  // Verify the animated water can also render with motion enabled.
  await page.emulateMedia({reducedMotion:'no-preference'});await page.goto(base);await page.locator('.scene-loading').waitFor({state:'detached',timeout:60000});await page.getByRole('navigation',{name:'เส้นทางในสวน'}).getByRole('button').nth(1).click();await expect(page.locator('.chapter-1.is-active')).toBeVisible();await page.waitForTimeout(1000);await page.screenshot({path:'/tmp/garden-fountain-animated.png'});expect(errors).toEqual([]);console.log('PASS animated fountain renders without JavaScript errors');
}finally{await browser.close();}
