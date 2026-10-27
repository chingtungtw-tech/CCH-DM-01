import { chromium } from 'playwright';
import fs from 'fs';

async function runTests() {
  console.log('🚀 Starting automated Playwright test suite for 彰基糖友島...');
  const browser = await chromium.launch({ headless: true });
  const errors = [];

  // Helper function to create page with console error tracking
  async function createTrackedPage(viewport) {
    const page = await browser.newPage({ viewport });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        // Ignore known benign WebGL/HMR messages if any
        if (!msg.text().includes('favicon') && !msg.text().includes('socket')) {
          errors.push(`[Console Error] ${msg.text()}`);
        }
      }
    });
    page.on('pageerror', (err) => {
      errors.push(`[Page Error] ${err.message}`);
    });
    return page;
  }

  try {
    // --- 1. Desktop Test (1440x900) ---
    console.log('🖥️ Testing Desktop (1440x900)...');
    const page = await createTrackedPage({ width: 1440, height: 900 });
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    // Wait for loader to disappear
    await page.waitForTimeout(1000);

    // Verify Title & Brand
    const title = await page.title();
    console.log(`Page title: ${title}`);
    if (!title.includes('彰基糖友島')) {
      throw new Error(`Expected title to include 彰基糖友島, got: ${title}`);
    }

    // Verify 3D canvas is mounted
    const canvasExists = await page.locator('#canvas-container canvas').count();
    console.log(`Canvas count: ${canvasExists}`);
    if (canvasExists === 0) throw new Error('Three.js canvas not found!');

    // Screenshot Home
    await page.screenshot({ path: '_shots/01_desktop_home.png' });
    console.log('Saved _shots/01_desktop_home.png');

    // Test clicking Island 1 floating tag
    console.log('Clicking Island 1 tag...');
    await page.locator('#tag-island-01').click({ force: true });
    await page.waitForTimeout(600);

    // Verify Drawer Opened
    const drawerOpen = await page.locator('#content-drawer.open').count();
    if (drawerOpen === 0) throw new Error('Content drawer failed to open on island click!');
    await page.screenshot({ path: '_shots/02_desktop_island01_drawer.png' });
    console.log('Saved _shots/02_desktop_island01_drawer.png');

    // Switch to literature tab in drawer
    await page.locator('.tab-btn[data-tab="literature"]').click();
    await page.waitForTimeout(300);

    // Click first literature house
    console.log('Clicking literature card...');
    await page.locator('.literature-card').first().click();
    await page.waitForTimeout(500);

    // Check literature modal
    const litModalOpen = await page.locator('#literature-modal.open').count();
    if (litModalOpen === 0) throw new Error('Literature modal failed to open!');
    await page.screenshot({ path: '_shots/03_desktop_literature_modal.png' });
    console.log('Saved _shots/03_desktop_literature_modal.png');

    // Close with Escape key
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Test Central Library
    console.log('Opening Central Library...');
    await page.locator('#tag-island-center').click({ force: true });
    await page.waitForTimeout(500);
    await page.screenshot({ path: '_shots/04_desktop_central_library.png' });
    console.log('Saved _shots/04_desktop_central_library.png');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Test Theme Switcher to Ink (dark)
    console.log('Testing Theme Switcher (Ink)...');
    await page.locator('.theme-btn[data-theme="ink"]').click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: '_shots/05_desktop_theme_ink.png' });
    console.log('Saved _shots/05_desktop_theme_ink.png');

    // Switch back to Mint
    await page.locator('.theme-btn[data-theme="mint"]').click();
    await page.waitForTimeout(300);

    // Test Guide Modal (彰基糖糖衛教師)
    console.log('Testing Guide Modal...');
    await page.locator('#btn-guide').click();
    await page.waitForTimeout(400);
    // Click a quick pill in guide
    await page.locator('#guide-quick-pills button').first().click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: '_shots/06_desktop_guide_modal.png' });
    console.log('Saved _shots/06_desktop_guide_modal.png');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Test Certificate Modal
    console.log('Testing Certificate Modal...');
    await page.locator('#btn-certificate').click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: '_shots/07_desktop_certificate.png' });
    console.log('Saved _shots/07_desktop_certificate.png');

    await page.close();

    // --- 2. Tablet Test (768x1024) ---
    console.log('📱 Testing Tablet (768x1024)...');
    const tabletPage = await createTrackedPage({ width: 768, height: 1024 });
    await tabletPage.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await tabletPage.waitForTimeout(1000);
    await tabletPage.screenshot({ path: '_shots/08_tablet.png' });
    console.log('Saved _shots/08_tablet.png');
    await tabletPage.close();

    // --- 3. Mobile Test (375x812 - iPhone X/12/13/14 size) ---
    console.log('📱 Testing Mobile (375x812)...');
    const mobilePage = await createTrackedPage({ width: 375, height: 812 });
    await mobilePage.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await mobilePage.waitForTimeout(1000);

    // Check no horizontal scrollbar on mobile
    const scrollWidth = await mobilePage.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await mobilePage.evaluate(() => document.documentElement.clientWidth);
    console.log(`Mobile scrollWidth: ${scrollWidth}, clientWidth: ${clientWidth}`);
    if (scrollWidth > clientWidth) {
      throw new Error(`Horizontal scroll detected on mobile! ${scrollWidth} > ${clientWidth}`);
    }

    await mobilePage.screenshot({ path: '_shots/09_mobile_home.png' });
    console.log('Saved _shots/09_mobile_home.png');

    // Click Place List and enter Island 2 on mobile
    console.log('Testing mobile equal access via Place List...');
    await mobilePage.locator('#btn-list').click();
    await mobilePage.waitForTimeout(400);
    await mobilePage.locator('.btn-open-island-from-list[data-id="island-02"]').click();
    await mobilePage.waitForTimeout(600);
    await mobilePage.screenshot({ path: '_shots/10_mobile_drawer.png' });
    console.log('Saved _shots/10_mobile_drawer.png');

    await mobilePage.close();

    console.log('All automated Playwright tests completed successfully!');
    if (errors.length > 0) {
      console.warn('Console warnings/errors encountered:', errors);
    } else {
      console.log('✅ Console error count: 0 (Zero errors!)');
    }
  } catch (err) {
    console.error('Test failure:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runTests();
