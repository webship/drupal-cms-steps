'use strict';

// The forms of Drupal CMS (the Forms recipe: Webform, with ALTCHA and
// Honeypot as spam protection).
//
// The recipe adds the "Contact" form at `/form/contact-form`. A visitor fills
// it with webship-js's field steps, passes the "I'm not a robot" check, and
// submits; the site answers with a confirmation. The administrator finds the
// submission under the form's results. The steps here are the parts no
// generic step covers: the spam protection, the confirmation, the results.

const { When, Then } = require('@cucumber/cucumber');
const assert = require('assert');
const { waitForPageLoad, smartSettle, friendly } = require('webship-js/tests/step-definitions/webship');
const {
  WAIT_TIMEOUT,
  budget,
  navigate,
  assertPresence,
  robustClick,
} = require('@webship-js/drupal-core-steps/tests/step-definitions/drupal-helpers');

const FORMS = {
  webform: 'form.webform-submission-form',
  confirmation: '.webform-confirmation',
  altcha: 'altcha-widget',
};

/**
 * The row of a form on the Webforms overview (`/admin/structure/webform`),
 * by the form's title.
 *
 * @param {object} world
 * @param {string} title
 * @returns {Promise<import('playwright').Locator>}
 */
async function webformRow(world, title) {
  await navigate(world, '/admin/structure/webform');
  const escaped = title.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const link = world.page.locator('td a').filter({ hasText: new RegExp(`^\\s*${escaped}\\s*$`) });
  const row = world.page.locator('table tbody tr').filter({ has: link }).first();
  try {
    await row.waitFor({ state: 'visible', timeout: 15000 });
  } catch (error) {
    const titles = await world.page.locator('table tbody tr td:nth-child(2)').allInnerTexts().catch(() => []);
    throw friendly({
      message: `The Webforms overview lists no "${title}" form.`,
      cause: `${world.page.url()} lists: ${titles.map((s) => s.trim()).filter(Boolean).join(', ') || 'nothing'}`,
      hint: 'Log in first as a user who may administer webforms; the Forms recipe must be applied.',
    });
  }
  return row;
}

/**
 * Pass the spam protection of the form on screen, the way a visitor does:
 * tick the "I'm not a robot" box of the ALTCHA widget and wait until it
 * reports "verified". The browser solves a proof of work against the site;
 * no outside service is called. It needs the HTTPS address of the site,
 * because browsers offer the Web Crypto API only in a secure context. The
 * step then waits out the minimum time Honeypot wants between the page load
 * and the submission (5 seconds on Drupal CMS;
 * `worldParameters.formTimeLimit` in seconds for another value, 0 for a
 * site without Honeypot's time limit). A form without the widget only gets
 * the time limit.
 *
 * Example #1: When I pass the spam protection of the form
 * Example #2: And I pass the spam protection of the form
 * Example #3: When we pass the spam protection of the form
 * Example #4: And we pass the spam protection of the form
 * Example #5: Given I pass the spam protection of the form
 *
 */
When(/^(I |we )*pass the spam protection of the form$/, { timeout: 120000 }, async function (pronounCase) {
  const widget = this.page.locator(FORMS.altcha).first();
  if (await widget.count()) {
    const box = widget.locator('input[type="checkbox"]').first();
    // The proof of work needs the Web Crypto API, which a browser offers only
    // in a secure context (HTTPS, or localhost).
    if (!(await this.page.evaluate(() => window.isSecureContext && Boolean(window.crypto && window.crypto.subtle)))) {
      throw friendly({
        message: 'The "I\'m not a robot" check of the form cannot run on this address.',
        cause: `${this.page.url()} is not a secure context, so the browser has no Web Crypto API for the proof of work`,
        hint: 'Run the suite against the HTTPS address of the site (LAUNCH_URL=https://...).',
      });
    }
    try {
      await box.waitFor({ state: 'visible', timeout: 15000 });
      if (!(await widget.locator('.altcha[data-state="verified"]').count())) await box.click();
      await widget.locator('.altcha[data-state="verified"]').waitFor({ state: 'attached', timeout: 60000 });
    } catch (error) {
      const state = await widget.locator('.altcha').getAttribute('data-state', { timeout: 1000 }).catch(() => 'unknown');
      throw friendly({
        message: 'The "I\'m not a robot" check of the form did not reach "verified".',
        cause: `the widget is "${state}"`,
        hint: 'The widget fetches its challenge from the site (/altcha/v1/challenge); check that the request is answered.',
      });
    }
  }
  const configured = this.parameters && this.parameters.formTimeLimit;
  const limit = Number.isFinite(Number(configured)) && configured !== undefined && configured !== null && configured !== '' ? Number(configured) : 5;
  if (limit > 0) {
    // Wait until the page is old enough, measured in the page itself.
    await this.page.waitForFunction((ms) => performance.now() >= ms, (limit + 1) * 1000, { timeout: (limit + 30) * 1000, polling: 250 });
  }
});

/**
 * Assert the confirmation a webform shows after a submission is, or is not,
 * on screen, optionally with its text.
 *
 * Example #1: Then I should see the form confirmation
 * Example #2: And I should see the form confirmation "Thanks for contacting us!"
 * Example #3: Then I should not see the form confirmation
 * Example #4: And we should see the form confirmation "We have received your message"
 * Example #5: Then we should not see the form confirmation "Thanks"
 *
 */
Then(/^(I |we )*should( not)* see the form confirmation(?: "([^"]*)")?$/, async function (pronounCase, notCase, text) {
  let confirmation = this.page.locator(FORMS.confirmation);
  if (text !== undefined && text !== null) confirmation = confirmation.filter({ hasText: text });
  try {
    await confirmation.first().waitFor({ state: notCase ? 'hidden' : 'visible', timeout: WAIT_TIMEOUT });
  } catch (error) {
    const shown = ((await this.page.locator(FORMS.confirmation).first().innerText({ timeout: 1000 }).catch(() => '')) || '').replace(/\s+/g, ' ').trim();
    const messages = ((await this.page.locator('[data-drupal-messages], .messages').first().innerText({ timeout: 1000 }).catch(() => '')) || '').replace(/\s+/g, ' ').trim();
    throw friendly({
      message: notCase
        ? 'The form confirmation is on screen, which was not expected.'
        : `The form confirmation${text ? ` "${text}"` : ''} is not on screen.`,
      cause: shown ? `the confirmation reads "${shown}"` : (messages ? `the page says "${messages}"` : `no confirmation on ${this.page.url()}`),
      hint: 'A submission sent too fast or without the spam protection is refused: use "I pass the spam protection of the form" before the submit.',
    });
  }
});

/**
 * Assert how many submissions a webform has, by the form's title, as the
 * Webforms overview (`/admin/structure/webform`) counts them in its
 * "Results" column. Needs a user who may administer webforms.
 *
 * Example #1: Then the "Contact" form should have 1 submission
 * Example #2: And the "Contact" form should have 0 submissions
 * Example #3: Then the "Contact" form should have at least 1 submission
 * Example #4: And the "Newsletter" form should have 3 submissions
 * Example #5: Then the "Feedback" form should have at least 2 submissions
 *
 */
Then(/^the "([^"]*)" form should have (at least )?(\d+) submissions?$/, async function (title, atLeast, expected) {
  const row = await webformRow(this, title);
  const head = await this.page.locator('table thead').first().locator('th').allInnerTexts();
  const column = head.findIndex((h) => /^\s*Results/i.test(h));
  const cell = column >= 0 ? row.locator('td').nth(column) : row.locator('a[href*="/results/submissions"]').first();
  const count = parseInt((((await cell.innerText()) || '').match(/\d+/) || ['0'])[0], 10);
  const want = parseInt(expected, 10);
  assert.ok(atLeast ? count >= want : count === want, friendly({
    message: `Expected the "${title}" form to have ${atLeast ? 'at least ' : ''}${want} submission(s).`,
    cause: `the Webforms overview counts ${count}`,
  }).message);
});

/**
 * Clear every submission of a webform, by the form's title, through the
 * form's "Results, Clear" page and its confirmation. Keeps a suite that
 * submits a form from filling the site.
 *
 * Example #1: When I clear the submissions of the "Contact" form
 * Example #2: And I clear the submissions of the "Contact" form
 * Example #3: When we clear the submissions of the "Newsletter" form
 * Example #4: And we clear the submissions of the "Feedback" form
 * Example #5: Then I clear the submissions of the "Contact" form
 *
 */
When(/^(I |we )*clear the submissions of the "([^"]*)" form$/, async function (pronounCase, title) {
  const row = await webformRow(this, title);
  const results = await row.locator('a[href*="/results/submissions"]').first().getAttribute('href');
  await navigate(this, results.replace(/\/results\/submissions.*$/, '/results/clear'));
  const confirm = this.page.locator('form#webform-results-clear input[name="confirm"], form.webform-results-clear-form input[name="confirm"]').first();
  try {
    await confirm.waitFor({ state: 'visible', timeout: 15000 });
    await confirm.check();
    await Promise.all([
      this.page.waitForURL((url) => !/\/results\/clear/.test(url.pathname), { timeout: WAIT_TIMEOUT }),
      robustClick(this.page.locator('[data-drupal-selector="gin-sticky-edit-submit"], form#webform-results-clear #edit-submit').first()),
    ]);
  } catch (error) {
    throw friendly({
      message: `Could not clear the submissions of the "${title}" form.`,
      cause: error,
    });
  }
  await waitForPageLoad(this.page, budget(this));
});

module.exports = { FORMS };
