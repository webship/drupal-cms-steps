'use strict';

// The add-ons of Drupal CMS, as Project Browser shows them.
//
// "Extend, Recommended add-ons" (`/admin/modules/browse/recommended`) lists
// the add-on recipes Drupal CMS recommends (Accessibility Tools, AI
// Assistant, Forms, Google Analytics, Multilingual, Search) with their
// state: an "Install" button, or "<name> is Installed". The steps read that
// screen, which is the one place the site itself says which recipes it has;
// the precondition step `the "..." recipe is applied` only reads the suite's
// configuration.

const { Given, Then } = require('@cucumber/cucumber');
const assert = require('assert');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const { navigate } = require('@webship-js/drupal-core-steps/tests/step-definitions/drupal-helpers');

const ADDONS_PATH = '/admin/modules/browse/recommended';
const ADDONS = {
  browser: '#project-browser',
  card: '.pb-project',
  title: '.pb-project__title',
  installed: '.project_status-indicator',
  install: '.pb__action_button',
};

/**
 * Open the recommended add-ons, unless they are on screen, and wait for the
 * cards Project Browser renders.
 *
 * @param {object} world
 * @returns {Promise<void>}
 */
async function openAddons(world) {
  if (!world.page.url().includes(ADDONS_PATH)) await navigate(world, ADDONS_PATH);
  try {
    await world.page.locator(`${ADDONS.browser} ${ADDONS.card}`).first().waitFor({ state: 'visible', timeout: 30000 });
  } catch (error) {
    const title = ((await world.page.locator('h1').first().innerText({ timeout: 1000 }).catch(() => '')) || '').trim();
    throw friendly({
      message: 'The recommended add-ons did not load.',
      cause: `${world.page.url()} shows "${title}"`,
      hint: 'Log in first as a user who may administer modules; the project_browser module must be installed.',
    });
  }
}

/**
 * Read the add-ons on screen: name, machine name and whether each is installed.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<Array<{name: string, machineName: string, installed: boolean}>>}
 */
async function readAddons(page) {
  return page.locator(`${ADDONS.browser} ${ADDONS.card}`).evaluateAll((cards, sel) => cards.map((card) => {
    const title = card.querySelector(sel.title);
    const button = title && title.querySelector('button, a');
    return {
      name: ((title && title.textContent) || '').replace(/\s+/g, ' ').trim(),
      machineName: ((button && button.id) || '').replace(/_title$/, ''),
      installed: Boolean(card.querySelector(sel.installed)),
    };
  }), ADDONS);
}

/**
 * Find an add-on by its name ("Forms") or its recipe's machine name
 * ("drupal_cms_forms", "drupal/drupal_cms_forms").
 *
 * @param {Array<{name: string, machineName: string, installed: boolean}>} addons
 * @param {string} wanted
 * @returns {{name: string, machineName: string, installed: boolean}|undefined}
 */
function findAddon(addons, wanted) {
  const key = String(wanted).trim().toLowerCase().replace(/^drupal\//, '');
  return addons.find((a) => a.name.toLowerCase() === key) || addons.find((a) => a.machineName.toLowerCase() === key);
}

/**
 * Open "Extend, Recommended add-ons" (`/admin/modules/browse/recommended`),
 * the Project Browser screen that lists the add-on recipes of Drupal CMS.
 *
 * Example #1: Given I am on the recommended add-ons page
 * Example #2: Given we are on the recommended add-ons page
 * Example #3: And I am on the recommended add-ons
 * Example #4: Given I am on the recommended add-ons
 * Example #5: And we are on the recommended add-ons
 *
 */
Given(/^(I am |we are )*on the recommended add-ons(?: page)?$/, async function (pronounCase) {
  await navigate(this, ADDONS_PATH);
  await openAddons(this);
});

/**
 * Assert the recommended add-ons offer, or do not offer, an add-on, by its
 * name or its recipe's machine name, whatever its state.
 *
 * Example #1: Then the recommended add-ons should list "AI Assistant"
 * Example #2: And the recommended add-ons should list "Forms"
 * Example #3: Then the recommended add-ons should list "drupal_cms_search"
 * Example #4: And the recommended add-ons should not list "Commerce"
 * Example #5: Then the recommended add-ons should not list "drupal_cms_events"
 *
 */
Then(/^the recommended add-ons should( not)* list "([^"]*)"$/, async function (notCase, wanted) {
  await openAddons(this);
  const addons = await readAddons(this.page);
  const found = findAddon(addons, wanted);
  assert.ok(notCase ? !found : Boolean(found), friendly({
    message: notCase
      ? `The recommended add-ons list "${wanted}", which was not expected.`
      : `The recommended add-ons do not list "${wanted}".`,
    cause: `add-ons listed: ${addons.map((a) => `${a.name} (${a.machineName})`).join(', ') || 'none'}`,
  }).message);
});

/**
 * Assert an add-on is, or is not, installed on the site, by its name or its
 * recipe's machine name, as the recommended add-ons show it ("Forms is
 * Installed", or an "Install" button). This is the site's own record of an
 * applied recipe.
 *
 * Example #1: Then the "Forms" add-on should be installed
 * Example #2: And the "Search" add-on should be installed
 * Example #3: Then the "AI Assistant" add-on should not be installed
 * Example #4: And the "drupal_cms_forms" add-on should be installed
 * Example #5: Then the "drupal_cms_multilingual" add-on should not be installed
 *
 */
Then(/^the "([^"]*)" add-on should( not)* be installed$/, async function (wanted, notCase) {
  await openAddons(this);
  const addons = await readAddons(this.page);
  const found = findAddon(addons, wanted);
  if (!found) {
    throw friendly({
      message: `The recommended add-ons do not list "${wanted}".`,
      cause: `add-ons listed: ${addons.map((a) => `${a.name} (${a.machineName})`).join(', ') || 'none'}`,
    });
  }
  assert.ok(notCase ? !found.installed : found.installed, friendly({
    message: notCase
      ? `The "${found.name}" add-on is installed, which was not expected.`
      : `The "${found.name}" add-on is not installed.`,
    cause: `installed add-ons: ${addons.filter((a) => a.installed).map((a) => a.name).join(', ') || 'none'}`,
  }).message);
});

/**
 * Assert the site agrees with the suite's configuration: every recipe named
 * in `worldParameters.recipes` (`DRUPAL_CMS_RECIPES`) that the recommended
 * add-ons know is shown as installed there, and no other recommended add-on
 * is. It fails when the suite was told about a recipe the site does not
 * have, or the site has one the suite was not told about, either of which
 * makes the `the "..." recipe is applied` scenarios run or skip wrongly.
 *
 * Example #1: Then the installed add-ons should match the recipes of the suite
 * Example #2: And the installed add-ons should match the recipes of the suite
 * Example #3: Then the installed add-ons should match the suite recipes
 * Example #4: And the installed add-ons should match the suite recipes
 * Example #5: Then the installed add-ons should match the recipes of the suite configuration
 *
 */
Then(/^the installed add-ons should match (?:the recipes of the suite(?: configuration)?|the suite recipes)$/, async function () {
  await openAddons(this);
  const addons = await readAddons(this.page);
  const configured = ((this.parameters && this.parameters.recipes) || []).map((r) => String(r).trim().toLowerCase().replace(/^drupal\//, ''));
  const installed = addons.filter((a) => a.installed).map((a) => a.machineName.toLowerCase());
  const known = addons.map((a) => a.machineName.toLowerCase());
  const missing = configured.filter((r) => known.includes(r) && !installed.includes(r));
  const untold = installed.filter((r) => !configured.includes(r));
  assert.ok(!missing.length && !untold.length, friendly({
    message: 'The add-ons installed on the site differ from the recipes the suite was told about.',
    cause: [
      missing.length ? `named in DRUPAL_CMS_RECIPES but not installed: ${missing.join(', ')}` : '',
      untold.length ? `installed but not named in DRUPAL_CMS_RECIPES: ${untold.join(', ')}` : '',
    ].filter(Boolean).join('; '),
    hint: 'Set DRUPAL_CMS_RECIPES (worldParameters.recipes) to the recipes applied to the site, comma separated.',
  }).message);
});

module.exports = { ADDONS, ADDONS_PATH };
