'use strict';

// The trash of Drupal CMS (the Trash module).
//
// Deleting content in Drupal CMS does not remove it: a deleted Utility page
// or Canvas page moves to the trash, where it can be restored or purged.
// The trash has one listing per kind of content: `/admin/content/trash` for
// content items and `/admin/content/trash/canvas_page` for Canvas pages. A
// page in the trash keeps its URL alias, so Canvas refuses to publish another
// page at that alias until the first one is purged.
//
// Every step needs a logged in user who may use the trash (the administrator).

const { Given, When, Then } = require('@cucumber/cucumber');
const { waitForPageLoad, friendly } = require('webship-js/tests/step-definitions/webship');
const {
  WAIT_TIMEOUT,
  budget,
  navigate,
  robustClick,
} = require('@webship-js/drupal-core-steps/tests/step-definitions/drupal-helpers');

const TRASH_PATHS = {
  content: '/admin/content/trash',
  'canvas page': '/admin/content/trash/canvas_page',
};

/**
 * The trash listing a step phrase names.
 *
 * @param {string} kind - "content", "Canvas page" or "Canvas pages".
 * @returns {string}
 */
function trashPath(kind) {
  return /canvas/i.test(kind) ? TRASH_PATHS['canvas page'] : TRASH_PATHS.content;
}

/**
 * Open a trash listing and fail with a hint when the site refuses it.
 *
 * @param {object} world
 * @param {string} kind
 * @returns {Promise<void>}
 */
async function openTrash(world, kind) {
  await navigate(world, trashPath(kind));
  const heading = world.page.locator('h1').filter({ hasText: /^\s*Trash\s*$/ }).first();
  try {
    await heading.waitFor({ state: 'visible', timeout: 15000 });
  } catch (error) {
    const title = ((await world.page.locator('h1').first().innerText({ timeout: 1000 }).catch(() => '')) || '').trim();
    throw friendly({
      message: `The ${/canvas/i.test(kind) ? 'Canvas pages' : 'content'} trash did not open.`,
      cause: `${world.page.url()} shows "${title}"`,
      hint: 'Log in first as a user who may use the trash; the trash module must be installed.',
    });
  }
}

/**
 * The rows of the open trash listing whose title is the given one. The
 * listing prints the title followed by the id, "Landing (12)".
 *
 * @param {import('playwright').Page} page
 * @param {string} title
 * @returns {import('playwright').Locator}
 */
function trashRows(page, title) {
  const escaped = title.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cell = page.locator('td').filter({ hasText: new RegExp(`^\\s*${escaped}(\\s*\\(\\d+\\))?\\s*$`) });
  return page.locator('table tbody tr').filter({ has: cell });
}

/**
 * The titles the open trash listing shows, for a failure message.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<string>}
 */
async function trashTitles(page) {
  const rows = await page.locator('table tbody tr').evaluateAll((trs) => trs
    .map((tr) => [...tr.cells].map((c) => c.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean)[0] || '')
    .filter((t) => t && !/^There are no deleted/i.test(t)));
  return rows.length ? rows.join(', ') : 'nothing';
}

/**
 * Open the trash: the listing of deleted content items
 * (`/admin/content/trash`), or the listing of deleted Canvas pages
 * (`/admin/content/trash/canvas_page`).
 *
 * Example #1: Given I am on the content trash
 * Example #2: Given I am on the Canvas pages trash
 * Example #3: And we are on the content trash page
 * Example #4: Given I am on the Canvas page trash
 * Example #5: And we are on the Canvas pages trash page
 *
 */
Given(/^(I am |we are )*on the (content|Canvas pages?) trash(?: page)?$/, async function (pronounCase, kind) {
  await openTrash(this, kind);
});

/**
 * Assert the trash holds, or does not hold, a deleted item by its title. The
 * step opens the listing itself, so it can follow a delete directly.
 *
 * Example #1: Then the content trash should hold "Old page"
 * Example #2: And the Canvas pages trash should hold "Landing"
 * Example #3: Then the content trash should not hold "Old page"
 * Example #4: And the Canvas pages trash should not hold "Landing"
 * Example #5: Then the Canvas page trash should hold "Pricing"
 *
 */
Then(/^the (content|Canvas pages?) trash should( not)* hold "([^"]*)"$/, async function (kind, notCase, title) {
  await openTrash(this, kind);
  const row = trashRows(this.page, title).first();
  try {
    await row.waitFor({ state: notCase ? 'detached' : 'visible', timeout: 10000 });
  } catch (error) {
    throw friendly({
      message: notCase
        ? `The ${/canvas/i.test(kind) ? 'Canvas pages' : 'content'} trash holds "${title}", which was not expected.`
        : `The ${/canvas/i.test(kind) ? 'Canvas pages' : 'content'} trash does not hold "${title}".`,
      cause: `the trash holds: ${await trashTitles(this.page)}`,
      hint: 'Use the title as the trash prints it, without the number in brackets.',
    });
  }
});

/**
 * Restore an item from the trash, or purge it (delete it for good, which
 * also frees its URL alias): the step opens the listing, follows the
 * "Restore" or "Purge" operation of the item's row, confirms, and waits for
 * the site's status message. When several deleted items share the title,
 * "purge" removes every one of them and "restore" brings back the most
 * recently deleted.
 *
 * Example #1: When I purge "Old page" from the content trash
 * Example #2: And I purge "Landing" from the Canvas pages trash
 * Example #3: When I restore "Old page" from the content trash
 * Example #4: And we restore "Landing" from the Canvas pages trash
 * Example #5: When we purge "Pricing" from the Canvas page trash
 *
 */
When(/^(I |we )*(restore|purge) "([^"]*)" from the (content|Canvas pages?) trash$/, { timeout: 180000 }, async function (pronounCase, action, title, kind) {
  const operation = action === 'purge' ? 'Purge' : 'Restore';
  await openTrash(this, kind);
  if (!(await trashRows(this.page, title).count())) {
    throw friendly({
      message: `The ${/canvas/i.test(kind) ? 'Canvas pages' : 'content'} trash does not hold "${title}", so there is nothing to ${action}.`,
      cause: `the trash holds: ${await trashTitles(this.page)}`,
    });
  }
  let done = 0;
  // A purge repeats while a row with the title is left; a restore runs once.
  while ((await trashRows(this.page, title).count()) && (action === 'purge' || done === 0) && done < 20) {
    const row = trashRows(this.page, title).first();
    const link = row.locator('a').filter({ hasText: new RegExp(`^\\s*${operation}\\s*$`) }).first();
    const href = await link.getAttribute('href', { timeout: 10000 }).catch(() => null);
    if (!href) {
      throw friendly({
        message: `The trash offers no "${operation}" operation for "${title}".`,
        cause: `the row reads "${((await row.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim()}"`,
      });
    }
    await navigate(this, href);
    const confirm = this.page.locator('form.confirmation #edit-submit, form.confirmation [data-drupal-selector="edit-submit"], [data-drupal-selector="gin-sticky-edit-submit"]').first();
    try {
      await confirm.waitFor({ state: 'attached', timeout: WAIT_TIMEOUT });
      await Promise.all([
        this.page.waitForURL((url) => !/\/(purge|restore)(\?|$)/.test(url.pathname + url.search), { timeout: WAIT_TIMEOUT }),
        robustClick(confirm),
      ]);
    } catch (error) {
      throw friendly({
        message: `Could not confirm the ${action} of "${title}".`,
        cause: error,
      });
    }
    await waitForPageLoad(this.page, budget(this));
    done++;
    await openTrash(this, kind);
  }
});

module.exports = { trashPath, trashRows };
