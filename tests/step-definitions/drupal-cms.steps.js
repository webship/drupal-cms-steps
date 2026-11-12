'use strict';

// Drupal CMS step definitions.
//
// What Drupal CMS adds to a Drupal core site, and nothing that the core pack
// (`@webship-js/drupal-core-steps`, which ./drupal-cms-defaults.js loads) or
// webship-js already provide. This file holds the dashboard and its sections,
// the login with an email address (the Login Email or Username module), and
// the hook that keeps a run free of third-party requests.
//
// The other step files of this pack:
//   ./drupal-canvas.steps.js          Canvas through its authoring API and its Library
//   ./drupal-canvas-pages.steps.js    the life of a page in the Canvas editor
//   ./drupal-canvas-library.steps.js  patterns and media in Canvas
//   ./drupal-cms-trash.steps.js       the trash
//   ./drupal-cms-consent.steps.js     the cookie consent and the privacy settings
//   ./drupal-cms-addons.steps.js      the recommended add-ons of Project Browser
//   ./drupal-cms-forms.steps.js       the forms of the Forms recipe
//   ./drupal-cms-editorial.steps.js   scheduling, the workflow, redirects
//   ./drupal-site-templates.steps.js  site templates and recipes
//
// Login by handle, named pages, status messages, page titles, breadcrumbs,
// listings and their operations, the rich text editor, the media library,
// access control, the Navigation sidebar and the top bar, the Save button of
// a content form, content types, content moderation and the site structure
// come from the core pack; element, text, table row, URL and response
// assertions come from webship-js.

const { Given, When, Then, Before } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  WAIT_TIMEOUT,
  supplied,
  navigate,
  assertPresence,
  resolveUser,
  loginWithForm,
  sessionStatus,
} = require('@webship-js/drupal-core-steps/tests/step-definitions/drupal-helpers');

const SELECTORS = {
  // The Dashboard module's page.
  dashboard: '.dashboard',
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
 * `.dashboard` layout, which only the dashboard page renders. A page that
 * merely carries a "Dashboard" title, or the login form a visitor gets in
 * its place, does not count.
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
  try {
    await dashboard.waitFor({ state: notCase ? 'hidden' : 'visible', timeout: WAIT_TIMEOUT });
  } catch (error) {
    const title = ((await this.page.locator('h1').first().innerText({ timeout: 1000 }).catch(() => '')) || '').trim();
    throw friendly({
      message: notCase ? 'The dashboard is on screen, which was not expected.' : 'The dashboard is not on screen.',
      cause: `${this.page.url()} shows "${title}"`,
      hint: notCase ? undefined : 'Open it with "I am on the dashboard" as a user who may view it; a refused visitor gets the login form.',
    });
  }
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

// Referenced for completeness by downstream packs; kept exported so a project
// can reuse the selectors without copying them.
module.exports = { SELECTORS, WAIT_TIMEOUT, sessionStatus };
