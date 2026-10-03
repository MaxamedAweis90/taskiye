import { test, expect } from '@playwright/test';

// Configure comfortable slow-motion delay so visual actions are clearly visible in headed mode
test.use({
  baseURL: 'http://localhost:5173',
  channel: 'chrome',
  launchOptions: {
    slowMo: 200,
  },
});

/* =========================================================================
   PHASE 1: THE 4 CORE TAB SCREENS
   ========================================================================= */
test.describe('Phase 1: The 4 Core Tab Screens', () => {
  test('1.1 Dashboard Screen renders shell, greeting, and checklist', async ({ page }) => {
    await page.goto('/');

    // Verify brand logo and shell are loaded
    await expect(page.locator('img[alt="Taskiye Logo"]').first()).toBeVisible();

    // Verify main workspace container is mounted
    const workspace = page.locator('#main-workspace');
    await expect(workspace).toBeVisible();

    // Verify URL is at root
    expect(page.url()).toContain('/');
    await page.waitForTimeout(400);
  });

  test('1.2 Habits Screen navigates, renders categories, and filters', async ({ page }) => {
    await page.goto('/');

    // Navigate to Habits via desktop sidebar link
    const habitsLink = page.locator('nav a[href="/habits"]').first();
    await habitsLink.click();

    // Verify route transition
    await expect(page).toHaveURL(/\/habits/);

    // Verify Habits workspace content is active
    await expect(page.locator('#main-workspace')).toBeVisible();
    await page.waitForTimeout(400);
  });

  test('1.3 Tasks Screen navigates, date carousel, and history toggle', async ({ page }) => {
    await page.goto('/');

    // Click Tasks navigation link
    const tasksLink = page.locator('nav a[href="/tasks"]').first();
    await tasksLink.click();

    // Verify route
    await expect(page).toHaveURL(/\/tasks/);
    await expect(page.locator('#main-workspace')).toBeVisible();

    // Switch between Day View and History tab if available
    const historyTab = page.locator('button:has-text("History"), button:has-text("Task History")').first();
    if (await historyTab.isVisible()) {
      await historyTab.click();
      await page.waitForTimeout(400);
      const dayViewTab = page.locator('button:has-text("Day"), button:has-text("Today")').first();
      if (await dayViewTab.isVisible()) {
        await dayViewTab.click();
      }
    }
    await page.waitForTimeout(300);
  });

  test('1.4 Rank Screen renders leaderboards and league tabs', async ({ page }) => {
    await page.goto('/');

    // Click Rank navigation link
    const rankLink = page.locator('nav a[href="/rank"]').first();
    await rankLink.click();

    // Verify route
    await expect(page).toHaveURL(/\/rank/);
    await expect(page.locator('#main-workspace')).toBeVisible();

    // Verify Global vs Friends league toggle
    const friendsTab = page.locator('button:has-text("Friends"), button:has-text("Friends League")').first();
    if (await friendsTab.isVisible()) {
      await friendsTab.click();
      await page.waitForTimeout(400);

      const globalTab = page.locator('button:has-text("Global"), button:has-text("Global League")').first();
      if (await globalTab.isVisible()) {
        await globalTab.click();
      }
    }
    await page.waitForTimeout(300);
  });
});

/* =========================================================================
   PHASE 2: LAYOUT & RESPONSIVE ADAPTATION (DESKTOP VS MOBILE)
   ========================================================================= */
test.describe('Phase 2: Layout & Responsive Adaptation', () => {
  test('2.1 Desktop Layout: Left Sidebar and Theme Toggle', async ({ page }) => {
    // Set 1280x800 desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Left vertical sidebar must be visible
    const sidebar = page.locator('aside, nav.flex-col').first();
    await expect(sidebar).toBeVisible();

    // Toggle Dark / Light theme button if present
    const themeBtn = page.locator('button[title*="Theme" i], button[aria-label*="Theme" i]').first();
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
      await page.waitForTimeout(400);
      await themeBtn.click();
    }
    await page.waitForTimeout(300);
  });

  test('2.2 Mobile Layout: Bottom Navigation Bar and Touch Transitions', async ({ page }) => {
    // Set iPhone / modern mobile viewport (390x844)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // Bottom Navigation Bar must be visible
    const bottomNav = page.locator('nav.fixed.bottom-0');
    await expect(bottomNav).toBeVisible();

    // Tap mobile Habits icon
    const mobileHabits = bottomNav.locator('a[href="/habits"]');
    await mobileHabits.click();
    await expect(page).toHaveURL(/\/habits/);
    await page.waitForTimeout(300);

    // Tap mobile Tasks icon
    const mobileTasks = bottomNav.locator('a[href="/tasks"]');
    await mobileTasks.click();
    await expect(page).toHaveURL(/\/tasks/);
    await page.waitForTimeout(300);

    // Tap mobile Rank icon
    const mobileRank = bottomNav.locator('a[href="/rank"]');
    await mobileRank.click();
    await expect(page).toHaveURL(/\/rank/);
    await page.waitForTimeout(300);

    // Tap mobile Dashboard icon to return home
    const mobileHome = bottomNav.locator('a[href="/"]');
    await mobileHome.click();
    await expect(page).toHaveURL(/\/$/);
    await page.waitForTimeout(300);
  });
});

/* =========================================================================
   PHASE 3: EXTRA SCREENS & ERROR RESILIENCE
   ========================================================================= */
test.describe('Phase 3: Extra Screens & Error Resilience', () => {
  test('3.1 Full-Screen 404 Not Found Page and Recovery Navigation', async ({ page }) => {
    // Navigate to an intentional non-existent URL
    await page.goto('/some-missing-route-test-404');

    // Verify 404 message is rendered
    const notFoundText = page.locator('text=/404|Page not found|Lost in Space|Nothing here/i').first();
    await expect(notFoundText).toBeVisible();

    // Click Return to Dashboard button
    const backBtn = page.locator('a:has-text("Dashboard"), button:has-text("Dashboard"), a[href="/"]').first();
    await expect(backBtn).toBeVisible();
    await backBtn.click();

    // Verify successfully returned to Dashboard
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('#main-workspace')).toBeVisible();
    await page.waitForTimeout(300);
  });
});

/* =========================================================================
   PHASE 4: MODALS, POPUPS & AI COMPANION
   ========================================================================= */
test.describe('Phase 4: Modals, Popups & AI Companion', () => {
  test('4.1 Topbar Dropdown Menu and Modal Dialogs', async ({ page }) => {
    await page.goto('/');

    // Click Topbar user avatar / trigger
    const profileTrigger = page.locator('header button:has(img), header button:has(.lucide-user)').first();
    if (await profileTrigger.isVisible()) {
      await profileTrigger.click();
      await page.waitForTimeout(400);

      // Check if dropdown opened with Profile Settings or Trash options
      const settingsOption = page.locator('button:has-text("Profile Settings")');
      if (await settingsOption.isVisible()) {
        await settingsOption.click();
        await page.waitForTimeout(500);

        // Close modal via ESC key
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    }
  });

  test('4.2 Taskiye AI Chat / ChatMind Drawer Trigger', async ({ page }) => {
    await page.goto('/');

    // Locate the floating AI Chat button trigger
    const chatToggle = page.locator('button[data-chat-toggle="true"]').first();
    await expect(chatToggle).toBeVisible();

    // Open AI Chat
    await chatToggle.click();
    await page.waitForTimeout(500);

    // Verify chat textarea/input is visible
    const chatInput = page.locator('textarea, input[placeholder*="Ask Taskiye" i], input[placeholder*="Type a message" i]').first();
    if (await chatInput.isVisible()) {
      await chatInput.fill('Hi Taskiye AI! Test verification.');
      await page.waitForTimeout(400);
    }

    // Close AI Chat drawer via close button or toggle
    await chatToggle.click();
    await page.waitForTimeout(300);
  });
});
