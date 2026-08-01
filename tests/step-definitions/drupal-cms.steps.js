'use strict';

/**
 * drupal-cms-steps / tests/step-definitions/drupal-cms.steps.js
 *
 * Custom webship-js step definitions for testing Drupal sites:
 * authentication, the admin toolbar/navigation, the admin dashboard,
 * content management (create/delete, content moderation), user management,
 * and status messages.
 *
 * Verified against Drupal core 11.4, rendered by the Gin admin theme with
 * core's Navigation module.
 *
 * These steps assume the standard webship-js World: `this.page` (Playwright
 * Page), `this.context` (BrowserContext), `this.launchUrl`, and
 * `this.parameters` (cucumber.js worldParameters).
 */

const { Given, When, Then, Before } = require('@cucumber/cucumber');
const assert = require('assert');

// ---------------------------------------------------------------------------
// Shared selectors (Gin admin theme)
// ---------------------------------------------------------------------------

const SELECTORS = {
  // Drupal core's Navigation module (#admin-toolbar) is the default admin
  // shell as of Drupal 10.3/11; the classic Toolbar module (#toolbar-bar) is
  // kept as a fallback for sites that have reverted to it.
  adminToolbar: '#admin-toolbar, #toolbar-bar, .gin-toolbar, [data-toolbar-tray]',
  ginNav: '#admin-toolbar, .gin--navigation, #gin-sidebar, .gin-sidebar, nav[aria-label="Administrative menu"]',
  pageTitle: 'h1.page-title, h1.gin-breadcrumb__title, .region-page-title h1, main h1',
  breadcrumb: '.gin-breadcrumb, .breadcrumb, nav.breadcrumb',
  messagesStatus: '.messages--status',
  messagesError: '.messages--error',
  messagesWarning: '.messages--warning',
  dataTable: 'table.views-table, table.responsive-enabled, .gin--table-sticky',
  dashboard: '.dashboard, [data-drupal-selector="admin-dashboard"], .layout-dashboard',
  loginForm: '#user-login-form',
  // Gin clones the node form's action buttons into its sticky top bar; the
  // in-form copy is physically covered by that bar, so the sticky clone (which
  // carries a form="…" attribute) is the one a real user can click.
  saveButton: '#gin-sticky-edit-submit, [data-drupal-selector="gin-sticky-edit-submit"], #edit-submit',
  unpublishedNode: '.node--unpublished',
};

/**
 * Look up a named user (username/password) from cucumber.js
 * worldParameters.users, throwing a helpful error if it is not configured.
 */
function resolveUser(parameters, role) {
  const users = (parameters && parameters.users) || {};
  if (!(role in users)) {
    throw new Error(
      `User "${role}" is not defined in cucumber.js worldParameters.users. ` +
        `Available users: ${Object.keys(users).join(', ') || '(none configured)'}`
    );
  }
  return users[role];
}

// ---------------------------------------------------------------------------
// Hermetic runs: block third-party (cross-origin) requests
// ---------------------------------------------------------------------------

/**
 * Some sites ship contrib modules that load front-end libraries from public
 * CDNs — notably `tagify`, whose library definition points at
 * //cdnjs.cloudflare.com. Those are render-blocking <script>/<link> tags, so
 * on a host without outbound internet access (air-gapped CI, offline dev box)
 * they never resolve and every admin form that uses them — /node/add/page in
 * particular — hangs until the navigation times out.
 *
 * Third-party CDN assets are not the system under test, so abort them up
 * front: the requests fail immediately instead of hanging, and runs become
 * hermetic and reproducible regardless of the runner's connectivity.
 *
 * Set `worldParameters.blockThirdPartyRequests` to false in cucumber.js to
 * opt out (e.g. when deliberately testing a third-party integration).
 */
Before({ order: 10 }, async function () {
  if (this.parameters && this.parameters.blockThirdPartyRequests === false) {
    return;
  }

  let siteHost;
  try {
    siteHost = new URL(this.launchUrl).hostname;
  } catch (e) {
    return; // Nothing sensible to compare against.
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
// Authentication
// ---------------------------------------------------------------------------

/**
 * Submit the Drupal user login form with an explicit name/password pair.
 */
async function submitLoginForm(page, launchUrl, name, password) {
  await page.goto(`${launchUrl}/user/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#edit-name', { state: 'visible', timeout: 10000 });
  await page.fill('#edit-name', name);
  await page.fill('#edit-pass', password);
  await page.click('#edit-submit');
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Log in through the Drupal user login form as a named user from
 * cucumber.js worldParameters.users.
 *
 * Example: Given I am logged in as "admin"
 * Example: Given I am logged in as "content editor"
 */
Given(/^I am logged in as "([^"]*)"$/, async function (role) {
  const { username, password } = resolveUser(this.parameters, role);
  await submitLoginForm(this.page, this.launchUrl, username, password);
});

/**
 * Log in using an email address instead of a username. Requires a module
 * (e.g. Login Email or Username) that lets the "Username or email address"
 * field accept either.
 *
 * Example: When I log in with the email address of "content editor"
 */
When(/^I log in with the email address of "([^"]*)"$/, async function (role) {
  const user = resolveUser(this.parameters, role);
  if (!user.email) {
    throw new Error(
      `User "${role}" has no "email" configured in cucumber.js worldParameters.users.`
    );
  }
  await submitLoginForm(this.page, this.launchUrl, user.email, user.password);
});

/**
 * Attempt to log in with an arbitrary (usually wrong) name/password pair.
 *
 * Example: When I try to log in as "admin" with the password "wrong-password"
 */
When(/^I try to log in as "([^"]*)" with the password "([^"]*)"$/, async function (name, password) {
  await submitLoginForm(this.page, this.launchUrl, name, password);
});

/**
 * Log out the current user.
 *
 * Drupal core (>= 10.3) protects /user/logout with a CSRF confirmation
 * form at /user/logout/confirm rather than logging out on a bare GET, so
 * this step follows through and submits that form.
 *
 * Example: When I log out
 */
When(/^I log out$/, async function () {
  await this.page.goto(`${this.launchUrl}/user/logout`, { waitUntil: 'domcontentloaded' });
  await this.page.waitForLoadState('domcontentloaded');

  const confirmButton = this.page.locator('#user-logout-confirm #edit-submit');
  if (await confirmButton.count() > 0) {
    await confirmButton.click();
    await this.page.waitForLoadState('domcontentloaded');
  }
});

/**
 * Assert the anonymous user login form is on screen. Drupal serves it for
 * anonymous 403s, so this doubles as "I was bounced to the login page".
 *
 * Example: Then I should see the login form
 */
Then(/^I should see the login form$/, async function () {
  await this.page.waitForSelector(SELECTORS.loginForm, { state: 'visible', timeout: 10000 });
});

// ---------------------------------------------------------------------------
// HTTP status of the current page (session-aware)
// ---------------------------------------------------------------------------

/**
 * Assert the HTTP status of the current URL *for the current session*.
 *
 * webship-js's built-in "the response status code should be" step re-fetches
 * the URL with axios and therefore always sees the anonymous response — which
 * is wrong for authenticated Drupal pages. This step re-fetches through
 * Playwright's request context, which shares the browser's cookie jar, so a
 * logged-in user's 200 and an anonymous 403 are both reported accurately.
 *
 * Example: Then the page should return HTTP status 403
 */
Then(/^the page should return HTTP status (\d+)$/, async function (expectedStatus) {
  const url = this.page.url();
  const response = await this.page.request.get(url, { failOnStatusCode: false });
  assert.strictEqual(
    response.status(),
    parseInt(expectedStatus, 10),
    `Expected HTTP ${expectedStatus} for ${url} but got ${response.status()}`
  );
});

/**
 * Assert Drupal's "Access denied" page is being shown.
 *
 * Example: Then I should be denied access
 */
Then(/^I should be denied access$/, async function () {
  const title = (await this.page.locator(SELECTORS.pageTitle).first().innerText()).trim();
  assert.ok(
    /access denied/i.test(title),
    `Expected the "Access denied" page but the page title was "${title}"`
  );
});

// ---------------------------------------------------------------------------
// Admin toolbar & navigation (Gin theme)
// ---------------------------------------------------------------------------

/**
 * Assert the Gin admin toolbar is visible (logged-in admin/editor pages).
 *
 * Example: Then I should see the admin toolbar
 */
Then(/^I should see the admin toolbar$/, async function () {
  await this.page.waitForSelector(SELECTORS.adminToolbar, { state: 'visible', timeout: 10000 });
});

/**
 * Assert the Gin admin toolbar is NOT visible (anonymous users).
 *
 * Example: Then I should not see the admin toolbar
 */
Then(/^I should not see the admin toolbar$/, async function () {
  const count = await this.page.locator(SELECTORS.adminToolbar).count();
  assert.strictEqual(count, 0, 'Admin toolbar should not be visible but it is.');
});

/**
 * Click a link by its visible text in the Gin admin navigation menu.
 *
 * Example: When I click "Content" in the admin menu
 */
When(/^I click "([^"]*)" in the admin menu$/, async function (linkText) {
  const adminNav = this.page.locator(SELECTORS.ginNav);
  await adminNav.getByText(linkText, { exact: false }).first().click();
  await this.page.waitForLoadState('domcontentloaded');
});

// ---------------------------------------------------------------------------
// Admin dashboard
// ---------------------------------------------------------------------------

/**
 * Navigate directly to the admin dashboard.
 *
 * Example: Given I am on the admin dashboard
 */
Given(/^I am on the admin dashboard$/, async function () {
  await this.page.goto(`${this.launchUrl}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
  await this.page.waitForLoadState('domcontentloaded');
});

/**
 * Assert the admin dashboard is visible.
 *
 * Example: Then I should see the admin dashboard
 */
Then(/^I should see the admin dashboard$/, async function () {
  const dashboard = this.page.locator(SELECTORS.dashboard);
  if (await dashboard.count() > 0) {
    await dashboard.first().waitFor({ state: 'visible', timeout: 10000 });
  } else {
    // Fall back to the page title, which is always "Dashboard" on that route.
    await this.page.waitForSelector(SELECTORS.pageTitle, { state: 'visible', timeout: 10000 });
    const text = (await this.page.locator(SELECTORS.pageTitle).first().innerText()).trim();
    assert.ok(/dashboard/i.test(text), `Expected the dashboard page title, got "${text}"`);
  }
});

/**
 * Assert a named dashboard section (block) is present, e.g. "Recent content",
 * "Top tasks", "Announcements".
 *
 * Example: Then I should see the "Top tasks" dashboard section
 */
Then(/^I should see the "([^"]*)" dashboard section$/, async function (sectionTitle) {
  const dashboard = this.page.locator(SELECTORS.dashboard).first();
  await dashboard.waitFor({ state: 'visible', timeout: 10000 });
  await dashboard.getByText(sectionTitle, { exact: false }).first()
    .waitFor({ state: 'visible', timeout: 10000 });
});

/**
 * Assert a dashboard section is NOT present — used to check that sections
 * gated behind an admin-only permission stay hidden from lesser roles.
 *
 * Example: Then I should not see the "Announcements" dashboard section
 */
Then(/^I should not see the "([^"]*)" dashboard section$/, async function (sectionTitle) {
  const dashboard = this.page.locator(SELECTORS.dashboard).first();
  await dashboard.waitFor({ state: 'visible', timeout: 10000 });
  const count = await dashboard.getByText(sectionTitle, { exact: false }).count();
  assert.strictEqual(count, 0, `Dashboard section "${sectionTitle}" should not be visible but it is.`);
});

// ---------------------------------------------------------------------------
// Page title & breadcrumb
// ---------------------------------------------------------------------------

/**
 * Assert the current Drupal page title (<h1> or <title> fallback).
 *
 * Example: Then the page title should be "Dashboard"
 */
Then(/^the page title should be "([^"]*)"$/, async function (expectedTitle) {
  const h1 = this.page.locator(SELECTORS.pageTitle).first();
  if (await h1.count() > 0) {
    const text = (await h1.innerText()).trim();
    assert.ok(
      text.includes(expectedTitle),
      `Expected page title to contain "${expectedTitle}" but got "${text}"`
    );
  } else {
    const title = await this.page.title();
    assert.ok(
      title.includes(expectedTitle),
      `Expected <title> to contain "${expectedTitle}" but got "${title}"`
    );
  }
});

/**
 * Assert the breadcrumb trail contains the given text.
 *
 * Example: Then the breadcrumb should contain "Content"
 */
Then(/^the breadcrumb should contain "([^"]*)"$/, async function (expectedText) {
  const breadcrumb = this.page.locator(SELECTORS.breadcrumb).first();
  await breadcrumb.waitFor({ state: 'visible', timeout: 10000 });
  const text = (await breadcrumb.innerText()).trim();
  assert.ok(
    text.includes(expectedText),
    `Expected breadcrumb to contain "${expectedText}" but got "${text}"`
  );
});

// ---------------------------------------------------------------------------
// Status messages
// ---------------------------------------------------------------------------

/**
 * Assert a Drupal status ("success") message is visible, optionally
 * matching specific text.
 *
 * Example: Then I should see a status message
 * Example: Then I should see a status message "has been created"
 */
Then(/^I should see a status message(?: "([^"]*)")?$/, async function (expectedText) {
  const message = this.page.locator(SELECTORS.messagesStatus).first();
  await message.waitFor({ state: 'visible', timeout: 10000 });
  if (expectedText) {
    const text = (await message.innerText()).replace(/\s+/g, ' ').trim();
    assert.ok(
      text.includes(expectedText),
      `Expected status message to contain "${expectedText}" but got "${text}"`
    );
  }
});

/**
 * Assert a Drupal error message is visible, optionally matching specific
 * text.
 *
 * Example: Then I should see an error message
 * Example: Then I should see an error message "1 error has been found"
 */
Then(/^I should see an error message(?: "([^"]*)")?$/, async function (expectedText) {
  const message = this.page.locator(SELECTORS.messagesError).first();
  await message.waitFor({ state: 'visible', timeout: 10000 });
  if (expectedText) {
    const text = (await message.innerText()).replace(/\s+/g, ' ').trim();
    assert.ok(
      text.includes(expectedText),
      `Expected error message to contain "${expectedText}" but got "${text}"`
    );
  }
});

// ---------------------------------------------------------------------------
// Content management
// ---------------------------------------------------------------------------

/**
 * Navigate to the content overview page (/admin/content).
 *
 * Example: Given I am on the content overview page
 */
Given(/^I am on the content overview page$/, async function () {
  await this.page.goto(`${this.launchUrl}/admin/content`, { waitUntil: 'domcontentloaded' });
  await this.page.waitForLoadState('domcontentloaded');
});

/**
 * Assert a row containing the given title exists in the content/data table
 * on the current page.
 *
 * Example: Then I should see "Home" in the content list
 */
Then(/^I should see "([^"]*)" in the content list$/, async function (title) {
  const table = this.page.locator(SELECTORS.dataTable).first();
  await table.waitFor({ state: 'visible', timeout: 10000 });
  const row = table.getByText(title, { exact: false });
  await row.first().waitFor({ state: 'visible', timeout: 10000 });
});

/**
 * Assert the moderation/publication status shown for a given row of the
 * content overview table, e.g. "Published" or "Unpublished".
 *
 * Example: Then the content list row for "Privacy policy" should show "Unpublished"
 */
Then(/^the content list row for "([^"]*)" should show "([^"]*)"$/, async function (title, expectedStatus) {
  const table = this.page.locator(SELECTORS.dataTable).first();
  await table.waitFor({ state: 'visible', timeout: 10000 });
  const row = table.locator('tr').filter({ hasText: title }).first();
  await row.waitFor({ state: 'visible', timeout: 10000 });
  const text = (await row.innerText()).replace(/\s+/g, ' ').trim();
  assert.ok(
    new RegExp(`(^|\\s)${expectedStatus}(\\s|$)`).test(text),
    `Expected the "${title}" row to show "${expectedStatus}" but the row reads: ${text}`
  );
});

/**
 * Navigate to the "Add content" page for a given content type machine name
 * or label (e.g. "page", "article").
 *
 * Example: Given I am adding a "page"
 */
Given(/^I am adding an? "([^"]*)"$/, async function (contentType) {
  const machineName = contentType.toLowerCase().replace(/\s+/g, '_');
  await this.page.goto(`${this.launchUrl}/node/add/${machineName}`, { waitUntil: 'domcontentloaded' });
  await this.page.waitForLoadState('domcontentloaded');
});

/**
 * Submit the node form.
 *
 * Gin duplicates the node form's action buttons into its sticky top bar and
 * that bar overlays the in-form buttons, so a real user's click always lands
 * on the sticky clone — click that when it is present.
 *
 * Example: When I save the content
 */
When(/^I save the content$/, async function () {
  await this.page.locator(SELECTORS.saveButton).first().click();
  await this.page.waitForLoadState('domcontentloaded');
});

/**
 * Assert the browser refused to submit the node form because a required
 * field is empty, and report which field. When a content type marks a field
 * required, the form is blocked client-side by HTML5 constraint validation
 * before any request is sent.
 *
 * Example: Then the "Description" field should block submission as required
 */
Then(/^the "([^"]*)" field should block submission as required$/, async function (label) {
  const invalid = await this.page.locator('form.node-form').first().evaluate((form) =>
    [...form.elements]
      .filter((el) => el.willValidate && !el.checkValidity())
      .map((el) => {
        const labelEl = form.querySelector(`label[for="${el.id}"]`);
        return {
          label: labelEl ? labelEl.textContent.replace(/\s+/g, ' ').trim() : el.name,
          message: el.validationMessage,
        };
      })
  );

  assert.ok(
    invalid.length > 0,
    'Expected the node form to be blocked by an unfilled required field, but the form validates.'
  );
  assert.ok(
    invalid.some((f) => f.label.includes(label)),
    `Expected the "${label}" field to block submission, but the blocking fields were: ` +
      invalid.map((f) => `"${f.label}" (${f.message})`).join(', ')
  );
});

/**
 * Assert the content item currently being viewed is unpublished. Under an
 * editorial workflow, new content saves as a Draft, so a freshly created page
 * is unpublished until it is explicitly moderated to Published.
 *
 * Example: Then the content item should be unpublished
 */
Then(/^the content item should be unpublished$/, async function () {
  const count = await this.page.locator(SELECTORS.unpublishedNode).count();
  assert.ok(count > 0, 'Expected the content item to be marked unpublished, but it is not.');
});

/**
 * Delete the content item currently being viewed, via its own delete form.
 * Keeps content-creation scenarios idempotent across runs.
 *
 * Example: When I delete the content item I am viewing
 */
When(/^I delete the content item I am viewing$/, async function () {
  const hrefs = await this.page.locator('a[href*="/node/"]').evaluateAll((links) =>
    links.map((a) => a.getAttribute('href') || '')
  );
  const match = hrefs.map((h) => h.match(/\/node\/(\d+)(\/|$|\?)/)).find(Boolean);
  assert.ok(match, 'Could not determine the node ID of the content item being viewed.');

  await this.page.goto(`${this.launchUrl}/node/${match[1]}/delete`, { waitUntil: 'domcontentloaded' });
  await this.page.locator('#edit-submit').click();
  await this.page.waitForLoadState('domcontentloaded');
});

// ---------------------------------------------------------------------------
// User management
// ---------------------------------------------------------------------------

/**
 * Navigate to the people/user administration page (/admin/people).
 *
 * Example: Given I am on the people administration page
 */
Given(/^I am on the people administration page$/, async function () {
  await this.page.goto(`${this.launchUrl}/admin/people`, { waitUntil: 'domcontentloaded' });
  await this.page.waitForLoadState('domcontentloaded');
});

/**
 * Assert a username exists in the people/user table.
 *
 * Example: Then I should see the user "content_editor"
 */
Then(/^I should see the user "([^"]*)"$/, async function (username) {
  const table = this.page.locator(SELECTORS.dataTable).first();
  await table.waitFor({ state: 'visible', timeout: 10000 });
  const row = table.getByText(username, { exact: false });
  await row.first().waitFor({ state: 'visible', timeout: 10000 });
});

/**
 * Assert a user is listed with a given role on /admin/people.
 *
 * Example: Then the user "content_editor" should have the "Content editor" role
 */
Then(/^the user "([^"]*)" should have the "([^"]*)" role$/, async function (username, role) {
  const table = this.page.locator(SELECTORS.dataTable).first();
  await table.waitFor({ state: 'visible', timeout: 10000 });
  const row = table.locator('tr').filter({ hasText: username }).first();
  await row.waitFor({ state: 'visible', timeout: 10000 });
  const text = (await row.innerText()).replace(/\s+/g, ' ').trim();
  assert.ok(
    text.includes(role),
    `Expected the "${username}" row to list the "${role}" role but the row reads: ${text}`
  );
});

// ---------------------------------------------------------------------------
// Generic wait helper (pages can settle behind AJAX/Ajax throbbers)
// ---------------------------------------------------------------------------

/**
 * Wait for the DOM to attach and finish its initial load — useful after
 * Drupal AJAX interactions (exposed filters, autocomplete, off-canvas
 * dialogs) that don't trigger a full navigation.
 *
 * Example: And wait
 */
When(/^wait$/, async function () {
  await this.page.waitForSelector('body', { state: 'attached', timeout: 10000 });
  await this.page.waitForLoadState('domcontentloaded');
});
