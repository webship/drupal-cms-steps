'use strict';

// Drupal Canvas step definitions.
//
// Two kinds of step live here:
//   1. Editor steps that drive the Canvas React editor the way a site builder
//      does: open a page in the editor, browse the Library's Components and
//      Patterns tabs, insert an item, set an option in the component's
//      settings form, then publish through the editor's Review widget.
//   2. API steps that use Canvas's own authoring endpoints (the ones the
//      editor itself calls, under /canvas/api/v0/) to set up or read state
//      quickly: create a page, add a component to it, publish the pending
//      auto-saves, list the component library, delete a page.
//
// Every API call runs inside the page (fetch with the session cookies and the
// CSRF token from /session/token), so a login step must come first.

const { Given, When, Then } = require('@cucumber/cucumber');
// Ids are made here, not in the page: the browser's crypto.randomUUID exists only in a secure context,
// and the site under test may be served over plain http (as it is in CI).
const { randomUUID } = require('crypto');
const assert = require('assert');
const { gotoUrl, smartSettle, friendly } = require('webship-js/tests/step-definitions/webship');
const {
  supplied,
  budget,
  navigate,
  assertPresence,
} = require('@webship-js/drupal-core-steps/tests/step-definitions/drupal-helpers');

// Opening the editor is a heavy React application boot; every wait inside the
// step is drawn from this budget so the step reports what never became ready
// instead of dying as "function timed out".
const EDITOR_OPEN_TIMEOUT = 180000;
const EDITOR_OPEN_RESERVE = 10000;
const EDITOR_ATTEMPT = 60000;
const EDITOR_MIN_ATTEMPT = 20000;
const EDITOR_SETTLE = 2000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Run a Canvas API request inside the page, with the session cookies and the
 * CSRF token, and return `{ status, ok, data }` where `data` is the parsed
 * JSON (or the raw text when the body is not JSON).
 *
 * @param {import('playwright').Page} page
 * @param {string} path - Path under the site, e.g. `/canvas/api/v0/content/canvas_page`.
 * @param {{method?: string, body?: *}} [init]
 * @returns {Promise<{status: number, ok: boolean, data: *}>}
 */
async function canvasRequest(page, path, init = {}) {
  return page.evaluate(async ({ path, method, body }) => {
    const headers = { 'Content-Type': 'application/json' };
    if (method !== 'GET') {
      headers['X-CSRF-Token'] = await (await fetch('/session/token', { credentials: 'same-origin' })).text();
    }
    const response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let data = text;
    try { data = JSON.parse(text); } catch (e) { /* not JSON */ }
    return { status: response.status, ok: response.ok, data };
  }, { path, method: init.method || 'GET', body: init.body });
}

/**
 * List the Canvas pages the current user can see.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<Array<{id: number, title: string, path: string}>>}
 */
async function listCanvasPages(page) {
  const result = await canvasRequest(page, '/canvas/api/v0/content/canvas_page');
  if (!result.ok) {
    throw friendly({
      message: 'Could not list the Canvas pages.',
      cause: `the content API answered ${result.status}`,
      hint: 'Log in first as a user who may edit Canvas pages.',
    });
  }
  return (result.data && result.data.data) || [];
}

/**
 * Resolve a Canvas page by its title.
 *
 * @param {import('playwright').Page} page
 * @param {string} title
 * @returns {Promise<{id: number, title: string, path: string}|null>}
 */
async function findCanvasPage(page, title) {
  const pages = await listCanvasPages(page);
  return pages.find((p) => p.title === title) || null;
}

/**
 * Resolve a Canvas page by title, or fail with the titles that do exist.
 *
 * @param {import('playwright').Page} page
 * @param {string} title
 * @returns {Promise<{id: number, title: string, path: string}>}
 */
async function requireCanvasPage(page, title) {
  const pages = await listCanvasPages(page);
  const match = pages.find((p) => p.title === title);
  if (!match) {
    throw friendly({
      message: `No Canvas page titled "${title}" was found.`,
      cause: `the pages available are: ${pages.map((p) => `"${p.title}"`).join(', ') || 'none'}`,
      hint: 'Create it first with "a new Canvas page ... at ..." or check the title.',
    });
  }
  return match;
}

/**
 * Read the component library and return the definition of a component by its
 * machine id (`sdc.mercury.heading`) or its visible name ("Heading").
 *
 * @param {import('playwright').Page} page
 * @param {string} idOrName
 * @returns {Promise<{id: string, definition: object, available: string[]}>}
 */
async function findComponent(page, idOrName) {
  const result = await canvasRequest(page, '/canvas/api/v0/config/component');
  if (!result.ok || typeof result.data !== 'object') {
    throw friendly({
      message: 'Could not read the Canvas component library.',
      cause: `the component API answered ${result.status}`,
      hint: 'Log in first as a user who may edit Canvas pages.',
    });
  }
  const entries = Array.isArray(result.data)
    ? result.data.map((d) => [d.id, d])
    : Object.entries(result.data);
  let found = entries.find(([id]) => id === idOrName);
  if (!found) found = entries.find(([, def]) => def && def.name === idOrName);
  return {
    id: found ? found[0] : null,
    definition: found ? found[1] : null,
    available: entries.map(([id, def]) => (def && def.name ? `${def.name} (${id})` : id)),
  };
}

/**
 * Coerce a Gherkin table value to the type the component prop declares.
 *
 * @param {string} raw
 * @param {object|undefined} spec - The prop's entry in `propSources`.
 * @returns {*}
 */
function coerceInput(raw, spec) {
  const type = spec && spec.jsonSchema && spec.jsonSchema.type;
  if (type === 'boolean' || /^(true|false)$/i.test(raw)) return /^true$/i.test(raw);
  if ((type === 'number' || type === 'integer') && raw !== '' && !Number.isNaN(Number(raw))) return Number(raw);
  return raw;
}

/**
 * Build a component's model (the `resolved` values and their `source`
 * descriptors) from the library definition's defaults, overridden by the
 * inputs a step supplied.
 *
 * @param {object} definition - The component definition from the library.
 * @param {Object<string, string>} inputs - Prop name to value.
 * @returns {{resolved: object, source: object}}
 */
function buildModel(definition, inputs) {
  const resolved = {};
  const source = {};
  const specs = definition.propSources || {};
  for (const [prop, spec] of Object.entries(specs)) {
    const defaults = spec.default_values || {};
    const entry = { sourceType: spec.sourceType, expression: spec.expression };
    if (spec.sourceTypeSettings) entry.sourceTypeSettings = spec.sourceTypeSettings;
    if (defaults.source !== undefined) entry.value = defaults.source;
    if (defaults.resolved !== undefined) resolved[prop] = defaults.resolved;
    source[prop] = entry;
  }
  for (const [prop, raw] of Object.entries(inputs)) {
    const value = coerceInput(raw, specs[prop]);
    resolved[prop] = value;
    source[prop] = Object.assign(
      source[prop] || { sourceType: 'static:field_item:string', expression: 'ℹ︎string␟value' },
      { value: [{ value: typeof value === 'boolean' ? (value ? 1 : 0) : value }] }
    );
  }
  return { resolved, source };
}

/**
 * Read a Gherkin data table of `| prop | value |` rows into an object.
 *
 * @param {import('@cucumber/cucumber').DataTable|undefined} table
 * @returns {Object<string, string>}
 */
function tableInputs(table) {
  const inputs = {};
  if (table && typeof table.raw === 'function') {
    for (const [key, value] of table.raw()) inputs[key] = value;
  }
  return inputs;
}

/**
 * Append a component to the bottom of a Canvas page's content region by
 * posting the updated layout (which creates an auto-save).
 *
 * @param {import('playwright').Page} page
 * @param {number} pageId
 * @param {string} componentId
 * @param {object} definition
 * @param {Object<string, string>} inputs
 * @returns {Promise<void>}
 */
async function appendComponent(page, pageId, componentId, definition, inputs) {
  const layoutResult = await canvasRequest(page, `/canvas/api/v0/layout/canvas_page/${pageId}`);
  if (!layoutResult.ok || !Array.isArray(layoutResult.data.layout)) {
    throw friendly({ message: `Could not read the layout of Canvas page ${pageId}.`, cause: `the layout API answered ${layoutResult.status}` });
  }
  const data = layoutResult.data;
  const content = data.layout.find((region) => region.nodeType === 'region' && region.id === 'content');
  if (!content) {
    throw friendly({
      message: 'The Canvas page has no main content region to add the component to.',
      hint: 'The layout API returned no "content" region; the page template may name its regions differently.',
    });
  }
  const uuid = randomUUID();
  content.components.push({ uuid, nodeType: 'component', type: `${componentId}@${definition.version}`, name: null, slots: [] });
  data.model[uuid] = buildModel(definition, inputs);
  const post = await canvasRequest(page, `/canvas/api/v0/layout/canvas_page/${pageId}`, {
    method: 'POST',
    body: {
      layout: data.layout,
      model: data.model,
      autoSaves: data.autoSaves,
      clientInstanceId: randomUUID(),
      entity_form_fields: data.entity_form_fields,
    },
  });
  if (!post.ok) {
    throw friendly({
      message: `Could not save the "${componentId}" component on Canvas page ${pageId}.`,
      cause: `the layout API answered ${post.status}: ${String(typeof post.data === 'string' ? post.data : JSON.stringify(post.data)).slice(0, 300)}`,
    });
  }
}

/**
 * Publish every pending Canvas auto-save.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<number>} How many items were pending.
 */
async function publishPending(page) {
  // The auto-save lands a moment after the layout request returns; poll the
  // pending list in the page (same session) until it is non-empty, with a
  // budget well under the step timeout.
  let pending = null;
  try {
    const handle = await page.waitForFunction(async (path) => {
      const response = await fetch(path, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      if (!response.ok) return null;
      const payload = await response.json().catch(() => null);
      const data = payload && payload.data;
      return data && Object.keys(data).length > 0 ? data : null;
    }, '/canvas/api/v0/auto-saves/pending', { timeout: 15000, polling: 500 });
    pending = await handle.jsonValue();
  } catch (error) {
    throw friendly({
      message: 'There are no pending Canvas changes to publish.',
      cause: error,
      hint: 'Change a page first (add or insert a component, set an option).',
    });
  }
  const publish = await canvasRequest(page, '/canvas/api/v0/auto-saves/publish', { method: 'POST', body: pending });
  if (!publish.ok) {
    throw friendly({
      message: 'Publishing the pending Canvas changes failed.',
      cause: `the publish API answered ${publish.status}: ${String(typeof publish.data === 'string' ? publish.data : JSON.stringify(publish.data)).slice(0, 300)}`,
    });
  }
  return Object.keys(pending).length;
}

/**
 * Make sure the Library panel of the editor is open.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<void>}
 */
async function openLibrary(page) {
  const tabSelect = page.getByTestId('canvas-library-components-tab-select');
  if (await tabSelect.isVisible().catch(() => false)) return;
  await page.getByRole('button', { name: 'Library' }).first().click();
  await tabSelect.waitFor({ state: 'visible', timeout: 20000 });
}

// ---------------------------------------------------------------------------
// API steps
// ---------------------------------------------------------------------------

/**
 * Create a published, empty Canvas page at a path, or reset the page that
 * already has that path (or title) to an empty, published state. Reusing the
 * existing entity keeps one stable alias: a deleted page goes to the trash
 * with its alias, so a recreate would collide with it. Needs a logged in user
 * who may create Canvas pages.
 *
 * Example #1: Given a new Canvas page "Landing" at "/landing"
 * Example #2: Given there is a new Canvas page "Team" at "/about/team"
 * Example #3: Given I have a new Canvas page "Pricing" at "/pricing"
 * Example #4: And we have a new Canvas page "Events" at "/events"
 * Example #5: And there is a new Canvas page "Support" at "/support"
 *
 */
Given(/^(?:there is |I have |we have )?a new Canvas page "([^"]*)" at "([^"]*)"$/, async function (title, path) {
  const pages = await listCanvasPages(this.page);
  const existing = pages.find((p) => p.path === path) || pages.find((p) => p.title === title);
  if (existing) {
    await canvasRequest(this.page, `/canvas/api/v0/auto-saves/canvas_page/${existing.id}`, { method: 'DELETE' });
    const layoutResult = await canvasRequest(this.page, `/canvas/api/v0/layout/canvas_page/${existing.id}`);
    const data = layoutResult.ok ? layoutResult.data : null;
    const content = data && Array.isArray(data.layout) && data.layout.find((r) => r.nodeType === 'region' && r.id === 'content');
    if (content && Array.isArray(content.components) && content.components.length > 0) {
      content.components = [];
      await canvasRequest(this.page, `/canvas/api/v0/layout/canvas_page/${existing.id}`, {
        method: 'POST',
        body: {
          layout: data.layout,
          model: data.model,
          autoSaves: data.autoSaves,
          clientInstanceId: randomUUID(),
          entity_form_fields: data.entity_form_fields,
        },
      });
      await publishPending(this.page);
    }
    return;
  }
  const created = await canvasRequest(this.page, '/canvas/api/v0/content/canvas_page', {
    method: 'POST',
    body: { title, status: true, path: { alias: path }, components: [] },
  });
  if (created.status !== 201) {
    throw friendly({
      message: `Could not create the "${title}" Canvas page.`,
      cause: `the content API answered ${created.status}: ${String(typeof created.data === 'string' ? created.data : JSON.stringify(created.data)).slice(0, 300)}`,
      hint: 'Log in first as a user who may create Canvas pages.',
    });
  }
});

/**
 * Create a published Canvas page holding one component, configured from a
 * data table of `| prop | value |` rows (prop names as in the component's
 * definition; "true"/"false" and numbers are coerced to the declared type).
 * The page is created empty, the component appended with the library
 * defaults plus the given values, and the result published, all through the
 * authoring API. Pass the component's machine id or its visible name. Without
 * a table (no trailing colon) the component keeps its library defaults.
 *
 * Example #1: When I create a Canvas page "Welcome" at "/welcome" with the "sdc.mercury.heading" component:
 * Example #2: And I create a Canvas page "Intro" at "/intro" with the "Heading" component:
 * Example #3: When we create a Canvas page "Quote" at "/quote" with the "Blockquote" component:
 * Example #4: And I create a Canvas page "Cards" at "/cards" with the "Card" component:
 * Example #5: When I create a Canvas page "Promo" at "/promo" with the "Hero CTA" component:
 *
 */
When(/^(I |we )*create a Canvas page "([^"]*)" at "([^"]*)" with the "([^"]*)" component:$/, async function (pronounCase, title, path, component, table) {
  await createCanvasPageWithComponent(this, title, path, component, table);
});

/**
 * Create a published Canvas page holding one component with its library
 * defaults (the table-less form of the step above).
 *
 * Example #1: When I create a Canvas page "Promo" at "/promo" with the "Hero CTA" component
 * Example #2: And I create a Canvas page "Buttons" at "/buttons" with the "Button" component
 * Example #3: When we create a Canvas page "Intro" at "/intro" with the "sdc.mercury.heading" component
 * Example #4: And we create a Canvas page "Quote" at "/quote" with the "Blockquote" component
 * Example #5: Given I create a Canvas page "Cards" at "/cards" with the "Card" component
 *
 */
When(/^(I |we )*create a Canvas page "([^"]*)" at "([^"]*)" with the "([^"]*)" component$/, async function (pronounCase, title, path, component) {
  await createCanvasPageWithComponent(this, title, path, component, undefined);
});

/**
 * Shared body of the two "create a Canvas page ... with the ... component"
 * steps (with and without a data table).
 */
async function createCanvasPageWithComponent(world, title, path, component, table) {
  const inputs = tableInputs(table);
  const found = await findComponent(world.page, component);
  if (!found.id) {
    throw friendly({
      message: `The "${component}" component is not in the Canvas component library.`,
      cause: `the library lists: ${found.available.slice(0, 40).join(', ')}`,
    });
  }
  const pages = await listCanvasPages(world.page);
  const existing = pages.find((p) => p.path === path) || pages.find((p) => p.title === title);
  let pageId = existing && existing.id;
  if (existing) {
    await canvasRequest(world.page, `/canvas/api/v0/auto-saves/canvas_page/${existing.id}`, { method: 'DELETE' });
    const layoutResult = await canvasRequest(world.page, `/canvas/api/v0/layout/canvas_page/${existing.id}`);
    const data = layoutResult.ok ? layoutResult.data : null;
    const content = data && Array.isArray(data.layout) && data.layout.find((r) => r.nodeType === 'region' && r.id === 'content');
    if (content) {
      content.components = [];
      await canvasRequest(world.page, `/canvas/api/v0/layout/canvas_page/${existing.id}`, {
        method: 'POST',
        body: {
          layout: data.layout,
          model: data.model,
          autoSaves: data.autoSaves,
          clientInstanceId: randomUUID(),
          entity_form_fields: data.entity_form_fields,
        },
      });
    }
  } else {
    const created = await canvasRequest(world.page, '/canvas/api/v0/content/canvas_page', {
      method: 'POST',
      body: { title, status: true, path: { alias: path }, components: [] },
    });
    if (created.status !== 201) {
      throw friendly({
        message: `Could not create the "${title}" Canvas page.`,
        cause: `the content API answered ${created.status}: ${String(typeof created.data === 'string' ? created.data : JSON.stringify(created.data)).slice(0, 300)}`,
      });
    }
    pageId = created.data.id;
  }
  await appendComponent(world.page, pageId, found.id, found.definition, inputs);
  await publishPending(world.page);
}

/**
 * Append a component to the bottom of an existing Canvas page's content,
 * configured from a data table of `| prop | value |` rows, and publish the
 * page when the step says so. This performs through the authoring API the
 * same change the editor's drag and drop makes.
 *
 * Example #1: When I add the "Heading" component to the bottom of the "Landing" Canvas page and publish it:
 * Example #2: And I add the "sdc.mercury.text" component to the bottom of the "Landing" Canvas page:
 * Example #3: When we add the "Button" component to the bottom of the "Pricing" Canvas page and publish:
 * Example #4: And I add the "Blockquote" component to the bottom of the "Quote" Canvas page:
 * Example #5: When I add the "Hero CTA" component to the bottom of the "Home" Canvas page and publish it:
 *
 */
When(/^(I |we )*add the "([^"]*)" component to the bottom of the "([^"]*)" Canvas page( and publish(?: it)?)?:$/, async function (pronounCase, component, title, publishCase, table) {
  await addComponentToCanvasPage(this, component, title, publishCase, table);
});

/**
 * Append a component with its library defaults to the bottom of an existing
 * Canvas page (the table-less form of the step above), publishing when asked.
 *
 * Example #1: When I add the "Text" component to the bottom of the "Landing" Canvas page
 * Example #2: And I add the "Heading" component to the bottom of the "Landing" Canvas page and publish it
 * Example #3: When we add the "Button" component to the bottom of the "Pricing" Canvas page and publish
 * Example #4: And we add the "Blockquote" component to the bottom of the "Quote" Canvas page
 * Example #5: Given I add the "Hero CTA" component to the bottom of the "Home" Canvas page and publish it
 *
 */
When(/^(I |we )*add the "([^"]*)" component to the bottom of the "([^"]*)" Canvas page( and publish(?: it)?)?$/, async function (pronounCase, component, title, publishCase) {
  await addComponentToCanvasPage(this, component, title, publishCase, undefined);
});

/**
 * Shared body of the two "add the ... component to the bottom of the ...
 * Canvas page" steps (with and without a data table).
 */
async function addComponentToCanvasPage(world, component, title, publishCase, table) {
  const inputs = tableInputs(table);
  const found = await findComponent(world.page, component);
  if (!found.id) {
    throw friendly({
      message: `The "${component}" component is not in the Canvas component library.`,
      cause: `the library lists: ${found.available.slice(0, 40).join(', ')}`,
    });
  }
  const target = await requireCanvasPage(world.page, title);
  await appendComponent(world.page, target.id, found.id, found.definition, inputs);
  if (supplied(publishCase)) {
    await publishPending(world.page);
  }
}

/**
 * Publish every pending Canvas change (the auto-saves the editor or the API
 * steps created) through the authoring API: deterministic and fast, with no
 * editor timing involved. When a page is open in the editor its auto-saved
 * layout is re-posted first, so a change the editor is still debouncing is
 * included.
 *
 * Example #1: When I publish the Canvas page changes
 * Example #2: And I publish the pending Canvas changes
 * Example #3: When we publish the Canvas changes
 * Example #4: And we publish the pending Canvas page changes
 * Example #5: Then I publish the Canvas page changes
 *
 */
When(/^(I |we )*publish the (?:pending )?Canvas (?:page )?changes$/, { timeout: 120000 }, async function (pronounCase) {
  const pageId = (this.page.url().match(/canvas_page\/(\d+)/) || [])[1];
  if (pageId) {
    const layoutResult = await canvasRequest(this.page, `/canvas/api/v0/layout/canvas_page/${pageId}`);
    if (layoutResult.ok && Array.isArray(layoutResult.data.layout)) {
      const data = layoutResult.data;
      await canvasRequest(this.page, `/canvas/api/v0/layout/canvas_page/${pageId}`, {
        method: 'POST',
        body: {
          layout: data.layout,
          model: data.model,
          autoSaves: data.autoSaves,
          clientInstanceId: randomUUID(),
          entity_form_fields: data.entity_form_fields,
        },
      });
    }
  }
  await publishPending(this.page);
});

/**
 * Delete a Canvas page by its title through the authoring API (the page goes
 * to the trash when the Trash module is enabled). Keeps a scenario that
 * creates pages repeatable.
 *
 * Example #1: When I delete the "Landing" Canvas page
 * Example #2: And I delete the "Pricing" Canvas page
 * Example #3: When we delete the "Team" Canvas page
 * Example #4: And we delete the "Events" Canvas page
 * Example #5: Then I delete the "Support" Canvas page
 *
 */
When(/^(I |we )*delete the "([^"]*)" Canvas page$/, async function (pronounCase, title) {
  const target = await requireCanvasPage(this.page, title);
  const result = await canvasRequest(this.page, `/canvas/api/v0/content/canvas_page/${target.id}`, { method: 'DELETE' });
  if (!result.ok) {
    throw friendly({ message: `Could not delete the "${title}" Canvas page.`, cause: `the content API answered ${result.status}` });
  }
});

/**
 * Open a Canvas page on the public site by its title, resolving its path
 * through the authoring API, so a scenario does not have to repeat the alias.
 *
 * Example #1: When I visit the "Home" Canvas page
 * Example #2: And I go to the "Landing" Canvas page
 * Example #3: When we visit the "Pricing" Canvas page
 * Example #4: And we go to the "Team" Canvas page
 * Example #5: Then I visit the "Events" Canvas page
 *
 */
When(/^(I |we )*(?:visit|go to) the "([^"]*)" Canvas page$/, async function (pronounCase, title) {
  const target = await requireCanvasPage(this.page, title);
  await navigate(this, target.path || target.internalPath || `/page/${target.id}`);
});

/**
 * Assert a Canvas page with the given title exists, or does not, in the
 * authoring API's page list.
 *
 * Example #1: Then the "Home" Canvas page should exist
 * Example #2: And the "Landing" Canvas page should exist
 * Example #3: Then the "Old landing" Canvas page should not exist
 * Example #4: And the "Pricing" Canvas page should not exist
 * Example #5: Then the "Team" Canvas page should exist
 *
 */
Then(/^the "([^"]*)" Canvas page should( not)* exist$/, async function (title, notCase) {
  const found = await findCanvasPage(this.page, title);
  assert.ok(
    notCase ? !found : Boolean(found),
    friendly(notCase
      ? `Expected no Canvas page titled "${title}", but one exists at ${found && found.path}.`
      : `Expected a Canvas page titled "${title}", but none is listed.`).message
  );
});

/**
 * Assert a component is, or is not, offered in the Canvas component library,
 * by machine id or visible name. The editor fills its Library from the same
 * endpoint queried here, so this checks what a site builder can place without
 * driving the editor.
 *
 * Example #1: Then the Canvas component library should list the "Heading" component
 * Example #2: And the Canvas component library should list the "sdc.mercury.text" component
 * Example #3: Then the Canvas component library should not list the "Legacy slider" component
 * Example #4: And the Canvas component library should list the "block.system_branding_block" component
 * Example #5: Then the Canvas component library should not list the "sdc.old.banner" component
 *
 */
Then(/^the Canvas component library should( not)* list the "([^"]*)" component$/, async function (notCase, component) {
  const found = await findComponent(this.page, component);
  assert.ok(
    notCase ? !found.id : Boolean(found.id),
    friendly({
      message: notCase
        ? `The "${component}" component should not be in the Canvas component library, but it is (${found.id}).`
        : `The "${component}" component is not in the Canvas component library.`,
      cause: notCase ? undefined : `the library lists: ${found.available.slice(0, 40).join(', ')}`,
    }).message
  );
});

// ---------------------------------------------------------------------------
// Editor steps
// ---------------------------------------------------------------------------

/**
 * Open a Canvas page in the editor (`/canvas/editor/canvas_page/<id>`) and
 * wait until the editor can be driven, which is when its left toolbar's
 * "Library" button is on screen. The editor is a heavy React application that
 * occasionally fails to mount under load, so the step reloads and retries
 * inside one overall budget instead of one long blind wait. Resolves the page
 * by title; log in first as a user who may edit Canvas pages.
 *
 * Example #1: When I open the "Home" Canvas page in the editor
 * Example #2: And I open the "Landing" Canvas page in the editor
 * Example #3: When we open the "Pricing" Canvas page in the editor
 * Example #4: Given I open the "Team" Canvas page in the editor
 * Example #5: And we open the "Events" Canvas page in the editor
 *
 */
When(/^(I |we )*open the "([^"]*)" Canvas page in the editor$/, { timeout: EDITOR_OPEN_TIMEOUT }, async function (pronounCase, title) {
  const started = Date.now();
  const target = await requireCanvasPage(this.page, title);
  const editorUrl = `${this.launchUrl.replace(/\/$/, '')}/canvas/editor/canvas_page/${target.id}`;
  const libraryButton = this.page.getByRole('button', { name: 'Library' }).first();
  const deadline = started + EDITOR_OPEN_TIMEOUT - EDITOR_OPEN_RESERVE;
  const remaining = () => deadline - Date.now();
  let ready = false;
  let attempts = 0;
  let lastError = null;
  while (!ready && remaining() >= EDITOR_MIN_ATTEMPT) {
    attempts++;
    const attemptBudget = Math.min(EDITOR_ATTEMPT, remaining());
    const gotoBudget = Math.max(15000, Math.round(attemptBudget / 3));
    try {
      await gotoUrl(this.page, editorUrl, { timeout: gotoBudget });
      await smartSettle(this.page, Math.max(1000, Math.min(Math.round((attemptBudget - gotoBudget) / 2), remaining())));
      await libraryButton.waitFor({ state: 'visible', timeout: Math.max(1000, Math.min(attemptBudget - gotoBudget, remaining())) });
      ready = true;
    } catch (error) {
      lastError = error;
      const settleBudget = Math.min(EDITOR_SETTLE, remaining());
      if (settleBudget > 0) await smartSettle(this.page, settleBudget);
    }
  }
  if (!ready) {
    throw friendly({
      message: `The Canvas editor for "${title}" did not become ready after ${attempts} attempt(s) in ${Math.round((Date.now() - started) / 1000)}s.`,
      cause: lastError || 'the "Library" toolbar button never appeared',
    });
  }
  await smartSettle(this.page, budget(this));
});

/**
 * Assert the Canvas editor is, or is not, on screen, via its preview frame.
 *
 * Example #1: Then I should see the Canvas editor
 * Example #2: And we should see the Canvas editor
 * Example #3: Then should see the Canvas editor
 * Example #4: And I should not see the Canvas editor
 * Example #5: Then we should not see the Canvas editor
 *
 */
Then(/^(I |we )*should( not)* see the Canvas editor$/, async function (pronounCase, notCase) {
  await assertPresence(
    this.page.getByTestId('canvas-editor-frame').first(),
    notCase,
    'the Canvas editor frame ([data-testid="canvas-editor-frame"])'
  );
});

/**
 * Open the "Components" or "Patterns" tab of the editor's Library panel,
 * opening the panel first when it is closed (never toggling an open panel
 * shut), and wait for the tab's content to render. Open a page in the editor
 * first.
 *
 * Example #1: When I open the "Components" tab in the Canvas Library
 * Example #2: And I open the "Patterns" tab in the Canvas Library
 * Example #3: When we open the "Components" tab in the Canvas Library
 * Example #4: Given I open the "Patterns" tab in the Canvas Library
 * Example #5: And we open the "Patterns" tab in the Canvas Library
 *
 */
When(/^(I |we )*open the "(Patterns|Components)" tab in the Canvas Library$/, { timeout: 60000 }, async function (pronounCase, tabName) {
  const key = tabName.toLowerCase();
  try {
    await openLibrary(this.page);
    const select = this.page.getByTestId(`canvas-library-${key}-tab-select`);
    await select.waitFor({ state: 'visible', timeout: 20000 });
    await select.click();
    const content = this.page.getByTestId(`canvas-library-${key}-tab-content`);
    await content.waitFor({ state: 'visible', timeout: 20000 });
    if (key === 'components') {
      await content.locator('[data-canvas-type="component"], [aria-roledescription="draggable"]').first()
        .waitFor({ state: 'visible', timeout: 20000 });
    }
  } catch (error) {
    throw friendly({
      message: `Could not open the "${tabName}" tab in the Canvas Library.`,
      cause: error,
      hint: 'Open a page in the Canvas editor first.',
    });
  }
  await smartSettle(this.page, budget(this));
});

/**
 * Assert the Library's "Components" or "Patterns" tab lists, or does not list,
 * an item by its visible label, read from the panel on screen (what the site
 * builder sees, not the API). Matches a whole line item exactly. Open the tab
 * first.
 *
 * Example #1: Then the Canvas Library "Components" tab should list "Heading"
 * Example #2: And the Canvas Library "Components" tab should list "Hero CTA"
 * Example #3: Then the Canvas Library "Components" tab should not list "Legacy slider"
 * Example #4: And the Canvas Library "Patterns" tab should list "Site header"
 * Example #5: Then the Canvas Library "Patterns" tab should not list "Old footer"
 *
 */
Then(/^the Canvas Library "(Patterns|Components)" tab should( not)* list "([^"]*)"$/, { timeout: 30000 }, async function (tabName, notCase, label) {
  const panel = this.page.getByTestId(`canvas-library-${tabName.toLowerCase()}-tab-content`).first();
  try {
    await panel.waitFor({ state: 'visible', timeout: 15000 });
  } catch (error) {
    throw friendly({ message: `Could not read the Canvas Library "${tabName}" tab.`, cause: error, hint: 'Open that Library tab first.' });
  }
  // An item is listed by its data attribute or by a row whose text is exactly
  // the label; Playwright polls for it to appear (or to be gone).
  const item = panel.locator(`[data-canvas-name="${label.replace(/"/g, '\\"')}"]`)
    .or(panel.getByText(label, { exact: true }))
    .first();
  try {
    await item.waitFor({ state: notCase ? 'detached' : 'attached', timeout: 10000 });
  } catch (error) {
    const text = (await panel.innerText({ timeout: 1000 }).catch(() => '')) || '';
    const items = text.split('\n').map((s) => s.trim()).filter(Boolean);
    throw friendly({
      message: notCase
        ? `The Canvas Library "${tabName}" tab should not list "${label}", but it does.`
        : `The Canvas Library "${tabName}" tab should list "${label}", but it does not.`,
      cause: `items seen: ${items.join(', ')}`,
      hint: 'Use the item\'s visible label exactly as the Library shows it (case and spacing included).',
    });
  }
});

/**
 * Insert a component or pattern from the open Library tab into the page in
 * the editor, the way a site builder does: right-click its row and choose
 * "Insert". The inserted item becomes selected, so the editor URL gains a new
 * `/component/<uuid>`, which the step waits for to confirm the insert.
 * Inserting twice lands two independent copies. Open the matching Library
 * tab first and use the item's visible label.
 *
 * Example #1: When I insert the "Heading" component from the Canvas Library
 * Example #2: And I insert the "Text" component from the Canvas Library
 * Example #3: When we insert the "Hero CTA" component from the Canvas Library
 * Example #4: And I insert the "Site header" pattern from the Canvas Library
 * Example #5: When we insert the "Counters" pattern from the Canvas Library
 *
 */
When(/^(I |we )*insert the "([^"]*)" (component|pattern) from the Canvas Library$/, { timeout: 60000 }, async function (pronounCase, label, kind) {
  const uuidOf = (url) => (url.match(/\/component\/([0-9a-f-]+)/i) || [])[1] || null;
  const before = uuidOf(this.page.url());
  const panel = this.page.getByTestId(`canvas-library-${kind === 'component' ? 'components' : 'patterns'}-tab-content`);
  const row = panel.locator(`[data-canvas-name="${label.replace(/"/g, '\\"')}"]`)
    .or(panel.getByText(label, { exact: true }))
    .first();
  try {
    await row.waitFor({ state: 'visible', timeout: 15000 });
    await row.scrollIntoViewIfNeeded();
    await row.click({ button: 'right' });
    const insert = this.page.getByRole('menuitem', { name: 'Insert' });
    await insert.waitFor({ state: 'visible', timeout: 10000 });
    await insert.click();
    await this.page.waitForFunction((previous) => {
      const match = location.pathname.match(/\/component\/([0-9a-f-]+)/i);
      return Boolean(match && match[1] !== previous);
    }, before, { timeout: 25000 });
  } catch (error) {
    throw friendly({
      message: `Could not insert the "${label}" ${kind} from the Canvas Library.`,
      cause: error,
      hint: `Open the "${kind === 'component' ? 'Components' : 'Patterns'}" Library tab first and check the label; right-clicking the row must offer "Insert".`,
    });
  }
  await smartSettle(this.page, budget(this));
});

/**
 * Set an option of the component currently selected in the editor, by the
 * visible label of its settings field. Scoped to the component props form
 * (`canvas_component_props[...]`), so a same-named page field is never hit.
 * Works for text inputs, textareas, selects (match the option text or value),
 * checkboxes and radios; dispatches input/change so the editor auto-saves.
 *
 * Example #1: When I set the Canvas component option "Heading" to "Welcome"
 * Example #2: And I set the Canvas component option "Heading level" to "3"
 * Example #3: When we set the Canvas component option "Text alignment" to "Center"
 * Example #4: And I set the Canvas component option "Background color" to "Primary"
 * Example #5: When I set the Canvas component option "Text" to "Read on"
 *
 */
When(/^(I |we )*set the Canvas component option "([^"]*)" to "([^"]*)"$/, { timeout: 60000 }, async function (pronounCase, label, value) {
  const matcher = (lbl) => [...document.querySelectorAll('[name^="canvas_component_props"]')].find((el) => {
    const own = el.labels && el.labels[0] && el.labels[0].textContent.trim() === lbl;
    const wrap = el.closest('.form-item, .js-form-item, [class*="formItem"]');
    const inWrap = wrap && [...wrap.querySelectorAll('label')].some((l) => l.textContent.trim() === lbl);
    return own || inWrap;
  });
  await this.page.waitForFunction((lbl) => {
    return [...document.querySelectorAll('[name^="canvas_component_props"]')].some((el) => {
      const own = el.labels && el.labels[0] && el.labels[0].textContent.trim() === lbl;
      const wrap = el.closest('.form-item, .js-form-item, [class*="formItem"]');
      return own || (wrap && [...wrap.querySelectorAll('label')].some((l) => l.textContent.trim() === lbl));
    });
  }, label, { timeout: 20000 }).catch(() => {});
  const ok = await this.page.evaluate(({ label, value, matcherSource }) => {
    const find = new Function('return ' + matcherSource)();
    const field = find(label);
    if (!field) return false;
    if (field.tagName === 'SELECT') {
      const option = [...field.options].find((o) => o.text.trim() === value) || [...field.options].find((o) => o.value === value);
      if (!option) return false;
      field.value = option.value;
    } else if (field.type === 'checkbox') {
      const on = value === '1' || /^(true|on|yes|checked)$/i.test(value);
      if (field.checked !== on) field.checked = on;
    } else if (field.type === 'radio') {
      field.checked = true;
    } else {
      const setter = Object.getOwnPropertyDescriptor(field.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value');
      if (setter && setter.set) setter.set.call(field, value); else field.value = value;
    }
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    field.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
  }, { label, value, matcherSource: matcher.toString() });
  if (!ok) {
    throw friendly({
      message: `Could not set the Canvas component option "${label}".`,
      hint: 'Select a component in the editor first (insert one, or open its URL), then check the field label and the option value.',
    });
  }
  await smartSettle(this.page, budget(this));
});

/**
 * Publish the pending changes through the editor's own Review widget, the way
 * a site builder ships a page: open the topbar "Review N change(s)" button,
 * "Select all", then "Publish N selected", and wait until the widget reads
 * "No changes" again. The review list is site-wide, so drive this right after
 * changing the page under test. Make at least one change first.
 *
 * Example #1: When I publish the Canvas page changes through the editor
 * Example #2: And I publish the Canvas page changes through the editor
 * Example #3: When we publish the Canvas page changes through the editor
 * Example #4: And we publish the Canvas page changes through the editor
 * Example #5: Then I publish the Canvas page changes through the editor
 *
 */
When(/^(I |we )*publish the Canvas page changes through the editor$/, { timeout: 120000 }, async function (pronounCase) {
  try {
    const review = this.page.getByTestId('canvas-publish-review');
    await review.waitFor({ state: 'visible', timeout: 20000 });
    await this.page.waitForFunction(() => {
      const button = document.querySelector('[data-testid="canvas-publish-review"]');
      return Boolean(button && !/no changes/i.test(button.textContent));
    }, null, { timeout: 30000 });
    await review.click();
    const selectAll = this.page.getByTestId('canvas-publish-review-select-all');
    if (await selectAll.isVisible({ timeout: 10000 }).catch(() => false)) {
      await selectAll.click();
    } else {
      const checkbox = this.page.getByRole('checkbox', { name: /select all/i }).first();
      if (await checkbox.isVisible({ timeout: 5000 }).catch(() => false)) await checkbox.click();
    }
    const publishButton = this.page.getByRole('button', { name: /Publish (\d+ )?(selected|all|changes?)/i }).first();
    await publishButton.waitFor({ state: 'visible', timeout: 15000 });
    await publishButton.click();
    await this.page.waitForFunction(() => {
      const button = document.querySelector('[data-testid="canvas-publish-review"]');
      return Boolean(button && /no changes/i.test(button.textContent));
    }, null, { timeout: 40000 });
  } catch (error) {
    throw friendly({
      message: 'Could not publish the Canvas page changes through the editor.',
      cause: error,
      hint: 'Open a page in the editor and make at least one change first; the Review, Select all and Publish controls must be reachable.',
    });
  }
  await smartSettle(this.page, budget(this));
});
