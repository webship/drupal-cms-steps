'use strict';

// Drupal CMS step definitions.
//
// What Drupal CMS adds on top of a plain core site, and nothing that the core
// pack (`@webship-js/drupal-core-steps`) or webship-js already provide: the
// Navigation module's sidebar and top bar as Drupal CMS ships them (Gin admin
// theme), the Dashboard module's dashboard and its sections, the Gin node
// form's sticky Save button, the editorial workflow's moderation control,
// email login (the Login Email or Username module), the content types a site
// template installs, and the contrib Moderation Sidebar when a site adds it.
//
// Drupal Canvas steps live in ./drupal-canvas.steps.js.
//
// Login, logout, named pages, status messages, page titles, breadcrumbs,
// listings and their operations, the rich text editor, the media library,
// session-aware HTTP status and cache flushing come from the core pack; element,
// text, table row, URL and response assertions come from webship-js.

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
  // Core's Navigation module sidebar, which Drupal CMS uses (Gin styles it).
  navigation: '#admin-toolbar',
  // The Navigation module's top bar: page title, moderation badge, primary
  // action and the "More actions" dropdown.
  topBar: '.top-bar',
  topBarActions: '.top-bar button.toolbar-button--icon--dots, .top-bar button[aria-label="More actions"]',
  // The Dashboard module's page.
  dashboard: '.dashboard, [data-drupal-selector="admin-dashboard"], .layout-dashboard',
  // Gin clones the node form's primary Save into its sticky action bar; that
  // clone is the control a person can click, the original sits underneath.
  saveButton: '#gin-sticky-edit-submit, [data-drupal-selector="gin-sticky-edit-submit"], #edit-submit',
  // Core content moderation's control form on a moderated entity's page.
  moderationControl: 'form.content-moderation-entity-moderation-form, .entity-moderation-form',
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
// Navigation sidebar
// ---------------------------------------------------------------------------

/**
 * Assert the Navigation sidebar lists, or does not list, a menu link by its
 * exact text, collapsed sections included (their links are in the markup).
 * Which links a role sees is how Drupal CMS scopes the back end, so this is
 * the quick permission check for a role.
 *
 * Example #1: Then the navigation toolbar should list "Dashboard"
 * Example #2: And the navigation sidebar should list "Pages"
 * Example #3: Then the navigation menu should not list "People"
 * Example #4: And the admin menu should list "Media"
 * Example #5: Then the navigation toolbar should not list "Extend"
 *
 */
Then(/^the (?:navigation|admin) (?:toolbar|sidebar|menu) should( not)* list "([^"]*)"$/, async function (notCase, linkText) {
  const sidebar = this.page.locator(SELECTORS.navigation).first();
  await assertPresence(sidebar, undefined, 'the navigation sidebar ("#admin-toolbar")', { attached: true });
  const link = sidebar.locator('a, button').filter({ hasText: new RegExp(`^\\s*${linkText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) }).first();
  await assertPresence(link, notCase, `a "${linkText}" link in the navigation sidebar`, { attached: true });
});

/**
 * Follow a menu link of the Navigation sidebar by its exact text, by
 * navigating to the link's target (links inside a collapsed section are in
 * the markup but not visible, and this is where a click would have gone).
 *
 * Example #1: When I click "Pages" in the navigation toolbar
 * Example #2: And I click "Dashboard" in the navigation sidebar
 * Example #3: When we click "Media" in the navigation menu
 * Example #4: And I click "People" in the admin menu
 * Example #5: When I click "Structure" in the navigation toolbar
 *
 */
When(/^(I |we )*click "([^"]*)" in the (?:navigation|admin) (?:toolbar|sidebar|menu)$/, async function (pronounCase, linkText) {
  const sidebar = this.page.locator(SELECTORS.navigation).first();
  await assertPresence(sidebar, undefined, 'the navigation sidebar ("#admin-toolbar")', { attached: true });
  const href = await sidebar.evaluate((nav, text) => {
    const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const link = [...nav.querySelectorAll('a[href]')].find((a) => norm(a.textContent) === text);
    return link ? link.getAttribute('href') : null;
  }, linkText);
  if (!href) {
    throw friendly(`No "${linkText}" link was found in the navigation sidebar.`);
  }
  await navigate(this, href);
});

// ---------------------------------------------------------------------------
// Top bar
// ---------------------------------------------------------------------------

/**
 * Open the top bar's "More actions" dropdown (the dots button) that holds the
 * secondary page actions: Delete, Revisions, Duplicate, Edit template.
 *
 * Example #1: When I open the top bar page actions
 * Example #2: And I open the top bar page actions menu
 * Example #3: When we open the top bar more actions
 * Example #4: And I open the more actions menu in the top bar
 * Example #5: When I open the top bar more actions menu
 *
 */
When(/^(I |we )*open the (?:top bar (?:page actions|more actions)(?: menu)?|more actions menu in the top bar)$/, async function (pronounCase) {
  const button = this.page.locator(SELECTORS.topBarActions).first();
  await waitForState(button, 'visible', 'Expected the top bar\'s "More actions" button');
  await waitForPageLoad(this.page, budget(this));
  await robustClick(button);
  await waitForPageLoad(this.page, budget(this));
});

/**
 * Assert the top bar offers, or does not offer, a page action by its text:
 * the primary action ("Edit") or one of the dropdown's entries ("Delete",
 * "Revisions", "Duplicate"), which are in the markup whether or not the
 * dropdown is open.
 *
 * Example #1: Then the top bar should offer the "Edit" action
 * Example #2: And the top bar should offer the "Delete" action
 * Example #3: Then the top bar should offer the "Revisions" action
 * Example #4: And the top bar should not offer the "Delete" action
 * Example #5: Then the top bar should not offer the "Edit layout" action
 *
 */
Then(/^the top bar should( not)* offer the "([^"]*)" action$/, async function (notCase, actionText) {
  const topBar = this.page.locator(SELECTORS.topBar).first();
  await assertPresence(topBar, undefined, 'the top bar (".top-bar")', { attached: true });
  const escaped = actionText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const action = topBar.locator('a, button').filter({ hasText: new RegExp(`^\\s*${escaped}\\s*$`) }).first();
  await assertPresence(action, notCase, `a "${actionText}" action in the top bar`, { attached: true });
});

/**
 * Follow a page action of the top bar by its text, opening the "More
 * actions" dropdown first when the action lives there. A link is followed by
 * navigating to its target; a button is clicked.
 *
 * Example #1: When I choose the "Edit" action in the top bar
 * Example #2: And I choose the "Revisions" action in the top bar
 * Example #3: When we choose the "Delete" action in the top bar
 * Example #4: And I choose the "Duplicate" action in the top bar
 * Example #5: When I choose the "Edit layout" action in the top bar
 *
 */
When(/^(I |we )*choose the "([^"]*)" action in the top bar$/, async function (pronounCase, actionText) {
  const topBar = this.page.locator(SELECTORS.topBar).first();
  await assertPresence(topBar, undefined, 'the top bar (".top-bar")', { attached: true });
  const target = await topBar.evaluate((bar, text) => {
    const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const el = [...bar.querySelectorAll('a, button')].find((e) => norm(e.textContent) === text);
    if (!el) return null;
    return { href: el.tagName === 'A' ? el.getAttribute('href') : null, visible: el.offsetParent !== null };
  }, actionText);
  if (!target) {
    throw friendly({
      message: `No "${actionText}" action was found in the top bar.`,
      hint: 'Use the visible label of a top bar action ("Edit", "Delete", "View"); the top bar only renders on a content item for a user who may act on it.',
    });
  }
  if (target.href) {
    await navigate(this, target.href);
    return;
  }
  if (!target.visible) {
    const dots = this.page.locator(SELECTORS.topBarActions).first();
    if (await dots.count()) await robustClick(dots);
  }
  const escaped = actionText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await robustClick(topBar.locator('button').filter({ hasText: new RegExp(`^\\s*${escaped}\\s*$`) }).first());
  await waitForPageLoad(this.page, budget(this));
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
// Content types and the node form
// ---------------------------------------------------------------------------

/**
 * Assert a content type exists, or does not, by its label, as listed on the
 * content types administration page (`/admin/structure/types`), which is
 * fetched with the current session so the page on screen is left alone. A
 * Drupal CMS site template installs its own set (Utility page, and whatever
 * the chosen recipes add: Blog post, Event, News, Person, Project).
 *
 * Example #1: Then the "Utility page" content type should exist
 * Example #2: And the "Blog post" content type should exist
 * Example #3: Then the "Article" content type should not exist
 * Example #4: And the "Event" content type should not exist
 * Example #5: Then the "Basic page" content type should not exist
 *
 */
Then(/^the "([^"]*)" content type should( not)* exist$/, async function (label, notCase) {
  const url = `${this.launchUrl.replace(/\/$/, '')}/admin/structure/types`;
  const response = await this.page.request.get(url, { failOnStatusCode: false });
  if (response.status() !== 200) {
    throw friendly({
      message: 'Could not read the content types administration page.',
      cause: `${url} answered ${response.status()}`,
      hint: 'Log in first as a user who may administer content types.',
    });
  }
  const html = await response.text();
  const rows = html.match(/<tr[\s\S]*?<\/tr>/g) || [];
  const text = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&#039;|&quot;/g, '\'').replace(/\s+/g, ' ');
  const found = rows.some((row) => new RegExp(`(^|\\s)${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(text(row)));
  assert.ok(
    notCase ? !found : found,
    friendly({
      message: notCase
        ? `Expected no "${label}" content type, but it is listed.`
        : `Expected a "${label}" content type, but none is listed.`,
      cause: `the listing has ${rows.length} row(s)`,
    }).message
  );
});

/**
 * Save the node form through the Save button a person sees. Gin clones the
 * form's Save into its sticky action bar on top of the original, so the
 * sticky clone is submitted when present, the plain `#edit-submit` otherwise,
 * both through an in-page click that waits for the navigation.
 *
 * Example #1: When I save the content
 * Example #2: And I save the content
 * Example #3: When we save the content
 * Example #4: And we save the content item
 * Example #5: When I save the node
 *
 */
When(/^(I |we )*save the (?:content|content item|node)$/, async function (pronounCase) {
  const found = await submitInPage(this, SELECTORS.saveButton, 'form.node-form');
  if (!found) {
    throw friendly({
      message: 'No Save button was found on the node form.',
      hint: 'Open a content add or edit form first; the step submits the sticky "Save" clone or the form\'s own "#edit-submit".',
    });
  }
});

/**
 * Assert the browser refused to submit the node form because a required
 * field is empty, naming the field. Drupal CMS marks fields such as the
 * Utility page's "Description" required, and HTML5 constraint validation then
 * blocks the submit before any request is made.
 *
 * Example #1: Then the "Description" field should block submission as required
 * Example #2: And the "Title" field should block submission as required
 * Example #3: Then the "Content" field should block submission as required
 * Example #4: And the "SEO title" field should block submission as required
 * Example #5: Then the "Name" field should block submission as required
 *
 */
Then(/^the "([^"]*)" field should block submission as required$/, async function (label) {
  const form = this.page.locator('form.node-form, form[id$="-form"]').first();
  await waitForState(form, 'attached', 'Expected a form on the page');
  const invalid = await form.evaluate((formEl) =>
    [...formEl.elements]
      .filter((el) => el.willValidate && !el.checkValidity())
      .map((el) => {
        const labelEl = formEl.querySelector(`label[for="${el.id}"]`);
        return {
          label: labelEl ? labelEl.textContent.replace(/\s+/g, ' ').trim() : el.name,
          message: el.validationMessage,
        };
      })
  );
  assert.ok(
    invalid.length > 0,
    friendly('Expected the form to be blocked by an unfilled required field, but the form validates.').message
  );
  assert.ok(
    invalid.some((f) => f.label.includes(label)),
    friendly({
      message: `Expected the "${label}" field to block submission.`,
      cause: `the blocking fields were: ${invalid.map((f) => `"${f.label}" (${f.message})`).join(', ')}`,
    }).message
  );
});

// ---------------------------------------------------------------------------
// Editorial workflow
// ---------------------------------------------------------------------------

/**
 * Assert the moderation state shown for the content item on screen, through
 * core content moderation's control form (the "Moderation state: Draft"
 * block an editor sees under a moderated item), the state badge of the
 * Navigation top bar, or, on the node form, the "Save as" selection. Drupal CMS applies its basic editorial workflow to
 * every content type its site templates install.
 *
 * Example #1: Then the content moderation state should be "Draft"
 * Example #2: And the moderation state should be "Published"
 * Example #3: Then the content moderation state should not be "Published"
 * Example #4: And the moderation state should be "In review"
 * Example #5: Then the moderation state should not be "Archived"
 *
 */
Then(/^the (?:content )?moderation state should( not)* be "([^"]*)"$/, async function (notCase, state) {
  const control = this.page.locator(SELECTORS.moderationControl).first();
  const badge = this.page.locator('.top-bar .toolbar-badge').first();
  const select = this.page.locator('select[name="moderation_state[0][state]"]').first();
  let current = null;
  if (await control.count()) {
    await waitForState(control, 'attached', 'Expected the content moderation control');
    const text = ((await control.textContent()) || '').replace(/\s+/g, ' ').trim();
    const match = text.match(/(?:Moderation state|Current state)\s*:?\s*([A-Za-z][A-Za-z ]*?)(?:\s+(?:Change to|Log message|Apply)|$)/i);
    current = match ? match[1].trim() : text;
  } else if (await badge.count()) {
    // The Navigation top bar shows the state as a badge next to the title;
    // core hides the control form once no transition is available.
    current = ((await badge.textContent()) || '').replace(/\s+/g, ' ').trim();
  } else if (await select.count()) {
    current = await select.evaluate((el) => (el.options[el.selectedIndex] || {}).text || el.value);
  } else {
    throw friendly({
      message: 'No moderation control was found on the page.',
      hint: 'Open a moderated content item (or its form) as a user who may see its moderation state.',
    });
  }
  const matches = current.toLowerCase().includes(state.toLowerCase());
  assert.ok(
    notCase ? !matches : matches,
    friendly({
      message: notCase
        ? `Expected the moderation state not to be "${state}".`
        : `Expected the moderation state to be "${state}".`,
      cause: `the control reads "${current}"`,
    }).message
  );
});

/**
 * Move the content item on screen to another moderation state through the
 * content moderation control form: pick the state in "Change to" and apply.
 * The transitions a role may take are the workflow's; an editor that may not
 * publish will not find "Published" in the list.
 *
 * Example #1: When I change the moderation state to "Published"
 * Example #2: And I change the moderation state to "Draft"
 * Example #3: When we change the moderation state to "In review"
 * Example #4: And I change the content moderation state to "Archived"
 * Example #5: When I change the moderation state to "Published"
 *
 */
When(/^(I |we )*change the (?:content )?moderation state to "([^"]*)"$/, async function (pronounCase, state) {
  const control = this.page.locator(SELECTORS.moderationControl).first();
  await waitForState(control, 'visible', 'Expected the content moderation control on the page');
  const select = control.locator('select[name="new_state"], select').first();
  await waitForState(select, 'visible', 'Expected the "Change to" state list in the moderation control');
  const options = await select.evaluate((el) => [...el.options].map((o) => ({ text: o.text.trim(), value: o.value })));
  const option = options.find((o) => o.text.toLowerCase() === state.toLowerCase()) || options.find((o) => o.value === state);
  if (!option) {
    throw friendly({
      message: `The moderation state "${state}" is not offered.`,
      cause: `the choices are: ${options.map((o) => o.text).join(', ')}`,
      hint: 'The workflow decides which transitions this role may take from the current state.',
    });
  }
  await select.selectOption(option.value);
  const found = await submitInPage(this, 'form.content-moderation-entity-moderation-form #edit-submit, .entity-moderation-form #edit-submit, .entity-moderation-form input[type="submit"]', 'form.content-moderation-entity-moderation-form');
  if (!found) {
    throw friendly({
      message: 'The moderation control has no Apply button to submit.',
      hint: 'The control form renders under a moderated content item for a user who may change its state; check the role\'s workflow permissions.',
    });
  }
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
