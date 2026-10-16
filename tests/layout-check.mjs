import {chromium,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const page=await context.newPage();const base=process.env.TEST_URL||'http://localhost:4173';
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto(base);await expect(page.locator('canvas')).toBeVisible({timeout:60000});await page.locator('.scene-loading').waitFor({state:'detached'});
  await page.getByRole('navigation',{name:'เส้นทางในสวน'}).getByRole('button').nth(1).click();
  await expect(page.locator('.chapter-1')).toBeVisible();
  const photo=page.getByRole('button',{name:'ขยายภาพความทรงจำวันแรกที่พบกัน'});await photo.click();
  await expect(page.locator('.photo-modal img')).toBeVisible();await page.screenshot({path:'/tmp/garden-photo-enlarged.png'});await page.getByRole('button',{name:'ปิด',exact:true}).click();
  await page.getByRole('button',{name:"You're invited"}).click();await expect(page.locator('.rsvp-modal')).toBeVisible();
  await expect(page.getByLabel('ข้อจำกัดด้านอาหาร')).toHaveCount(0);await expect(page.locator('input[name=contact]')).toHaveAttribute('placeholder','เบอร์โทรศัพท์ หรืออีเมล');
  await page.screenshot({path:'/tmp/garden-rsvp.png'});await page.getByRole('button',{name:'ปิด',exact:true}).click();
  console.log('PASS larger photo viewer and simplified RSVP');
  for(const size of [{width:390,height:844},{width:320,height:640},{width:1024,height:768}]){
    await page.setViewportSize(size);await page.getByRole('button',{name:'กลับสู่หน้าประตูสวน'}).click();
    await expect(page.locator('.chapter-0')).toBeVisible();await page.waitForTimeout(600);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    if(size.width<=760){
      for(const el of await page.locator('.chapter-panel').all()){
        expect(await el.evaluate(e=>e.scrollHeight<=e.clientHeight+2)).toBe(true);
      }
      const heroCta=page.getByRole('button',{name:'เดินเข้าสู่สวนของเรา',exact:true});await heroCta.scrollIntoViewIfNeeded();await expect(heroCta).toBeInViewport();
      await page.screenshot({path:`/tmp/garden-mobile-${size.width}-details.png`});
      await page.getByRole('navigation',{name:'เส้นทางในสวน'}).getByRole('button').nth(1).click();
      const memory=page.locator('.chapter-1 .polaroid');await memory.scrollIntoViewIfNeeded();await expect(memory).toBeInViewport();
      expect((await memory.boundingBox()).width).toBeGreaterThanOrEqual(245);
      await page.screenshot({path:`/tmp/garden-mobile-${size.width}-photo.png`});
      await page.getByRole('button',{name:"You're invited"}).click();await expect(page.locator('.rsvp-modal')).toBeVisible();
      const contact=page.locator('input[name=contact]');expect(await contact.evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16);
      await page.screenshot({path:`/tmp/garden-mobile-${size.width}-rsvp.png`});await page.getByRole('button',{name:'ปิด',exact:true}).click();
    }
    console.log('PASS readable layout',size.width+'×'+size.height);
  }
  await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/admin');
  const password=readFileSync('.env','utf8').match(/ADMIN_PASSWORD=(.*)/)[1];
  await page.getByLabel('รหัสผ่าน',{exact:true}).fill(password);await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();await expect(page.locator('.admin-stats')).toBeVisible();
  await page.getByRole('button',{name:'เรื่องราวและรูปภาพ',exact:true}).click();await expect(page.locator('.photo-editor').first()).toBeVisible();await page.screenshot({path:'/tmp/garden-admin-story.png'});
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'/tmp/garden-admin-story-mobile.png'});
  expect(errors).toEqual([]);console.log('PASS responsive Admin and no JavaScript errors');
}finally{await browser.close();}
