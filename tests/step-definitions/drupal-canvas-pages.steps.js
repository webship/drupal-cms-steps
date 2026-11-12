'use strict';

// Drupal Canvas: the life of a page in the editor.
//
// The steps here drive what an editor does with a Canvas page after the
// "Add Page" button of the Pages listing: name the page and give it a URL
// alias in the "Page data" form, read the Draft or Published badge and the
// pending changes of the top bar, work with the panels of the side menu
// (Library, Layers, Code, Pages, Templates, Brand kit), read the preview,
// remove a component or a page, and meet a publish that Canvas refuses.
//
// Inserting a component, setting its options and publishing live in
// ./drupal-canvas.steps.js; patterns and media in ./drupal-canvas-library.steps.js.

const { When, Then } = require('@cucumber/cucumber');
const assert = require('assert');
const { smartSettle, friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  navigate,
  robustClick,
} = require('@webship-js/drupal-core-steps/tests/step-definitions/drupal-helpers');
const { canvasRequest } = require('./drupal-canvas.steps');

const EDITOR_READY_TIMEOUT = 90000;
const PANELS = ['Library', 'Layers', 'Code', 'Pages', 'Templates', 'Brand kit'];

/**
 * Escape a text for use inside a regular expression.
 *
 * @param {string} text
 * @returns {string}
 */
function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A pattern that matches an element whose whole text is the given label.
 *
 * @param {string} label
 * @returns {RegExp}
 */
function exactText(label) {
  return new RegExp(`^\\s*${escapeRegex(label.trim()).replace(/\s+/g, '\\s+')}\\s*$`);
}

/**
 * Fail with a hint when the page is not the Canvas editor.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<void>}
 */
async function requireEditor(page) {
  try {
    await page.getByTestId('canvas-side-menu').waitFor({ state: 'visible', timeout: 20000 });
  } catch (error) {
    throw friendly({
      message: 'The Canvas editor is not open.',
      cause: `the browser is on ${page.url()}`,
      hint: 'Open a page first: "I open the \\"Home\\" Canvas page in the editor" or "I add a Canvas page from the Pages listing".',
    });
  }
}

/**
 * Open a panel of the editor's side menu, unless it is already the open one.
 * The side menu buttons toggle, so an open panel is never clicked shut.
 *
 * @param {import('playwright').Page} page
 * @param {string} name - One of PANELS.
 * @returns {Promise<import('playwright').Locator>} The primary panel.
 */
async function openPanel(page, name) {
  await requireEditor(page);
  const panel = page.getByTestId('canvas-primary-panel');
  const heading = panel.locator('h4').filter({ hasText: exactText(name) }).first();
  if (!(await heading.isVisible().catch(() => false))) {
    await page.getByTestId('canvas-side-menu').locator(`button[aria-label="${name}"]`).first().click();
    try {
      await heading.waitFor({ state: 'visible', timeout: 20000 });
    } catch (error) {
      throw friendly({
        message: `The "${name}" panel of the Canvas editor did not open.`,
        cause: error,
        hint: `The side menu of the editor offers: ${PANELS.join(', ')}.`,
      });
    }
  }
  return panel;
}

/**
 * The row of a component in the Layers panel, by its visible name. Layers
 * nest, so the row is found through its own name element, never through a
 * parent that contains it.
 *
 * @param {import('playwright').Page} page
 * @param {string} label
 * @returns {Promise<import('playwright').Locator>}
 */
async function layerRow(page, label) {
  const panel = await openPanel(page, 'Layers');
  const name = panel.locator('[id^="layer-"][id$="-name"]').filter({ hasText: exactText(label) }).first();
  try {
    await name.waitFor({ state: 'visible', timeout: 15000 });
  } catch (error) {
    const seen = await panel.locator('[id^="layer-"][id$="-name"]').allInnerTexts().catch(() => []);
    throw friendly({
      message: `The Canvas Layers panel lists no "${label}" component.`,
      cause: `layers seen: ${seen.map((s) => s.trim()).filter(Boolean).join(', ') || 'none'}`,
      hint: 'Use the name the Layers panel shows for the component.',
    });
  }
  return name;
}

/**
 * Choose an entry of the contextual menu the editor opened.
 *
 * @param {import('playwright').Page} page
 * @param {string} entry - The start of the entry's text ("Delete", "Create pattern").
 * @returns {Promise<void>}
 */
async function chooseMenuEntry(page, entry) {
  const item = page.getByRole('menuitem', { name: new RegExp(`^${escapeRegex(entry)}`) }).first();
  try {
    await item.waitFor({ state: 'visible', timeout: 10000 });
  } catch (error) {
    const offered = await page.getByRole('menuitem').allInnerTexts().catch(() => []);
    throw friendly({
      message: `The contextual menu offers no "${entry}" entry.`,
      cause: `entries offered: ${offered.map((s) => s.trim()).join(', ') || 'none'}`,
    });
  }
  await item.click();
}

/**
 * The text of the top bar's review button: "No changes" or "Review N changes".
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<string>}
 */
async function reviewText(page) {
  return ((await page.getByTestId('canvas-publish-review').innerText({ timeout: 20000 })) || '').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// A new page
// ---------------------------------------------------------------------------

/**
 * Add a Canvas page the way an editor does: the "Add Page" button of the
 * Pages listing (`/admin/content/pages`), which creates an unpublished
 * "Untitled page" and opens it in the editor. Name it and give it a URL alias
 * with "I set the Canvas page ... to ...", then publish. Needs a logged in
 * user who may create Canvas pages.
 *
 * Example #1: When I add a Canvas page from the Pages listing
 * Example #2: And I add a Canvas page from the Pages listing
 * Example #3: When we add a Canvas page from the Pages listing
 * Example #4: Given I add a new Canvas page from the Pages listing
 * Example #5: And we add a new Canvas page from the Pages listing
 *
 */
When(/^(I |we )*add a (?:new )?Canvas page from the Pages listing$/, { timeout: 180000 }, async function (pronounCase) {
  await navigate(this, '/admin/content/pages');
  const add = this.page.locator('a[data-drupal-link-system-path="admin/content/pages/add"], .local-actions__item a[href*="/admin/content/pages/add"]').first();
  try {
    await add.waitFor({ state: 'visible', timeout: 20000 });
  } catch (error) {
    throw friendly({
      message: 'The Pages listing shows no "Add Page" button.',
      cause: `the browser is on ${this.page.url()}`,
      hint: 'Log in first as a user who may create Canvas pages; the canvas module must be installed.',
    });
  }
  await add.click();
  try {
    await this.page.waitForURL(/\/canvas\/editor\/canvas_page\/\d+/, { timeout: EDITOR_READY_TIMEOUT });
    await this.page.getByRole('button', { name: 'Library' }).first().waitFor({ state: 'visible', timeout: EDITOR_READY_TIMEOUT });
    await this.page.getByTestId('canvas-page-data-form').locator('[name="title[0][value]"]').waitFor({ state: 'visible', timeout: 30000 });
  } catch (error) {
    throw friendly({
      message: 'The Canvas editor did not open on the new page.',
      cause: error,
    });
  }
  await smartSettle(this.page, budget(this));
});

/**
 * Set a field of the page in the editor's "Page data" form, by its label:
 * "Title", "URL alias", "Meta description", "Page title" (the SEO title).
 * The editor saves the value as a pending change when the field loses focus,
 * which the step waits for. Where two fields share a label ("Title" is also
 * an Open Graph field) the first one, the page's own, is used.
 *
 * Example #1: When I set the Canvas page "Title" to "Landing"
 * Example #2: And I set the Canvas page "URL alias" to "/landing"
 * Example #3: When we set the Canvas page "Meta description" to "What the page is about."
 * Example #4: And I set the Canvas page "Title" to "About us"
 * Example #5: And we set the Canvas page "URL alias" to "/about-us"
 *
 */
When(/^(I |we )*set the Canvas page "([^"]*)" to "([^"]*)"$/, { timeout: 90000 }, async function (pronounCase, label, value) {
  await requireEditor(this.page);
  const tab = this.page.getByTestId('canvas-contextual-panel--page-data');
  if ((await tab.getAttribute('aria-selected').catch(() => 'true')) === 'false') await tab.click();
  const form = this.page.getByTestId('canvas-page-data-form');
  const handle = await form.evaluateHandle((root, wanted) => {
    const fields = [...root.querySelectorAll('input:not([type="hidden"]):not([type="submit"]), textarea, select')];
    return fields.find((el) => el.labels && [...el.labels].some((l) => l.textContent.trim().replace(/\s+/g, ' ') === wanted)) || null;
  }, label).catch(() => null);
  const field = handle && handle.asElement();
  if (!field) {
    const labels = await form.locator('label').allInnerTexts().catch(() => []);
    throw friendly({
      message: `The "Page data" form of the Canvas editor has no "${label}" field.`,
      cause: `fields seen: ${[...new Set(labels.map((s) => s.trim()).filter(Boolean))].slice(0, 12).join(', ') || 'none'}`,
      hint: 'The form opens when no component is selected; its first fields are "Title", "URL alias" and "Meta description".',
    });
  }
  const name = await field.getAttribute('name');
  const pageId = (this.page.url().match(/canvas_page\/(\d+)/) || [])[1];
  await field.fill(value);
  await field.press('Tab');
  // The proof that the editor took the value is its auto-save: the pending
  // version of the page, read back through the authoring API, holds it.
  let saved = null;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const result = pageId ? await canvasRequest(this.page, `/canvas/api/v0/layout/canvas_page/${pageId}`) : { ok: false };
    saved = result.ok && result.data && result.data.entity_form_fields ? result.data.entity_form_fields[name] : null;
    if (saved === value) break;
    await smartSettle(this.page, 500);
  }
  if (saved !== value) {
    throw friendly({
      message: `The Canvas editor did not save "${value}" in the "${label}" field as a pending change.`,
      cause: saved === null ? 'the pending version of the page could not be read' : `the pending version of the page holds "${saved}"`,
    });
  }
  await smartSettle(this.page, budget(this));
});

// ---------------------------------------------------------------------------
// The top bar: status and pending changes
// ---------------------------------------------------------------------------

/**
 * Assert the status badge the editor's top bar shows next to the page title:
 * "Draft" for a page that was never published or was unpublished, and
 * "Published" once it is live.
 *
 * Example #1: Then the Canvas editor should show the page as "Draft"
 * Example #2: And the Canvas editor should show the page as "Published"
 * Example #3: Then the Canvas editor should not show the page as "Published"
 * Example #4: And the Canvas editor should not show the page as "Draft"
 * Example #5: Then the Canvas editor should show the page as "Changed"
 *
 */
Then(/^the Canvas editor should( not)* show the page as "([^"]*)"$/, { timeout: 60000 }, async function (notCase, status) {
  await requireEditor(this.page);
  const badge = this.page.getByTestId('canvas-topbar').locator('span').filter({ hasText: exactText(status) }).first();
  try {
    await badge.waitFor({ state: notCase ? 'hidden' : 'visible', timeout: 20000 });
  } catch (error) {
    const bar = ((await this.page.getByTestId('canvas-topbar').innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
    throw friendly({
      message: notCase
        ? `The Canvas editor shows the page as "${status}", which was not expected.`
        : `The Canvas editor does not show the page as "${status}".`,
      cause: `the top bar reads "${bar}"`,
    });
  }
});

/**
 * Assert how many pending changes the editor's top bar reports: "No changes"
 * for none, "Review N changes" otherwise. The count is site-wide, as the
 * review list is.
 *
 * Example #1: Then the Canvas editor should have no pending changes
 * Example #2: And the Canvas editor should have 1 pending change
 * Example #3: Then the Canvas editor should have 2 pending changes
 * Example #4: And the Canvas editor should have at least 1 pending change
 * Example #5: Then the Canvas editor should have at least 2 pending changes
 *
 */
Then(/^the Canvas editor should have (no|at least \d+|\d+) pending changes?$/, { timeout: 60000 }, async function (expected) {
  await requireEditor(this.page);
  const want = expected === 'no' ? 0 : parseInt(expected.replace(/\D+/g, ''), 10);
  const atLeast = /^at least/.test(expected);
  const read = (text) => (/no changes/i.test(text) ? 0 : parseInt((text.match(/(\d+)/) || [0, '0'])[1], 10));
  let text = '';
  const deadline = Date.now() + 20000;
  let ok = false;
  while (!ok && Date.now() < deadline) {
    text = await reviewText(this.page);
    const count = read(text);
    ok = atLeast ? count >= want : count === want;
    if (!ok) await smartSettle(this.page, 500);
  }
  assert.ok(ok, friendly({
    message: `Expected the Canvas editor to have ${expected} pending change(s).`,
    cause: `the review button reads "${text}"`,
  }).message);
});

/**
 * Publish through the editor's Review widget and expect Canvas to refuse:
 * the widget stays open and names the reason, which the step reads. The
 * case a tester meets first is a URL alias that a page in the trash still
 * holds ("The alias /landing is already in use in this language.").
 *
 * Example #1: Then publishing the Canvas page changes through the editor should fail with "is already in use"
 * Example #2: And publishing the Canvas page changes through the editor should fail with "The alias /landing is already in use in this language."
 * Example #3: Then publishing the Canvas changes through the editor should fail with "already in use"
 * Example #4: And publishing the Canvas changes through the editor should fail with "1 Error"
 * Example #5: Then publishing the Canvas page changes through the editor should fail with "alias"
 *
 */
Then(/^publishing the Canvas (?:page )?changes through the editor should fail with "([^"]*)"$/, { timeout: 120000 }, async function (message) {
  await requireEditor(this.page);
  const review = this.page.getByTestId('canvas-publish-review');
  const content = this.page.getByTestId('canvas-publish-reviews-content');
  try {
    await this.page.waitForFunction(() => {
      const button = document.querySelector('[data-testid="canvas-publish-review"]');
      return Boolean(button && !/no changes/i.test(button.textContent));
    }, null, { timeout: 30000 });
    if (!(await content.isVisible().catch(() => false))) await review.click();
    const selectAll = this.page.getByTestId('canvas-publish-review-select-all');
    await selectAll.waitFor({ state: 'visible', timeout: 15000 });
    if ((await selectAll.getAttribute('aria-checked')) !== 'true') await selectAll.click();
    await this.page.getByRole('button', { name: /Publish \d+ selected/i }).first().click();
  } catch (error) {
    const text = await reviewText(this.page).catch(() => '');
    throw friendly({
      message: 'Could not start publishing the Canvas page changes through the editor.',
      cause: /no changes/i.test(text) ? 'there are no pending changes: the review button reads "No changes"' : error,
      hint: 'Open a page in the editor and make at least one change first.',
    });
  }
  try {
    await content.filter({ hasText: message }).waitFor({ state: 'visible', timeout: 30000 });
  } catch (error) {
    const text = ((await content.innerText({ timeout: 1000 }).catch(() => '')) || '').replace(/\s+/g, ' ').trim();
    throw friendly({
      message: `Publishing did not fail with "${message}".`,
      cause: text ? `the review widget reads "${text}"` : `the review widget closed and the button reads "${await reviewText(this.page).catch(() => '')}"`,
      hint: 'When the publish succeeds the widget closes and the button reads "No changes".',
    });
  }
  await this.page.keyboard.press('Escape');
});

/**
 * Discard every pending Canvas change (the auto-saves of the editor and of
 * the API steps) through the authoring API, which is what "Discard changes"
 * in the Review widget does for one item. Use it to leave the site as it was
 * after a scenario that changed a page without publishing.
 *
 * Example #1: When I discard the pending Canvas changes
 * Example #2: And I discard the pending Canvas changes
 * Example #3: When we discard the pending Canvas changes
 * Example #4: And we discard the Canvas changes
 * Example #5: Then I discard the Canvas changes
 *
 */
When(/^(I |we )*discard the (?:pending )?Canvas changes$/, async function (pronounCase) {
  const pending = await canvasRequest(this.page, '/canvas/api/v0/auto-saves/pending');
  if (!pending.ok) {
    throw friendly({
      message: 'Could not read the pending Canvas changes.',
      cause: `the auto-save API answered ${pending.status}`,
      hint: 'Log in first as a user who may edit Canvas pages.',
    });
  }
  const items = pending.data && pending.data.data && !Array.isArray(pending.data.data) ? Object.values(pending.data.data) : [];
  for (const item of items) {
    const result = await canvasRequest(this.page, `/canvas/api/v0/auto-saves/${item.entity_type}/${item.entity_id}`, { method: 'DELETE' });
    if (!result.ok) {
      throw friendly({
        message: `Could not discard the pending change of "${item.label}".`,
        cause: `the auto-save API answered ${result.status}`,
      });
    }
  }
  if (/\/canvas\/editor\//.test(this.page.url())) {
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await this.page.getByRole('button', { name: 'Library' }).first().waitFor({ state: 'visible', timeout: EDITOR_READY_TIMEOUT });
  }
  await smartSettle(this.page, budget(this));
});

// ---------------------------------------------------------------------------
// Panels of the side menu
// ---------------------------------------------------------------------------

/**
 * Open a panel of the editor's side menu: Library, Layers, Code, Pages,
 * Templates or Brand kit. A panel that is already open stays open.
 *
 * Example #1: When I open the "Layers" panel in the Canvas editor
 * Example #2: And I open the "Pages" panel in the Canvas editor
 * Example #3: When we open the "Templates" panel in the Canvas editor
 * Example #4: And I open the "Brand kit" panel in the Canvas editor
 * Example #5: When I open the "Code" panel in the Canvas editor
 *
 */
When(/^(I |we )*open the "(Library|Layers|Code|Pages|Templates|Brand kit)" panel in the Canvas editor$/, { timeout: 60000 }, async function (pronounCase, name) {
  await openPanel(this.page, name);
  await smartSettle(this.page, budget(this));
});

/**
 * Assert the open panel of the editor lists, or does not list, an entry by
 * its visible text: a page in "Pages" ("Home"), a template in "Templates"
 * ("Full content template", "Mercury theme"), a component in "Layers"
 * ("Heading"). The whole text of an entry is matched. The panel is opened
 * first when another one is showing.
 *
 * Example #1: Then the Canvas "Pages" panel should list "Home"
 * Example #2: And the Canvas "Templates" panel should list "Full content template"
 * Example #3: Then the Canvas "Layers" panel should list "Heading"
 * Example #4: And the Canvas "Layers" panel should not list "Image"
 * Example #5: Then the Canvas "Pages" panel should not list "Old landing"
 *
 */
Then(/^the Canvas "(Layers|Code|Pages|Templates|Brand kit)" panel should( not)* list "([^"]*)"$/, { timeout: 60000 }, async function (name, notCase, label) {
  const panel = await openPanel(this.page, name);
  // The Pages panel prints the path after the title ("Home /home"): match the start there.
  const pattern = name === 'Pages'
    ? new RegExp(`^\\s*${escapeRegex(label.trim())}(\\s+/\\S*)?\\s*$`)
    : exactText(label);
  const entry = panel.locator('span').filter({ hasText: pattern }).first();
  try {
    await entry.waitFor({ state: notCase ? 'detached' : 'visible', timeout: 15000 });
  } catch (error) {
    const text = ((await panel.innerText({ timeout: 1000 }).catch(() => '')) || '').split('\n').map((s) => s.trim()).filter(Boolean);
    throw friendly({
      message: notCase
        ? `The Canvas "${name}" panel should not list "${label}", but it does.`
        : `The Canvas "${name}" panel should list "${label}", but it does not.`,
      cause: `the panel reads: ${text.slice(0, 30).join(' | ')}`,
    });
  }
});

/**
 * Select a component of the page through the Layers panel, which opens its
 * settings form on the right, ready for "I set the Canvas component option
 * ...". Use the name the Layers panel shows.
 *
 * Example #1: When I select the "Heading" component in the Canvas Layers
 * Example #2: And I select the "Image" component in the Canvas Layers
 * Example #3: When we select the "Text" component in the Canvas Layers
 * Example #4: And we select the "Hero CTA" component in the Canvas Layers
 * Example #5: Given I select the "Button" component in the Canvas Layers
 *
 */
When(/^(I |we )*select the "([^"]*)" component in the Canvas Layers$/, { timeout: 60000 }, async function (pronounCase, label) {
  const row = await layerRow(this.page, label);
  await row.click();
  try {
    await this.page.waitForURL(/\/component\/[0-9a-f-]+/i, { timeout: 20000 });
    await this.page.locator('[data-testid^="canvas-component-form-"]').first().waitFor({ state: 'visible', timeout: 20000 });
  } catch (error) {
    throw friendly({
      message: `Selecting the "${label}" component did not open its settings form.`,
      cause: error,
    });
  }
  await smartSettle(this.page, budget(this));
});

/**
 * Delete, or duplicate, a component of the page through the contextual menu
 * of its row in the Layers panel, and wait until the panel shows the result.
 * The change is pending until it is published.
 *
 * Example #1: When I delete the "Heading" component in the Canvas Layers
 * Example #2: And I duplicate the "Heading" component in the Canvas Layers
 * Example #3: When we delete the "Image" component in the Canvas Layers
 * Example #4: And we duplicate the "Text" component in the Canvas Layers
 * Example #5: Then I delete the "Button" component in the Canvas Layers
 *
 */
When(/^(I |we )*(delete|duplicate) the "([^"]*)" component in the Canvas Layers$/, { timeout: 60000 }, async function (pronounCase, action, label) {
  const row = await layerRow(this.page, label);
  const names = this.page.getByTestId('canvas-primary-panel').locator('[id^="layer-"][id$="-name"]').filter({ hasText: exactText(label) });
  const before = await names.count();
  await row.click({ button: 'right' });
  await chooseMenuEntry(this.page, action === 'delete' ? 'Delete' : 'Duplicate');
  const want = action === 'delete' ? before - 1 : before + 1;
  try {
    await this.page.waitForFunction(({ wanted, text }) => {
      const rows = [...document.querySelectorAll('[data-testid="canvas-primary-panel"] [id^="layer-"][id$="-name"]')];
      return rows.filter((r) => r.textContent.trim() === text).length === wanted;
    }, { wanted: want, text: label.trim() }, { timeout: 20000 });
  } catch (error) {
    throw friendly({
      message: `The Canvas Layers panel did not show the "${label}" component ${action === 'delete' ? 'deleted' : 'duplicated'}.`,
      cause: error,
    });
  }
  await smartSettle(this.page, budget(this));
});

// ---------------------------------------------------------------------------
// The preview
// ---------------------------------------------------------------------------

/**
 * Assert the editor's preview shows, or does not show, a text: what the
 * page will look like with the pending changes, before anything is
 * published. The text is read inside the preview frame.
 *
 * Example #1: Then the Canvas preview should show "Welcome"
 * Example #2: And the Canvas preview should show "Your heading goes here"
 * Example #3: Then the Canvas preview should not show "Old heading"
 * Example #4: And the Canvas preview should not show "Lorem ipsum"
 * Example #5: Then the Canvas preview should show "Heading from the editor"
 *
 */
Then(/^the Canvas preview should( not)* show "([^"]*)"$/, { timeout: 60000 }, async function (notCase, text) {
  await requireEditor(this.page);
  const body = this.page.frameLocator('iframe[title="Preview"]').locator('body');
  try {
    await body.filter({ hasText: text }).waitFor({ state: notCase ? 'detached' : 'attached', timeout: 30000 });
  } catch (error) {
    const seen = ((await body.innerText({ timeout: 2000 }).catch(() => '')) || '').replace(/\s+/g, ' ').trim();
    throw friendly({
      message: notCase
        ? `The Canvas preview shows "${text}", which was not expected.`
        : `The Canvas preview does not show "${text}".`,
      cause: `the preview reads "${seen.slice(0, 400)}"`,
    });
  }
});

// ---------------------------------------------------------------------------
// The page list of the editor
// ---------------------------------------------------------------------------

/**
 * Delete a Canvas page the way an editor does: the "Pages" panel of the
 * editor, the page's contextual menu, "Delete page", then the confirmation.
 * The page leaves the list and its address answers 404. With the Trash
 * module (Drupal CMS ships it) the page is kept in the trash together with
 * its URL alias, until it is purged or restored.
 *
 * Example #1: When I delete the "Landing" page from the Canvas page list
 * Example #2: And I delete the "Pricing" page from the Canvas page list
 * Example #3: When we delete the "Team" page from the Canvas page list
 * Example #4: And we delete the "Events" page from the Canvas page list
 * Example #5: Then I delete the "Support" page from the Canvas page list
 *
 */
When(/^(I |we )*delete the "([^"]*)" page from the Canvas page list$/, { timeout: 90000 }, async function (pronounCase, title) {
  const panel = await openPanel(this.page, 'Pages');
  const pattern = new RegExp(`^\\s*${escapeRegex(title.trim())}(\\s+/\\S*)?\\s*$`);
  const item = panel.locator('[data-testid="canvas-page-list"] [data-canvas-page-id]').filter({ hasText: pattern }).first();
  try {
    await item.waitFor({ state: 'visible', timeout: 15000 });
  } catch (error) {
    const seen = await panel.locator('[data-testid="canvas-page-list"] [data-canvas-page-id]').allInnerTexts().catch(() => []);
    throw friendly({
      message: `The Canvas page list shows no "${title}" page.`,
      cause: `pages seen: ${seen.map((s) => s.replace(/\s+/g, ' ').trim()).join(', ') || 'none'}`,
    });
  }
  const pageId = await item.getAttribute('data-canvas-page-id');
  await item.hover();
  await item.locator('button[aria-label="Open contextual menu"]').click();
  await chooseMenuEntry(this.page, 'Delete page');
  const confirm = this.page.locator('[role="alertdialog"] button').filter({ hasText: /^Delete page$/ }).first();
  try {
    await confirm.waitFor({ state: 'visible', timeout: 10000 });
    await confirm.click();
    await panel.locator(`[data-testid="canvas-page-list"] [data-canvas-page-id="${pageId}"]`).waitFor({ state: 'detached', timeout: 30000 });
  } catch (error) {
    throw friendly({
      message: `Could not delete the "${title}" page from the Canvas page list.`,
      cause: error,
    });
  }
  await smartSettle(this.page, budget(this));
});

module.exports = { openPanel, layerRow, chooseMenuEntry, requireEditor, exactText, escapeRegex };
