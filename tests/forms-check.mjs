import { chromium, expect } from '@playwright/test';
import {readFileSync} from 'node:fs';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();
page.on('pageerror',e=>console.log('BROWSER ERROR',e.message));
const base=process.env.TEST_URL||'http://localhost:4173';
const guestName='ทดสอบระบบ Browser '+Date.now();
try{
  await page.goto(base);await page.locator('.chapter-panel.is-active').waitFor({timeout:60000});
  await page.getByRole('button',{name:"You're invited"}).click();
  await expect(page.getByLabel('ข้อจำกัดด้านอาหาร')).toHaveCount(0);
  await expect(page.locator('input[name=contact]')).toHaveAttribute('placeholder','เบอร์โทรศัพท์ หรืออีเมล');
  await page.getByLabel('ชื่อ–นามสกุล').fill(guestName);
  await page.getByLabel('จำนวนผู้ร่วมงาน').selectOption('2');
  await page.getByLabel('เบอร์โทรศัพท์ / อีเมล').fill('browser-test@example.com');
  await page.getByLabel('ฝากข้อความถึงบ่าวสาว').fill('ขอให้มีความสุขมาก ๆ');
  await page.getByRole('button',{name:'ยืนยันการตอบรับ',exact:true}).click();
  await expect(page.locator('.rsvp-success')).toBeVisible();
  console.log('PASS guest RSVP submitted and confirmed');
  await page.goto(base+'/admin');
  const password=readFileSync('.env','utf8').match(/ADMIN_PASSWORD=(.*)/)[1];
  await page.getByLabel('รหัสผ่าน',{exact:true}).fill(password);
  await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();
  await expect(page.getByText(guestName,{exact:true})).toBeVisible();
  console.log('PASS submitted guest appears in Admin');
  await page.getByRole('button',{name:'ข้อมูลการ์ดเชิญ',exact:true}).click();
  const field=page.getByLabel('ชื่อเจ้าบ่าว (ภาษาอังกฤษ)',{exact:true});
  await expect(field).toBeVisible();
  const original=await(await page.request.get(base+'/api/config')).json();
  try{
    await field.fill('Kawin Test');await page.getByRole('button',{name:'บันทึกการเปลี่ยนแปลง'}).click();
    await expect(page.getByRole('status')).toContainText('บันทึกแล้ว');
    const updated=await(await page.request.get(base+'/api/config')).json();
    expect(updated.groom).toBe('Kawin Test');
    const guestPage=await page.context().newPage();await guestPage.goto(base);await expect(guestPage.locator('.couple-names')).toContainText('Kawin Test',{timeout:60000});await guestPage.close();
    console.log('PASS Admin edits update public invitation');
  }finally{
    await page.request.put(base+'/api/admin/config',{data:original});
  }
  await page.getByRole('button',{name:/รายชื่อผู้ร่วมงาน/}).click();
  await page.getByRole('textbox',{name:'ค้นหารายชื่อ'}).fill(guestName);
  page.once('dialog',d=>d.accept());
  await page.getByRole('button',{name:'ลบคำตอบรับของ '+guestName}).click();
  await expect(page.getByText('ยังไม่พบคำตอบรับที่ค้นหา')).toBeVisible();
  console.log('PASS guest search and delete (test record cleaned up)');
  const rows=await(await page.request.get(base+'/api/admin/guests')).json();expect(rows.some(g=>g.name===guestName)).toBe(false);
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'เปิดเมนู'}).click();await expect(page.getByRole('button',{name:'ความปลอดภัย',exact:true})).toBeVisible();
  await page.screenshot({path:'/tmp/garden-admin-mobile.png'});
  console.log('PASS responsive Admin menu');
}catch(e){await page.screenshot({path:'/tmp/garden-form-error.png'});throw e;}finally{await browser.close();}
