'use strict';

// Steps for what Drupal CMS puts in front of a visitor and an editor that a
// plain core site does not: the cookie consent dialog (the Klaro module its
// base recipe installs) and the "resume your draft?" dialog of the Autosave
// Form module on a node form that was left mid-edit.

const { Given, When, Then, Before, AfterStep } = require('@cucumber/cucumber');
const assert = require('assert');
const { waitForPageLoad, smartSettle, friendly } = require('webship-js/tests/step-definitions/webship');
const {
  WAIT_TIMEOUT,
  budget,
  navigate,
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
  // The notice ("Use of personal data and cookies", with Customize, Decline
  // and Accept) and the settings the visitor opens from it or from the
  // "My privacy settings" link of the footer menu.
  notice: '.klaro .cookie-notice',
  settings: '.klaro .cookie-modal',
  customize: '.klaro .cookie-notice .cn-learn-more',
  reopen: '[rel~="open-consent-manager"]',
  save: '.klaro .cookie-modal button.cm-btn-accept',
};

const KLARO_SETTINGS_PATH = '/admin/config/user-interface/klaro';
const KLARO_SERVICES_PATH = '/admin/config/user-interface/klaro/services';

/**
 * The consents Klaro stored for the visitor, read from its cookie (named
 * "klaro" on Drupal CMS; `worldParameters.consentCookieName` for a site that
 * renamed it), or null when the visitor has not answered yet.
 *
 * @param {object} world
 * @returns {Promise<Object<string, boolean>|null>}
 */
async function storedConsent(world) {
  const name = (world.parameters && world.parameters.consentCookieName) || 'klaro';
  const cookies = await world.context.cookies().catch(() => []);
  const cookie = cookies.find((c) => c.name === name);
  if (!cookie) return null;
  try {
    return JSON.parse(decodeURIComponent(cookie.value));
  } catch (e) {
    return null;
  }
}

/**
 * Describe a stored consent for a failure message.
 *
 * @param {Object<string, boolean>|null} consent
 * @returns {string}
 */
function describeConsent(consent) {
  if (!consent) return 'no consent is stored (the visitor has not answered)';
  return `the stored consent is ${Object.entries(consent).map(([k, v]) => `${k}: ${v ? 'given' : 'refused'}`).join(', ')}`;
}

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

// ---------------------------------------------------------------------------
// The consent settings of the visitor
// ---------------------------------------------------------------------------

/**
 * Open the consent settings, the dialog that lists the services by purpose
 * with a switch each: through "Customize" while the notice is on screen, or
 * through the "My privacy settings" link (`rel="open-consent-manager"`) once
 * the visitor has answered.
 *
 * Example #1: When I open the consent settings
 * Example #2: And I open the consent settings
 * Example #3: When we open the consent settings
 * Example #4: And we open the privacy settings
 * Example #5: When I open my privacy settings
 *
 */
When(/^(I |we )*open (?:the consent settings|the privacy settings|my privacy settings|our privacy settings)$/, async function (pronounCase) {
  const settings = this.page.locator(CONSENT.settings).first();
  if (!(await settings.isVisible().catch(() => false))) {
    const customize = this.page.locator(CONSENT.customize).first();
    const reopen = this.page.locator(CONSENT.reopen).first();
    try {
      await customize.or(reopen).first().waitFor({ state: 'visible', timeout: 15000 });
    } catch (error) {
      throw friendly({
        message: 'The page offers no way to open the consent settings.',
        cause: `neither the notice's "Customize" link nor a "My privacy settings" link is on ${this.page.url()}`,
        hint: 'The consent manager must not be silent, and the footer menu must keep its "My privacy settings" link.',
      });
    }
    await robustClick((await customize.isVisible().catch(() => false)) ? customize : reopen);
  }
  await waitForState(settings, 'visible', 'Expected the consent settings to open');
});

/**
 * In the open consent settings, allow or refuse a service, by the name the
 * dialog shows ("Matomo") or its machine name ("matomo"). Services are
 * grouped by purpose and the groups start folded, so the step unfolds the
 * group first. A required service cannot be refused. Save afterwards with
 * "I save the consent settings".
 *
 * Example #1: When I allow the "Matomo" service in the consent settings
 * Example #2: And I refuse the "Matomo" service in the consent settings
 * Example #3: When we allow the "YouTube" service in the consent settings
 * Example #4: And we refuse the "Google Analytics" service in the consent settings
 * Example #5: When I allow the "matomo" service in the consent settings
 *
 */
When(/^(I |we )*(allow|refuse) the "([^"]*)" service in the consent settings$/, async function (pronounCase, choice, service) {
  const settings = this.page.locator(CONSENT.settings).first();
  await waitForState(settings, 'visible', 'Expected the consent settings to be open ("I open the consent settings")');
  const found = await settings.evaluate((root, wanted) => {
    const key = wanted.trim().toLowerCase();
    const items = [...root.querySelectorAll('li.cm-service')].map((li) => {
      const input = li.querySelector('input.cm-list-input');
      const title = li.querySelector('.cm-list-title');
      return { id: input ? input.id : '', name: title ? title.textContent.trim() : '', disabled: Boolean(input && input.disabled) };
    });
    const match = items.find((i) => i.name.toLowerCase() === key) || items.find((i) => i.id.replace(/^service-item-/, '').toLowerCase() === key);
    return { match: match || null, names: items.map((i) => i.name) };
  }, service);
  if (!found.match) {
    throw friendly({
      message: `The consent settings list no "${service}" service.`,
      cause: `services listed: ${found.names.join(', ') || 'none'}`,
      hint: 'A service shows here once it is enabled in the consent manager (Configuration, User interface, Klaro!).',
    });
  }
  if (found.match.disabled) {
    throw friendly({
      message: `The "${found.match.name}" service is always required, so the visitor cannot ${choice} it.`,
    });
  }
  const input = settings.locator(`[id="${found.match.id}"]`);
  const label = settings.locator(`label[for="${found.match.id}"]`);
  if (!(await label.isVisible().catch(() => false))) {
    // Unfold the purpose the service belongs to.
    await settings.locator(`li.cm-purpose:has([id="${found.match.id}"]) .cm-caret a`).first().click();
    await waitForState(label, 'visible', `Expected the "${found.match.name}" service to show after unfolding its purpose`);
  }
  const want = choice === 'allow';
  if ((await input.isChecked()) !== want) await label.click();
  assert.strictEqual(await input.isChecked(), want, friendly({
    message: `The "${found.match.name}" service did not switch ${want ? 'on' : 'off'} in the consent settings.`,
  }).message);
});

/**
 * Save the choices made in the consent settings ("Accept selected"), which
 * stores them and closes the dialog.
 *
 * Example #1: When I save the consent settings
 * Example #2: And I save the consent settings
 * Example #3: When we save the consent settings
 * Example #4: And we save the privacy settings
 * Example #5: When I save my privacy settings
 *
 */
When(/^(I |we )*save (?:the consent settings|the privacy settings|my privacy settings|our privacy settings)$/, async function (pronounCase) {
  const save = this.page.locator(CONSENT.save).first();
  await waitForState(save, 'visible', 'Expected the consent settings with their "Accept selected" button ("I open the consent settings")');
  await robustClick(save);
  await waitForState(this.page.locator(CONSENT.settings).first(), 'hidden', 'Expected the consent settings to close after saving');
  await waitForPageLoad(this.page, budget(this));
});

/**
 * Assert what the consent manager stored for a service, by its machine name
 * ("matomo", "ga", "youtube"): given, or not. "Not given" holds both when
 * the visitor refused the service and when nothing is stored yet. This reads
 * the stored consent itself, which is what makes "Accept", "Decline" and a
 * saved selection tell apart.
 *
 * Example #1: Then the consent for the "matomo" service should be given
 * Example #2: And the consent for the "matomo" service should not be given
 * Example #3: Then the consent for the "klaro" service should be given
 * Example #4: And the consent for the "youtube" service should not be given
 * Example #5: Then the consent for the "cms" service should be given
 *
 */
Then(/^the consent for the "([^"]*)" service should( not)* be given$/, async function (service, notCase) {
  const key = service.trim();
  const want = !notCase;
  // The consent manager writes its cookie right after the click: read it
  // until it says what is expected, within a short budget.
  let consent = await storedConsent(this);
  let ok = Boolean(consent && consent[key]) === want;
  const deadline = Date.now() + 5000;
  while (!ok && Date.now() < deadline) {
    await smartSettle(this.page, 250);
    consent = await storedConsent(this);
    ok = Boolean(consent && consent[key]) === want;
  }
  assert.ok(ok, friendly({
    message: want
      ? `Expected the consent for the "${key}" service to be given.`
      : `Expected the consent for the "${key}" service not to be given.`,
    cause: describeConsent(consent),
    hint: 'Use the machine name of the service, as the consent manager lists it (Configuration, User interface, Klaro!, Manage).',
  }).message);
});

/**
 * Assert the consent manager stored, or did not store, an answer for the
 * visitor at all: after "Accept", "Decline" or a saved selection one is
 * stored and the notice stays away; before that, none is.
 *
 * Example #1: Then the cookie consent should be stored
 * Example #2: And the cookie consent should be stored
 * Example #3: Then the cookie consent should not be stored
 * Example #4: And the cookie consent should not be stored
 * Example #5: Then the visitor's cookie consent should be stored
 *
 */
Then(/^the (?:visitor's )?cookie consent should( not)* be stored$/, async function (notCase) {
  const consent = await storedConsent(this);
  assert.ok(notCase ? !consent : Boolean(consent), friendly({
    message: notCase ? 'Expected no stored cookie consent.' : 'Expected a stored cookie consent.',
    cause: describeConsent(consent),
  }).message);
});

// ---------------------------------------------------------------------------
// The privacy settings of the site (the consent manager's administration)
// ---------------------------------------------------------------------------

/**
 * Read the dialog modes of the consent manager's settings form.
 *
 * @param {object} world
 * @returns {Promise<Array<{value: string, label: string, checked: boolean}>>}
 */
async function readDialogModes(world) {
  await navigate(world, KLARO_SETTINGS_PATH);
  const radios = world.page.locator('input[name="dialog_mode"]');
  try {
    await radios.first().waitFor({ state: 'attached', timeout: 15000 });
  } catch (error) {
    const title = ((await world.page.locator('h1').first().innerText({ timeout: 1000 }).catch(() => '')) || '').trim();
    throw friendly({
      message: 'The settings of the consent manager did not open.',
      cause: `${world.page.url()} shows "${title}"`,
      hint: 'Log in first as a user who may administer the consent manager; the klaro module must be installed.',
    });
  }
  return radios.evaluateAll((inputs) => inputs.map((input) => ({
    value: input.value,
    label: ((input.labels && input.labels[0] && input.labels[0].textContent) || '').replace(/\s+/g, ' ').trim(),
    checked: input.checked,
  })));
}

/**
 * Find a dialog mode by its machine name ("silent", "notice",
 * "notice_modal", "manager") or the start of its label ("Notice dialog").
 *
 * @param {Array<{value: string, label: string, checked: boolean}>} modes
 * @param {string} wanted
 * @returns {{value: string, label: string, checked: boolean}|undefined}
 */
function findDialogMode(modes, wanted) {
  const key = wanted.trim().toLowerCase();
  return modes.find((m) => m.value.toLowerCase() === key)
    || modes.find((m) => m.label.toLowerCase() === key)
    || modes.find((m) => m.label.toLowerCase().startsWith(key));
}

/**
 * Assert the dialog mode of the consent manager (Configuration, User
 * interface, Klaro!): "silent" shows the visitor nothing and only blocks
 * what needs a consent, "notice" shows the notice, "notice_modal" shows it
 * as a modal, "manager" opens the consent settings at once. Drupal CMS
 * installs it silent. Give the machine name or the start of the label.
 *
 * Example #1: Then the consent dialog mode should be "silent"
 * Example #2: And the consent dialog mode should be "notice"
 * Example #3: Then the consent dialog mode should not be "silent"
 * Example #4: And the consent dialog mode should be "Notice dialog"
 * Example #5: Then the consent dialog mode should not be "manager"
 *
 */
Then(/^the consent dialog mode should( not)* be "([^"]*)"$/, async function (notCase, wanted) {
  const modes = await readDialogModes(this);
  const mode = findDialogMode(modes, wanted);
  if (!mode) {
    throw friendly({
      message: `The consent manager has no dialog mode "${wanted}".`,
      cause: `modes: ${modes.map((m) => `${m.value} ("${m.label}")`).join(', ')}`,
    });
  }
  const current = modes.find((m) => m.checked);
  assert.ok(notCase ? !mode.checked : mode.checked, friendly({
    message: notCase
      ? `The consent dialog mode is "${mode.value}", which was not expected.`
      : `The consent dialog mode is not "${mode.value}".`,
    cause: `the mode is ${current ? `"${current.value}" ("${current.label}")` : 'not set'}`,
  }).message);
});

/**
 * Set the dialog mode of the consent manager and save its settings. This
 * changes the site's configuration: set it back at the end of the scenario.
 *
 * Example #1: When I set the consent dialog mode to "silent"
 * Example #2: And I set the consent dialog mode to "notice"
 * Example #3: When we set the consent dialog mode to "notice_modal"
 * Example #4: And we set the consent dialog mode to "manager"
 * Example #5: When I set the consent dialog mode to "Notice dialog"
 *
 */
When(/^(I |we )*set the consent dialog mode to "([^"]*)"$/, async function (pronounCase, wanted) {
  const modes = await readDialogModes(this);
  const mode = findDialogMode(modes, wanted);
  if (!mode) {
    throw friendly({
      message: `The consent manager has no dialog mode "${wanted}".`,
      cause: `modes: ${modes.map((m) => `${m.value} ("${m.label}")`).join(', ')}`,
    });
  }
  await this.page.locator(`input[name="dialog_mode"][value="${mode.value}"]`).check({ force: true });
  await Promise.all([
    this.page.waitForLoadState('domcontentloaded'),
    robustClick(this.page.locator('[data-drupal-selector="gin-sticky-edit-submit"], #edit-submit:visible').first()),
  ]);
  await waitForState(this.page.locator('.messages--status').first(), 'visible', 'Expected the consent manager to confirm that its settings were saved');
  await waitForPageLoad(this.page, budget(this));
});

/**
 * Assert a service of the consent manager is enabled or disabled, by its
 * name, as the "Manage" tab lists it (Configuration, User interface,
 * Klaro!, Manage). A fresh Drupal CMS enables only its two required
 * services, "Drupal CMS" and "Consent manager"; nothing that tracks a
 * visitor is on until the site owner enables it.
 *
 * Example #1: Then the "Drupal CMS" consent service should be enabled
 * Example #2: And the "Consent manager" consent service should be enabled
 * Example #3: Then the "Matomo" consent service should be disabled
 * Example #4: And the "YouTube" consent service should be disabled
 * Example #5: Then the "Google Analytics" consent service should be enabled
 *
 */
Then(/^the "([^"]*)" consent service should be (enabled|disabled)$/, async function (service, expected) {
  if (!this.page.url().includes(KLARO_SERVICES_PATH)) await navigate(this, KLARO_SERVICES_PATH);
  const rows = await this.page.locator('table tbody tr').evaluateAll((trs) => trs.map((tr) => {
    const cells = [...tr.cells].map((c) => c.innerText.replace(/\s+/g, ' ').trim());
    return { status: cells[0] || '', name: cells[1] || '' };
  }));
  if (!rows.length) {
    const title = ((await this.page.locator('h1').first().innerText({ timeout: 1000 }).catch(() => '')) || '').trim();
    throw friendly({
      message: 'The services of the consent manager did not open.',
      cause: `${this.page.url()} shows "${title}"`,
      hint: 'Log in first as a user who may administer the consent manager.',
    });
  }
  const row = rows.find((r) => r.name === service.trim());
  if (!row) {
    throw friendly({
      message: `The consent manager has no "${service}" service.`,
      cause: `services: ${rows.map((r) => r.name).join(', ')}`,
    });
  }
  assert.strictEqual(row.status.toLowerCase(), expected, friendly({
    message: `Expected the "${service}" consent service to be ${expected}.`,
    cause: `it is ${row.status.toLowerCase()}; enabled services: ${rows.filter((r) => /^enabled$/i.test(r.status)).map((r) => r.name).join(', ') || 'none'}`,
  }).message);
});

module.exports = { CONSENT, storedConsent };
