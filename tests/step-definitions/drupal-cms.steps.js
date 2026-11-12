'use strict';

// Drupal CMS step definitions.
//
// What Drupal CMS adds on top of a plain core site, and nothing that the core
// pack (`@webship-js/drupal-core-steps`, which ./drupal-cms-defaults.js loads)
// or webship-js already provide: the Dashboard module's dashboard and its
// sections, email login (the Login Email or Username module), the cookie
// consent dialog (Klaro), the site template and recipe preconditions, and the
// contrib Moderation Sidebar when a site adds it.
//
// Drupal Canvas steps live in ./drupal-canvas.steps.js; the site template
// steps in ./drupal-site-templates.steps.js.
//
// Login by handle, named pages, status messages, page titles,
// breadcrumbs, listings and their operations, the rich text editor, the media
// library, access control, the Navigation sidebar and top bar, the node form's
// Save button, content types, content moderation, site structure and Layout
// Builder come from the core pack; element, text, table row, URL and response
// assertions come from webship-js.

const { Given, When, Then, Before } = require('@cucumber/cucumber');
const assert = require('assert');
const { waitForPageLoad, friendly } = require('webship-js/tests/step-definitions/webship');
const {
  WAIT_TIMEOUT,
  supplied,
  budget,
  navigate,
  waitForState,
  assertPresence,
  assertContainsText,
  resolveUser,
  loginWithForm,
  submitInPage,
  robustClick,
  sessionStatus,
} = require('@webship-js/drupal-core-steps/tests/step-definitions/drupal-helpers');

const SELECTORS = {
  // The Dashboard module's page.
  dashboard: '.dashboard, [data-drupal-selector="admin-dashboard"], .layout-dashboard',
  // The contrib Moderation Sidebar module's toolbar tab and off-canvas panel.
  moderationSidebarTab: '#toolbar-bar .moderation-sidebar-toolbar-tab a, .moderation-sidebar-toolbar-tab a, .toolbar-button--icon--moderation-sidebar',
  moderationSidebar: '#drupal-off-canvas',
};

// ---------------------------------------------------------------------------
// Hermetic runs: block third-party (cross-origin) requests
// ---------------------------------------------------------------------------

/**
 * Drupal CMS ships contrib modules that load front-end libraries from public
 * CDNs with render-blocking script tags (tagify, for one). On a runner without
 * outbound internet access those never resolve and every form that uses them,
 * `/node/add/page` in particular, hangs until the navigation times out.
 *
 * Third-party assets are not the system under test, so they are aborted up
 * front and runs stay hermetic. Set `worldParameters.blockThirdPartyRequests`
 * to false in cucumber.js to let them through.
 */
Before({ order: 10 }, async function () {
  if (this.parameters && this.parameters.blockThirdPartyRequests === false) return;
  let siteHost;
  try {
    siteHost = new URL(this.launchUrl).hostname;
  } catch (e) {
    return;
  }
  await this.page.route('**/*', (route) => {
    let host;
    try {
      host = new URL(route.request().url()).hostname;
    } catch (e) {
      return route.continue();
    }
    return host === siteHost ? route.continue() : route.abort();
  });
});

// ---------------------------------------------------------------------------
// Authentication specifics
// ---------------------------------------------------------------------------

/**
 * Log in with a user's email address instead of the username, which Drupal
 * CMS accepts through the Login Email or Username module. The user comes from
 * `worldParameters.users` and needs an `email` key next to its password.
 *
 * Example #1: When I log in with the email address of "content editor"
 * Example #2: And I log in with the email address of the "admin" user
 * Example #3: When we log in with the email address of "content editor"
 * Example #4: Given I log in with the email address of the "content editor" user
 * Example #5: And we log in with the email address of "admin"
 *
 */
When(/^(I |we )*log in with the email address of (?:the )?"([^"]*)"(?: user)?$/, async function (pronounCase, handle) {
  const user = resolveUser(this, handle);
  if (!supplied(user.email)) {
    throw friendly({
      message: `User "${handle}" has no email address configured.`,
      hint: 'Add users.<handle>.email to worldParameters in cucumber.js.',
    });
  }
  await loginWithForm(this, user.email, user.password);
});

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

/**
 * Open the administrative dashboard (`/admin/dashboard`), the page Drupal CMS
 * lands on after login.
 *
 * Example #1: Given I am on the dashboard
 * Example #2: Given I am on the admin dashboard
 * Example #3: Given we are on the dashboard page
 * Example #4: And I am on the admin dashboard page
 * Example #5: Given on the dashboard
 *
 */
Given(/^(I am |we are )*on the (?:admin )?dashboard(?: page)?$/, async function (pronounCase) {
  await navigate(this, '/admin/dashboard');
});

/**
 * Assert the dashboard is, or is not, on screen: the Dashboard module's
 * `.dashboard` layout, with the "Dashboard" page title as the fallback.
 *
 * Example #1: Then I should see the dashboard
 * Example #2: And I should see the admin dashboard
 * Example #3: Then we should see the dashboard
 * Example #4: And I should not see the dashboard
 * Example #5: Then we should not see the admin dashboard
 *
 */
Then(/^(I |we )*should( not)* see the (?:admin )?dashboard$/, async function (pronounCase, notCase) {
  const dashboard = this.page.locator(SELECTORS.dashboard).first();
  if (notCase) {
    await assertPresence(dashboard, notCase, 'the dashboard (".dashboard")');
    return;
  }
  // Either marker satisfies the positive case; Playwright waits for the
  // first of the two to render.
  const heading = this.page.locator('h1.page-title, h1').filter({ hasText: /Dashboard/ }).first();
  await assertPresence(dashboard.or(heading).first(), undefined, 'the dashboard (".dashboard", or a "Dashboard" page title)');
});

/**
 * Assert a dashboard section (a block placed on the dashboard, such as
 * "Recent content", "Top tasks" or "Announcements") is, or is not, shown. The
 * section is found by its heading, so a section a role may not see stays
 * absent even when its name appears elsewhere on the page.
 *
 * Example #1: Then I should see the "Recent content" dashboard section
 * Example #2: And I should see the "Top tasks" dashboard section
 * Example #3: Then we should see the "Announcements" dashboard section
 * Example #4: And I should not see the "Announcements" dashboard section
 * Example #5: Then I should not see the "Site status" dashboard section
 *
 */
Then(/^(I |we )*should( not)* see the "([^"]*)" dashboard section$/, async function (pronounCase, notCase, sectionTitle) {
  const dashboard = this.page.locator(SELECTORS.dashboard).first();
  await assertPresence(dashboard, undefined, 'the dashboard (".dashboard")');
  const escaped = sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const heading = dashboard.locator('h2, h3').filter({ hasText: new RegExp(`^\\s*${escaped}\\s*$`) }).first();
  await assertPresence(heading, notCase, `the "${sectionTitle}" dashboard section heading`);
});

// ---------------------------------------------------------------------------
// Moderation Sidebar (contrib)
// ---------------------------------------------------------------------------

/**
 * Open the Moderation Sidebar (contrib module) from its toolbar tab, when a
 * site adds that module to Drupal CMS.
 *
 * Example #1: When I open the moderation sidebar
 * Example #2: And I open the moderation sidebar
 * Example #3: When we open the moderation sidebar
 * Example #4: And we open the moderation sidebar
 * Example #5: When open the moderation sidebar
 *
 */
When(/^(I |we )*open the moderation sidebar$/, async function (pronounCase) {
  const tab = this.page.locator(SELECTORS.moderationSidebarTab).first();
  try {
    await tab.waitFor({ state: 'attached', timeout: budget(this) });
  } catch (error) {
    throw friendly({
      message: 'The moderation sidebar toolbar tab was not found.',
      cause: error,
      hint: 'This needs the Moderation Sidebar module and a moderated content item on screen.',
    });
  }
  await robustClick(tab);
  await waitForState(this.page.locator(SELECTORS.moderationSidebar).first(), 'visible', 'Expected the moderation sidebar to open');
  await waitForPageLoad(this.page, budget(this));
});

/**
 * Assert the open Moderation Sidebar shows, or does not show, a text: the
 * current state, or an action such as "Edit content" or "Delete". Scoped to
 * the off-canvas panel and matched case-insensitively.
 *
 * Example #1: Then the moderation sidebar should show "Draft"
 * Example #2: And the moderation sidebar should show "Edit content"
 * Example #3: Then the moderation sidebar should not show "Delete"
 * Example #4: And moderation sidebar should show "Published"
 * Example #5: Then the moderation sidebar should not show "Archived"
 *
 */
Then(/^(?:the )?moderation sidebar should( not)* show "([^"]*)"$/, async function (notCase, text) {
  const sidebar = this.page.locator(SELECTORS.moderationSidebar).first();
  try {
    await sidebar.waitFor({ state: 'visible', timeout: budget(this) });
  } catch (error) {
    throw friendly({
      message: 'The moderation sidebar is not open.',
      cause: error,
      hint: 'Open it first with "I open the moderation sidebar".',
    });
  }
  // The assertion is the wait: narrow the panel to "contains the text" and
  // let Playwright poll for that to hold (or to stop holding).
  const pattern = new RegExp(text.trim().split(/\s+/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'), 'i');
  try {
    await sidebar.filter({ hasText: pattern }).waitFor({ state: notCase ? 'detached' : 'attached', timeout: budget(this) });
  } catch (error) {
    const body = ((await sidebar.innerText({ timeout: 1000 }).catch(() => '')) || '').replace(/\s+/g, ' ').trim();
    throw friendly({
      message: notCase
        ? `The moderation sidebar unexpectedly shows "${text}".`
        : `The moderation sidebar does not show "${text}".`,
      cause: `the panel reads "${body}"`,
      hint: 'The text is matched case-insensitively inside the off-canvas panel; check the state name or action label the module renders.',
    });
  }
});

// Referenced for completeness by downstream packs; kept exported so a project
// can reuse the selectors without copying them.
module.exports = { SELECTORS, WAIT_TIMEOUT, sessionStatus };
