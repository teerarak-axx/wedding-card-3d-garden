import { chromium, expect } from '@playwright/test';

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error' && !message.text().includes('401 (Unauthorized)')) errors.push(message.text()); });
try {
  await page.goto(process.env.TEST_URL || 'http://localhost:4173');
  await expect(page.locator('canvas')).toBeVisible({ timeout: 60000 });
  await page.locator('.scene-loading').waitFor({ state: 'detached', timeout: 60000 });
  await page.screenshot({ path: '/tmp/garden-journey-entrance.png' });
  const nav = page.getByRole('navigation', { name: 'เส้นทางในสวน' });
  await nav.getByRole('button').nth(1).click();
  await expect(page.locator('.chapter-1.is-active')).toBeVisible();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: '/tmp/garden-journey-cupid.png' });
  // Exercise actual forward scrolling and reverse scrolling with camera easing enabled.
  for (const progress of [.3, .35, .4, .45, .5, .55, .5, .4, .3]) {
    await page.evaluate(p => window.scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * p, behavior: 'instant' }), progress);
    await page.waitForTimeout(450);
    await expect(page.locator('.garden-fallback')).toHaveCount(0);
  }
  await nav.getByRole('button').nth(2).click();
  await expect(page.locator('.chapter-2.is-active')).toBeVisible();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: '/tmp/garden-journey-ring-aisle.png' });
  await page.mouse.move(1250, 480); await page.mouse.down(); await page.mouse.move(1320, 480, { steps: 6 }); await page.mouse.up();
  await nav.getByRole('button').nth(4).click();
  await expect(page.locator('.chapter-4.is-active')).toBeVisible();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: '/tmp/garden-journey-final-gate.png' });
  await expect(page.getByRole('button', { name: 'ยืนยันการมาร่วมงาน' })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 800 });
  for (const chapter of [1, 2, 4]) {
    await nav.getByRole('button').nth(chapter).click();
    // Wait for the actual scroll destination; a fixed delay can capture a blank
    // gap between mobile chapters while software WebGL is still presenting frames.
    await expect.poll(() => page.locator(`.chapter-${chapter}`).evaluate(panel => Math.abs(panel.getBoundingClientRect().top)), { timeout: 15000 }).toBeLessThan(3);
    await expect(nav.getByRole('button').nth(chapter)).toHaveAttribute('aria-current', 'step');
    await expect(page.locator(`.chapter-${chapter} h2`)).toBeInViewport();
    await page.waitForTimeout(1600);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `/tmp/garden-journey-mobile-${chapter}.png` });
  }
  expect(errors).toEqual([]);
  console.log('PASS animated forward/reverse journey, Cupid fountain, ring aisle/drag, final gate and 320px mobile');
} finally { await browser.close(); }
