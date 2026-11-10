'use strict';

// Steps for what Drupal CMS puts in front of a visitor and an editor that a
// plain core site does not: the cookie consent dialog (the Klaro module its
// base recipe installs) and the "resume your draft?" dialog of the Autosave
// Form module on a node form that was left mid-edit.

const { Given, When, Then, Before, AfterStep } = require('@cucumber/cucumber');
const { waitForPageLoad, friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  waitForState,
  assertPresence,
  robustClick,
} = require('@webship-js/drupal-core-steps/tests/step-definitions/drupal-helpers');

// Klaro's notice wraps its buttons in `.cn-ok`: the targets are the buttons
// themselves ("Accept" is the success button that is not the decline one).
const CONSENT = {
  dialog: '.klaro .cookie-modal, .klaro .cookie-notice, .klaro .cm-modal, .klaro [role="dialog"]',
  accept: '.klaro button.cm-btn-accept-all, .klaro button.cm-btn-accept, .klaro button.cm-btn-success:not(.cn-decline):not(.cm-btn-danger)',
  decline: '.klaro button.cn-decline, .klaro button.cm-btn-decline, .klaro button.cm-btn-danger',
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Accept the cookie consent before every scenario, by pre-seeding the
 * consent Klaro stores, so the dialog never covers what a scenario clicks.
 * `worldParameters.acceptCookieConsent: false` (KEEP_COOKIE_CONSENT=1)
 * keeps the dialog, for the scenarios about it.
 */
Before({ order: 20 }, async function () {
  if (!this.parameters || this.parameters.acceptCookieConsent === false) return;
  if (!this.context || !this.launchUrl) return;
  // Klaro keeps the consents in a cookie named "klaro" (Drupal CMS's
  // configuration); a stored consent, whatever it says, counts as "the
  // visitor answered", so the notice stays away. Every service is accepted.
  try {
    await this.context.addCookies([{
      name: 'klaro',
      value: encodeURIComponent(JSON.stringify({ klaro: true, cms: true, matomo: true, ga: true, gtm: true })),
      url: this.launchUrl,
    }]);
  } catch (e) { /* a launch URL without a host; nothing to pre-accept */ }
});

/**
 * Discard the "resume your draft?" dialog the Autosave Form module shows on
 * a node form that was left mid-edit by an earlier scenario, so the form
 * stays usable; the dialog otherwise intercepts the next click.
 */
AfterStep(async function () {
  if (!this.page) return;
  if (!/\/node\/(add|\d+\/edit)/.test(this.page.url())) return;
  const dialog = this.page.locator('.ui-dialog.autosave-dialog, .ui-dialog:has(.autosave-form-dialog), .ui-dialog:has-text("resume")').first();
  if (!(await dialog.isVisible({ timeout: 300 }).catch(() => false))) return;
  const reject = dialog.locator('button:has-text("No"), button:has-text("Discard"), button:has-text("Reject"), .ui-dialog-buttonset button').first();
  if (await reject.count()) await robustClick(reject);
});

// ---------------------------------------------------------------------------
// Cookie consent
// ---------------------------------------------------------------------------

/**
 * Assert the cookie consent dialog (Klaro) is, or is not, shown on the page.
 * The suite accepts the consent before every scenario by default; set
 * `worldParameters.acceptCookieConsent` to false (KEEP_COOKIE_CONSENT=1) to
 * see the dialog and test it.
 *
 * Example #1: Then I should see the cookie consent dialog
 * Example #2: And I should see the cookie consent dialog
 * Example #3: Then I should not see the cookie consent dialog
 * Example #4: And we should not see the cookie consent dialog
 * Example #5: Then I should see the cookie consent banner
 *
 */
Then(/^(I |we )*should( not)* see the cookie consent (?:dialog|banner|notice)$/, async function (pronounCase, notCase) {
  await assertPresence(this.page.locator(CONSENT.dialog).first(), notCase, 'the cookie consent dialog (".klaro")');
});

/**
 * Accept, or decline, the cookie consent dialog through its own buttons,
 * which stores the choice the way a visitor's click would.
 *
 * Example #1: When I accept the cookie consent
 * Example #2: And I accept the cookie consent
 * Example #3: When I decline the cookie consent
 * Example #4: And we decline the cookie consent
 * Example #5: When I accept all cookies
 *
 */
When(/^(I |we )*(accept|decline) (?:the cookie consent|all cookies)$/, async function (pronounCase, choice) {
  const button = this.page.locator(choice === 'accept' ? CONSENT.accept : CONSENT.decline).first();
  await waitForState(button, 'visible', `Expected the cookie consent dialog with its "${choice}" button`);
  await robustClick(button);
  await this.page.locator(CONSENT.dialog).first().waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  await waitForPageLoad(this.page, budget(this));
});

/**
 * Forget the stored cookie consent and reload, so the dialog shows again
 * for the scenarios about it (the suite pre-accepts it otherwise).
 *
 * Example #1: Given the cookie consent is not given yet
 * Example #2: Given the cookie consent was not given yet
 * Example #3: Given the cookie consent is reset
 * Example #4: And the cookie consent is not given yet
 * Example #5: Given the cookie consent has been reset
 *
 */
Given(/^the cookie consent (?:is|was|has been) (?:not given yet|reset)$/, async function () {
  // Drop the consent cookie (and anything Klaro may keep in storage), then
  // reload so the notice renders again.
  const cookies = await this.context.cookies().catch(() => []);
  const kept = cookies.filter((c) => !/klaro/i.test(c.name));
  if (kept.length !== cookies.length) {
    await this.context.clearCookies();
    if (kept.length) await this.context.addCookies(kept).catch(() => {});
  }
  await this.page.evaluate(() => {
    try { window.localStorage.removeItem('klaro'); } catch (e) { /* storage may be unavailable */ }
  }).catch(() => {});
  if (/^https?:/.test(this.page.url())) {
    await this.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await waitForPageLoad(this.page, budget(this));
  }
});

module.exports = { CONSENT };
