'use strict';

// Editorial tools of Drupal CMS: scheduling (the Scheduler module), the
// editorial workflow (core's Workflows and Content Moderation, set up by the
// base recipe as the "Basic" workflow) and redirects (the Redirect module).
//
// The moderation state of a content item, and changing it, are core pack
// steps (`the content moderation state should be "Draft"`, `I change the
// moderation state to "Published"`); the steps here add what Drupal CMS
// brings on top.

const { When, Then } = require('@cucumber/cucumber');
const assert = require('assert');
const { waitForPageLoad, friendly } = require('webship-js/tests/step-definitions/webship');
const {
  WAIT_TIMEOUT,
  budget,
  joinUrl,
  navigate,
  robustClick,
} = require('@webship-js/drupal-core-steps/tests/step-definitions/drupal-helpers');

const SUBMIT = '[data-drupal-selector="gin-sticky-edit-submit"], #edit-submit:visible';

/**
 * A redirect source as the Redirect module stores and lists it: no leading
 * slash in the form, a leading slash in the listing.
 *
 * @param {string} source
 * @returns {string}
 */
function bareSource(source) {
  return String(source).trim().replace(/^\/+/, '');
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

/**
 * On a content form, schedule the item to be published, or unpublished, on
 * a date at a time: the step opens "Scheduling options", fills the date and
 * the time, and, on a moderated content type, chooses the state the
 * scheduler moves the item to. The date is `YYYY-MM-DD`, the time `HH:MM`,
 * in the site's time zone. Save the form afterwards. Scheduler publishes
 * when cron runs after that moment.
 *
 * Example #1: When I schedule the content to be published on "2031-01-15" at "09:30"
 * Example #2: And I schedule the content to be unpublished on "2031-02-01" at "18:00"
 * Example #3: When we schedule the content to be published on "2030-12-24" at "08:00"
 * Example #4: And we schedule the content to be unpublished on "2031-06-30" at "23:59"
 * Example #5: Given I schedule the content to be published on "2032-03-01" at "00:05"
 *
 */
When(/^(I |we )*schedule the content to be (published|unpublished) on "(\d{4}-\d{2}-\d{2})" at "(\d{2}:\d{2})"$/, async function (pronounCase, action, date, time) {
  const prefix = action === 'published' ? 'publish' : 'unpublish';
  const dateField = this.page.locator(`[name="${prefix}_on[0][value][date]"]`).first();
  if (!(await dateField.count())) {
    throw friendly({
      message: `This form has no "${action === 'published' ? 'Publish on' : 'Unpublish on'}" field.`,
      cause: `the browser is on ${this.page.url()}`,
      hint: 'Open the add or edit form of a content type that has scheduling enabled (the Utility page has).',
    });
  }
  const details = this.page.locator('details').filter({ has: dateField }).last();
  if (await details.count() && !(await details.evaluate((el) => el.open))) {
    await details.locator('> summary').click();
  }
  try {
    await dateField.waitFor({ state: 'visible', timeout: 15000 });
    await dateField.fill(date);
    await this.page.locator(`[name="${prefix}_on[0][value][time]"]`).first().fill(time);
    // A moderated content type asks which state the scheduler moves the item to.
    const state = this.page.locator(`select[name="${prefix}_state"]`).first();
    if (await state.count()) {
      const wanted = action === 'published' ? 'published' : 'unpublished';
      const values = await state.locator('option').evaluateAll((options) => options.map((o) => o.value));
      const value = values.includes(wanted) ? wanted : values.find((v) => v && v !== '_none');
      if (value) await state.selectOption(value);
    }
  } catch (error) {
    throw friendly({
      message: `Could not schedule the content to be ${action} on ${date} at ${time}.`,
      cause: error,
    });
  }
});

/**
 * Assert the "Scheduled content" listing (`/admin/content/scheduled`) lists,
 * or does not list, a content item by its title. The step opens the listing
 * itself. Needs a user who may view scheduled content.
 *
 * Example #1: Then the scheduled content should list "Spring campaign"
 * Example #2: And the scheduled content should list "Opening hours"
 * Example #3: Then the scheduled content should not list "Spring campaign"
 * Example #4: And the scheduled content should not list "Old news"
 * Example #5: Then the scheduled content should list "Privacy policy"
 *
 */
Then(/^the scheduled content should( not)* list "([^"]*)"$/, async function (notCase, title) {
  await navigate(this, '/admin/content/scheduled');
  const heading = ((await this.page.locator('h1').first().innerText({ timeout: 5000 }).catch(() => '')) || '').trim();
  if (!/scheduled/i.test(heading)) {
    throw friendly({
      message: 'The scheduled content listing did not open.',
      cause: `${this.page.url()} shows "${heading}"`,
      hint: 'Log in first as a user who may view scheduled content; the scheduler module must be installed.',
    });
  }
  const escaped = title.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cell = this.page.locator('table tbody td').filter({ hasText: new RegExp(`^\\s*${escaped}\\s*$`) }).first();
  try {
    await cell.waitFor({ state: notCase ? 'detached' : 'visible', timeout: 10000 });
  } catch (error) {
    const rows = await this.page.locator('table tbody tr').allInnerTexts().catch(() => []);
    throw friendly({
      message: notCase
        ? `The scheduled content lists "${title}", which was not expected.`
        : `The scheduled content does not list "${title}".`,
      cause: `the listing reads: ${rows.map((r) => r.replace(/\s+/g, ' ').trim()).join(' / ') || 'nothing'}`,
    });
  }
});

// ---------------------------------------------------------------------------
// The editorial workflow
// ---------------------------------------------------------------------------

/**
 * Assert a workflow has, or does not have, a state or a transition, by the
 * labels its edit page shows (Configuration, Workflow, Workflows). Drupal
 * CMS ships the "Basic" workflow with the states Draft, Published and
 * Unpublished and the transitions Create new draft, Publish and Unpublish.
 * Needs a user who may administer workflows.
 *
 * Example #1: Then the "Basic" workflow should have the "Draft" state
 * Example #2: And the "Basic" workflow should have the "Published" state
 * Example #3: Then the "Basic" workflow should have the "Publish" transition
 * Example #4: And the "Basic" workflow should not have the "Archived" state
 * Example #5: Then the "Basic" workflow should not have the "Archive" transition
 *
 */
Then(/^the "([^"]*)" workflow should( not)* have the "([^"]*)" (state|transition)$/, async function (workflow, notCase, label, kind) {
  await navigate(this, '/admin/config/workflow/workflows');
  const escape = (text) => text.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const row = this.page.locator('table tbody tr').filter({ has: this.page.locator('td').filter({ hasText: new RegExp(`^\\s*${escape(workflow)}\\s*$`) }) }).first();
  const edit = row.locator('a[href*="/workflows/manage/"]').first();
  const href = await edit.getAttribute('href', { timeout: 10000 }).catch(() => null);
  if (!href) {
    const names = await this.page.locator('table tbody tr td:first-child').allInnerTexts().catch(() => []);
    throw friendly({
      message: `There is no "${workflow}" workflow.`,
      cause: `${this.page.url()} lists: ${names.map((s) => s.trim()).filter(Boolean).join(', ') || 'nothing'}`,
      hint: 'Log in first as a user who may administer workflows.',
    });
  }
  await navigate(this, href.replace(/\?.*$/, ''));
  const container = this.page.locator(kind === 'state' ? '#edit-states-container' : '#edit-transitions-container').first();
  const labels = (await container.locator('table tbody tr td:first-child').allInnerTexts().catch(() => [])).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const found = labels.includes(label.trim());
  assert.ok(notCase ? !found : found, friendly({
    message: notCase
      ? `The "${workflow}" workflow has the "${label}" ${kind}, which was not expected.`
      : `The "${workflow}" workflow has no "${label}" ${kind}.`,
    cause: `${kind}s: ${labels.join(', ') || 'none'}`,
  }).message);
});

// ---------------------------------------------------------------------------
// Redirects
// ---------------------------------------------------------------------------

/**
 * Add a URL redirect through Configuration, Search and metadata, URL
 * redirects (`/admin/config/search/redirect/add`): from a path of the site
 * to another path or an absolute URL, with the default status (301). Needs
 * a user who may administer redirects.
 *
 * Example #1: When I add a redirect from "old-address" to "/home"
 * Example #2: And I add a redirect from "/old-address" to "/privacy-policy"
 * Example #3: When we add a redirect from "summer-2025" to "/campaigns"
 * Example #4: And we add a redirect from "press" to "https://example.com/press"
 * Example #5: Given I add a redirect from "legal" to "/privacy-policy"
 *
 */
When(/^(I |we )*add a redirect from "([^"]*)" to "([^"]*)"$/, async function (pronounCase, source, target) {
  await navigate(this, '/admin/config/search/redirect/add');
  const from = this.page.locator('[name="redirect_source[0][path]"]').first();
  try {
    await from.waitFor({ state: 'visible', timeout: 15000 });
  } catch (error) {
    throw friendly({
      message: 'The "Add URL redirect" form did not open.',
      cause: `the browser is on ${this.page.url()}`,
      hint: 'Log in first as a user who may administer redirects; the redirect module must be installed.',
    });
  }
  await from.fill(bareSource(source));
  await this.page.locator('[name="redirect_redirect[0][uri]"]').first().fill(target);
  await Promise.all([
    this.page.waitForURL((url) => !/\/redirect\/add/.test(url.pathname), { timeout: WAIT_TIMEOUT }).catch(() => {}),
    robustClick(this.page.locator(SUBMIT).first()),
  ]);
  await waitForPageLoad(this.page, budget(this));
  if (/\/redirect\/add/.test(this.page.url())) {
    const errors = ((await this.page.locator('.messages--error, .form-item--error-message').first().innerText({ timeout: 1000 }).catch(() => '')) || '').replace(/\s+/g, ' ').trim();
    throw friendly({
      message: `The redirect from "${source}" to "${target}" was not saved.`,
      cause: errors || 'the form stayed open',
    });
  }
});

/**
 * Assert a path of the site answers with a redirect to a target, or does
 * not: the path is requested without following redirects, and the
 * `Location` of the answer is compared with the target (a path, or an
 * absolute URL). The request is anonymous, so it sees what a visitor and a
 * search engine see.
 *
 * Example #1: Then the path "/old-address" should redirect to "/home"
 * Example #2: And the path "/summer-2025" should redirect to "/campaigns"
 * Example #3: Then the path "/press" should redirect to "https://example.com/press"
 * Example #4: And the path "/old-address" should not redirect to "/home"
 * Example #5: Then the path "/legal" should not redirect to "/privacy-policy"
 *
 */
Then(/^the path "([^"]*)" should( not)* redirect to "([^"]*)"$/, async function (source, notCase, target) {
  const url = joinUrl(this.launchUrl, source);
  const request = await this.page.context().browser().newContext({ ignoreHTTPSErrors: true });
  let status;
  let location;
  try {
    const response = await request.request.get(url, { maxRedirects: 0, failOnStatusCode: false });
    status = response.status();
    location = response.headers().location || '';
  } finally {
    await request.close();
  }
  const normalise = (value) => {
    if (!value) return '';
    try {
      const parsed = new URL(value, this.launchUrl);
      const same = parsed.origin === new URL(this.launchUrl).origin;
      return (same ? '' : parsed.origin) + parsed.pathname.replace(/\/+$/, '') + parsed.search;
    } catch (e) {
      return value;
    }
  };
  const redirects = status >= 300 && status < 400 && normalise(location) === normalise(target);
  assert.ok(notCase ? !redirects : redirects, friendly({
    message: notCase
      ? `The path "${source}" redirects to "${target}", which was not expected.`
      : `The path "${source}" does not redirect to "${target}".`,
    cause: `${url} answered ${status}${location ? ` with Location "${location}"` : ' with no Location header'}`,
  }).message);
});

/**
 * Delete a URL redirect by its source path, through the redirects listing
 * (`/admin/config/search/redirect`) and the confirmation. Keeps a scenario
 * that adds a redirect repeatable.
 *
 * Example #1: When I delete the redirect from "old-address"
 * Example #2: And I delete the redirect from "/old-address"
 * Example #3: When we delete the redirect from "summer-2025"
 * Example #4: And we delete the redirect from "press"
 * Example #5: Then I delete the redirect from "legal"
 *
 */
When(/^(I |we )*delete the redirect from "([^"]*)"$/, async function (pronounCase, source) {
  await navigate(this, '/admin/config/search/redirect');
  const wanted = `/${bareSource(source)}`;
  const escaped = wanted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const row = this.page.locator('table tbody tr').filter({ has: this.page.locator('td').filter({ hasText: new RegExp(`^\\s*${escaped}\\s*$`) }) }).first();
  const href = await row.locator('a[href*="/redirect/delete/"]').first().getAttribute('href', { timeout: 10000 }).catch(() => null);
  if (!href) {
    const rows = await this.page.locator('table tbody tr').allInnerTexts().catch(() => []);
    throw friendly({
      message: `There is no redirect from "${wanted}" to delete.`,
      cause: `the listing reads: ${rows.map((r) => r.replace(/\s+/g, ' ').trim()).join(' / ') || 'nothing'}`,
    });
  }
  await navigate(this, href);
  try {
    await Promise.all([
      this.page.waitForURL((url) => !/\/redirect\/delete\//.test(url.pathname), { timeout: WAIT_TIMEOUT }),
      robustClick(this.page.locator(`form.confirmation #edit-submit, ${SUBMIT}`).first()),
    ]);
  } catch (error) {
    throw friendly({ message: `Could not confirm the deletion of the redirect from "${wanted}".`, cause: error });
  }
  await waitForPageLoad(this.page, budget(this));
});

module.exports = { bareSource };
