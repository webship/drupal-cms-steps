'use strict';

// Drupal Canvas: patterns, templates and media.
//
// A pattern is a component (with what it holds) saved to the Library under a
// name, to be inserted again on any page. A template is what Canvas renders
// around or instead of a page: a content template for the items of a content
// type, a page template for the regions of the theme. Media reaches a
// component through Drupal's media library, which Canvas opens from the
// component's settings form ("Add media"), the same dialog a content form
// uses.

const path = require('path');
const fs = require('fs');
const { When, Then } = require('@cucumber/cucumber');
const assert = require('assert');
const { smartSettle, friendly } = require('webship-js/tests/step-definitions/webship');
const { budget } = require('@webship-js/drupal-core-steps/tests/step-definitions/drupal-helpers');
const { canvasRequest, openLibrary } = require('./drupal-canvas.steps');
const { openPanel, layerRow, chooseMenuEntry, requireEditor, exactText } = require('./drupal-canvas-pages.steps');

const MEDIA_DIALOG = '.ui-dialog.media-library-widget-modal';

/**
 * The patterns of the Canvas Library, as the authoring API lists them.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<Array<{id: string, name: string}>>}
 */
async function listPatterns(page) {
  const result = await canvasRequest(page, '/canvas/api/v0/config/pattern');
  if (!result.ok) {
    throw friendly({
      message: 'Could not read the Canvas patterns.',
      cause: `the pattern API answered ${result.status}`,
      hint: 'Log in first as a user who may edit Canvas pages.',
    });
  }
  const data = result.data;
  const entries = Array.isArray(data) ? data.map((p) => [p.id, p]) : Object.entries(data || {});
  return entries.map(([id, p]) => ({ id, name: (p && p.name) || id }));
}

/**
 * The media fieldset of the selected component's settings form, by the label
 * of the option ("Image").
 *
 * @param {import('playwright').Page} page
 * @param {string} label
 * @returns {Promise<import('playwright').Locator>}
 */
async function mediaFieldset(page, label) {
  await requireEditor(page);
  const form = page.locator('[data-testid^="canvas-component-form-"]').first();
  const fieldset = form.locator('fieldset[data-canvas-media-library-fieldset="true"]')
    .filter({ has: page.locator('legend').filter({ hasText: exactText(label) }) }).first();
  try {
    await fieldset.waitFor({ state: 'visible', timeout: 20000 });
  } catch (error) {
    const legends = await form.locator('fieldset[data-canvas-media-library-fieldset="true"] legend').allInnerTexts().catch(() => []);
    throw friendly({
      message: `The selected Canvas component has no media option labelled "${label}".`,
      cause: `media options seen: ${legends.map((s) => s.trim()).join(', ') || 'none'}`,
      hint: 'Select a component that takes media first ("I select the \\"Image\\" component in the Canvas Layers").',
    });
  }
  return fieldset;
}

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

/**
 * Save a component of the page as a pattern, the way a site builder does:
 * the component's contextual menu in the Layers panel, "Create pattern", a
 * name, "Add to library". The step waits until the Library has the pattern.
 *
 * Example #1: When I save the "Heading" component as the Canvas pattern "Page heading"
 * Example #2: And I save the "Hero CTA" component as the Canvas pattern "Campaign hero"
 * Example #3: When we save the "Section" component as the Canvas pattern "Two columns"
 * Example #4: And we save the "Image" component as the Canvas pattern "Wide image"
 * Example #5: Given I save the "Group" component as the Canvas pattern "Team card"
 *
 */
When(/^(I |we )*save the "([^"]*)" component as the Canvas pattern "([^"]*)"$/, { timeout: 90000 }, async function (pronounCase, component, name) {
  const row = await layerRow(this.page, component);
  await row.click({ button: 'right' });
  await chooseMenuEntry(this.page, 'Create pattern');
  const dialog = this.page.locator('[role="dialog"]').filter({ has: this.page.locator('#patternName') }).first();
  try {
    await dialog.waitFor({ state: 'visible', timeout: 15000 });
    await dialog.locator('#patternName').fill(name);
    await dialog.getByRole('button', { name: 'Add to library' }).click();
    await dialog.waitFor({ state: 'hidden', timeout: 30000 });
  } catch (error) {
    throw friendly({
      message: `Could not save the "${component}" component as the pattern "${name}".`,
      cause: error,
    });
  }
  const deadline = Date.now() + 20000;
  let found = false;
  while (!found && Date.now() < deadline) {
    found = (await listPatterns(this.page)).some((p) => p.name === name);
    if (!found) await smartSettle(this.page, 500);
  }
  assert.ok(found, friendly({
    message: `The Canvas Library did not get the pattern "${name}".`,
    hint: 'The dialog closed, but the pattern API does not list the pattern.',
  }).message);
  await smartSettle(this.page, budget(this));
});

/**
 * Assert the Canvas Library holds, or does not hold, a pattern by its name,
 * through the authoring API the editor fills its Patterns tab from, so no
 * page has to be open in the editor.
 *
 * Example #1: Then the Canvas pattern library should list the "Page heading" pattern
 * Example #2: And the Canvas pattern library should list the "Campaign hero" pattern
 * Example #3: Then the Canvas pattern library should not list the "Old banner" pattern
 * Example #4: And the Canvas pattern library should not list the "Page heading" pattern
 * Example #5: Then the Canvas pattern library should list the "Two columns" pattern
 *
 */
Then(/^the Canvas pattern library should( not)* list the "([^"]*)" pattern$/, async function (notCase, name) {
  const patterns = await listPatterns(this.page);
  const found = patterns.some((p) => p.name === name);
  assert.ok(notCase ? !found : found, friendly({
    message: notCase
      ? `The Canvas pattern library lists the "${name}" pattern, which was not expected.`
      : `The Canvas pattern library does not list the "${name}" pattern.`,
    cause: `patterns: ${patterns.map((p) => p.name).join(', ') || 'none'}`,
  }).message);
});

/**
 * Delete a pattern from the Canvas Library through its contextual menu in
 * the Patterns tab ("Delete pattern"), and wait until the Library no longer
 * has it. Pages that already hold a copy of the pattern keep it.
 *
 * Example #1: When I delete the "Page heading" Canvas pattern
 * Example #2: And I delete the "Campaign hero" Canvas pattern
 * Example #3: When we delete the "Two columns" Canvas pattern
 * Example #4: And we delete the "Wide image" Canvas pattern
 * Example #5: Then I delete the "Team card" Canvas pattern
 *
 */
When(/^(I |we )*delete the "([^"]*)" Canvas pattern$/, { timeout: 90000 }, async function (pronounCase, name) {
  await requireEditor(this.page);
  try {
    await openLibrary(this.page);
    await this.page.getByTestId('canvas-library-patterns-tab-select').click();
    const tab = this.page.getByTestId('canvas-library-patterns-tab-content');
    await tab.waitFor({ state: 'visible', timeout: 20000 });
    const row = tab.locator(`[data-canvas-type="pattern"][data-canvas-name="${name.replace(/"/g, '\\"')}"]`).first();
    await row.waitFor({ state: 'visible', timeout: 15000 });
    await row.click({ button: 'right' });
  } catch (error) {
    const patterns = await listPatterns(this.page).catch(() => []);
    throw friendly({
      message: `The Canvas Library shows no "${name}" pattern to delete.`,
      cause: `patterns: ${patterns.map((p) => p.name).join(', ') || 'none'}`,
    });
  }
  await chooseMenuEntry(this.page, 'Delete pattern');
  // The editor asks "Are you sure you want to delete ...?" in a dialog.
  const confirm = this.page.locator('[role="dialog"], [role="alertdialog"]')
    .filter({ hasText: 'Delete pattern' })
    .locator('button').filter({ hasText: /^Delete$/ }).first();
  try {
    await confirm.waitFor({ state: 'visible', timeout: 15000 });
    await confirm.click();
  } catch (error) {
    throw friendly({ message: `Could not confirm the deletion of the "${name}" pattern.`, cause: error });
  }
  const deadline = Date.now() + 20000;
  let left = true;
  while (left && Date.now() < deadline) {
    left = (await listPatterns(this.page)).some((p) => p.name === name);
    if (left) await smartSettle(this.page, 500);
  }
  assert.ok(!left, friendly({ message: `The "${name}" pattern is still in the Canvas Library after the delete.` }).message);
  await smartSettle(this.page, budget(this));
});

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

/**
 * Open a template from the Templates panel of the editor, by the name the
 * panel shows: a content template ("Full content template", under its
 * content type) or a page template ("Mercury theme"). The editor then shows
 * the template instead of a page, with the template's name in the top bar.
 *
 * Example #1: When I open the "Full content template" template in the Canvas editor
 * Example #2: And I open the "Mercury theme" template in the Canvas editor
 * Example #3: When we open the "Full content template" template in the Canvas editor
 * Example #4: And we open the "Teaser template" template in the Canvas editor
 * Example #5: Given I open the "Full content template" template in the Canvas editor
 *
 */
When(/^(I |we )*open the "([^"]*)" template in the Canvas editor$/, { timeout: 120000 }, async function (pronounCase, name) {
  const panel = await openPanel(this.page, 'Templates');
  const link = panel.locator('a').filter({ hasText: exactText(name) }).first();
  try {
    await link.waitFor({ state: 'visible', timeout: 15000 });
  } catch (error) {
    const seen = await panel.locator('a').allInnerTexts().catch(() => []);
    throw friendly({
      message: `The Templates panel of the Canvas editor lists no "${name}" template.`,
      cause: `templates seen: ${seen.map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean).join(', ') || 'none'}`,
    });
  }
  const href = await link.getAttribute('href');
  await link.click();
  try {
    await this.page.waitForURL((url) => url.pathname.replace(/\/$/, '') === String(href).replace(/\/$/, ''), { timeout: 30000 });
    await this.page.getByTestId('canvas-navigation-button').waitFor({ state: 'visible', timeout: 60000 });
  } catch (error) {
    throw friendly({
      message: `The Canvas editor did not open the "${name}" template.`,
      cause: error,
    });
  }
  await smartSettle(this.page, budget(this));
});

/**
 * Assert what the editor is working on, as its top bar names it: a page by
 * its title ("Home"), or a template ("Utility page - Full content
 * template").
 *
 * Example #1: Then the Canvas editor should be editing "Utility page - Full content template"
 * Example #2: And the Canvas editor should be editing "Home"
 * Example #3: Then the Canvas editor should not be editing "Home"
 * Example #4: And the Canvas editor should be editing "Landing"
 * Example #5: Then the Canvas editor should not be editing "Untitled page"
 *
 */
Then(/^the Canvas editor should( not)* be editing "([^"]*)"$/, { timeout: 60000 }, async function (notCase, name) {
  await requireEditor(this.page);
  const title = this.page.getByTestId('canvas-navigation-button');
  try {
    await title.filter({ hasText: exactText(name) }).waitFor({ state: notCase ? 'detached' : 'visible', timeout: 20000 });
  } catch (error) {
    const shown = ((await title.innerText({ timeout: 1000 }).catch(() => '')) || '').replace(/\s+/g, ' ').trim();
    throw friendly({
      message: notCase
        ? `The Canvas editor is editing "${name}", which was not expected.`
        : `The Canvas editor is not editing "${name}".`,
      cause: `the top bar names "${shown}"`,
    });
  }
});

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

/**
 * Open Drupal's media library from a media option of the component selected
 * in the editor (the "Add media" button under the option's label), and wait
 * for the dialog. Continue with "I upload ... to the media library ..." or
 * the core pack's "I select the media ..." and "I insert the selected media".
 *
 * Example #1: When I open the media library of the Canvas component option "Image"
 * Example #2: And I open the media library of the Canvas component option "Image"
 * Example #3: When we open the media library of the Canvas component option "Video"
 * Example #4: And we open the media library of the Canvas component option "Logo"
 * Example #5: Given I open the media library of the Canvas component option "Background image"
 *
 */
When(/^(I |we )*open the media library of the Canvas component option "([^"]*)"$/, { timeout: 60000 }, async function (pronounCase, label) {
  const fieldset = await mediaFieldset(this.page, label);
  await fieldset.locator('[data-canvas-media-library-open-button="true"]').first().click();
  try {
    await this.page.locator(MEDIA_DIALOG).first().waitFor({ state: 'visible', timeout: 30000 });
  } catch (error) {
    throw friendly({
      message: `The media library did not open for the Canvas component option "${label}".`,
      cause: error,
    });
  }
  await smartSettle(this.page, budget(this));
});

/**
 * Upload a file in the open media library dialog and save it as a media
 * item with its alternative text (required for images): "Add file", the
 * alternative text, "Save". The new item comes back selected in the library,
 * ready for the core pack's "I insert the selected media". The path is
 * relative to the project root. Works in the dialog a content form opens
 * and in the one Canvas opens.
 *
 * Example #1: When I upload "tests/fixtures/sample.png" to the media library with the alternative text "A blue sample image"
 * Example #2: And I upload "tests/fixtures/team.jpg" to the media library with the alternative text "The team in the office"
 * Example #3: When we upload "tests/fixtures/logo.png" to the media library with the alternative text "Company logo"
 * Example #4: And we upload "fixtures/banner.webp" to the media library with the alternative text "Spring campaign banner"
 * Example #5: Given I upload "tests/fixtures/sample.png" to the media library with the alternative text "Sample"
 *
 */
When(/^(I |we )*upload "([^"]*)" to the media library with the alternative text "([^"]*)"$/, { timeout: 120000 }, async function (pronounCase, file, alt) {
  const absolute = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
  if (!fs.existsSync(absolute)) {
    throw friendly({
      message: `The file "${file}" does not exist.`,
      cause: `looked for ${absolute}`,
      hint: 'Give the path relative to the project root, where cucumber-js runs.',
    });
  }
  const dialog = this.page.locator(MEDIA_DIALOG).first();
  try {
    await dialog.waitFor({ state: 'visible', timeout: 15000 });
  } catch (error) {
    throw friendly({
      message: 'The media library dialog is not open.',
      hint: 'Open it first: "I open the media library of the Canvas component option \\"Image\\"" or the core pack\'s "I open the \\"...\\" media library".',
    });
  }
  const name = path.basename(absolute);
  try {
    await dialog.locator('input[type="file"]').first().setInputFiles(absolute);
    const altField = dialog.locator('input[name$="[alt]"]').first();
    await altField.waitFor({ state: 'visible', timeout: 60000 });
    await altField.fill(alt);
    await dialog.locator('.ui-dialog-buttonpane button').filter({ hasText: /^\s*Save\s*$/ }).first().click();
    await dialog.locator('.media-library-item').filter({ hasText: name }).first().waitFor({ state: 'visible', timeout: 60000 });
  } catch (error) {
    const text = ((await dialog.innerText({ timeout: 1000 }).catch(() => '')) || '').replace(/\s+/g, ' ').trim();
    throw friendly({
      message: `Could not upload "${file}" to the media library.`,
      cause: error,
      hint: `The dialog reads: "${text.slice(0, 300)}"`,
    });
  }
  await smartSettle(this.page, budget(this));
});

/**
 * Assert a media option of the component selected in the editor holds, or
 * does not hold, a media item by its name, as the settings form shows it
 * after "Insert selected".
 *
 * Example #1: Then the Canvas component option "Image" should hold the media "sample.png"
 * Example #2: And the Canvas component option "Image" should hold the media "Team photo"
 * Example #3: Then the Canvas component option "Image" should not hold the media "old.png"
 * Example #4: And the Canvas component option "Logo" should hold the media "logo.svg"
 * Example #5: Then the Canvas component option "Video" should not hold the media "intro.mp4"
 *
 */
Then(/^the Canvas component option "([^"]*)" should( not)* hold the media "([^"]*)"$/, { timeout: 60000 }, async function (label, notCase, name) {
  const fieldset = await mediaFieldset(this.page, label);
  const item = fieldset.locator('[data-canvas-media-library-selection="true"] article').filter({ hasText: name }).first();
  try {
    await item.waitFor({ state: notCase ? 'detached' : 'visible', timeout: 30000 });
  } catch (error) {
    const text = ((await fieldset.locator('[data-canvas-media-library-selection="true"]').innerText({ timeout: 1000 }).catch(() => '')) || '').replace(/\s+/g, ' ').trim();
    throw friendly({
      message: notCase
        ? `The Canvas component option "${label}" holds the media "${name}", which was not expected.`
        : `The Canvas component option "${label}" does not hold the media "${name}".`,
      cause: `the option shows: "${text || 'no media'}"`,
    });
  }
});

module.exports = { listPatterns };
