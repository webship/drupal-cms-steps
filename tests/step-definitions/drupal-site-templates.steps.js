'use strict';

// Steps for the site template a Drupal CMS site was installed with, and the
// add-on recipes applied on top of it. A site template is a "Site" recipe the
// Drupal CMS installer applies (Starter, Blank, or one from the catalogue);
// an add-on recipe (Forms, Search, SEO tools, ...) is applied afterwards.
//
// Neither is readable from the site once installed, so the suite is told what
// it runs against: `worldParameters.siteTemplate` (DRUPAL_SITE_TEMPLATE) and
// `worldParameters.recipes` (DRUPAL_CMS_RECIPES). The precondition steps below
// skip a scenario whose template or recipe the site does not have, the way a
// tag lane would, but stated in the scenario itself. What a template promises
// is then asserted with the site structure steps of the core pack.

const { Given, Then } = require('@cucumber/cucumber');
const assert = require('assert');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const { joinUrl } = require('@webship-js/drupal-core-steps/tests/step-definitions/drupal-helpers');

/**
 * The site template the suite was told about, normalised to a machine name
 * ("Starter", "drupal_cms_starter" and "drupal/drupal_cms_starter" are the
 * same template).
 *
 * @param {string} name
 * @returns {string}
 */
function templateMachineName(name) {
  let n = String(name || '').trim().toLowerCase();
  n = n.replace(/^drupal\//, '').replace(/[\s-]+/g, '_');
  if (n && !n.startsWith('drupal_cms_') && /^[a-z0-9_]+$/.test(n) && ['starter', 'blank'].includes(n)) n = `drupal_cms_${n}`;
  return n;
}

/**
 * Run the rest of the scenario only on a site installed with the named site
 * template; on any other template the scenario is skipped (reported as
 * skipped, not failed), so one suite serves every template a project tests.
 * The template the site has comes from `worldParameters.siteTemplate`
 * (`DRUPAL_SITE_TEMPLATE`, default `drupal_cms_starter`).
 *
 * Example #1: Given the site template is "drupal_cms_starter"
 * Example #2: Given the site template is "Starter"
 * Example #3: Given the site was installed with the "drupal_cms_blank" site template
 * Example #4: Given the "drupal_cms_starter" site template is installed
 * Example #5: Given the site template is "drupal/drupal_cms_starter"
 *
 */
Given(/^(?:the site template is "([^"]*)"|the site was installed with the "([^"]*)" site template|the "([^"]*)" site template is installed)$/, function (a, b, c) {
  const wanted = templateMachineName(a || b || c);
  const current = templateMachineName((this.parameters && this.parameters.siteTemplate) || 'drupal_cms_starter');
  if (wanted !== current) {
    this.attach(`skipped: the site was installed with the "${current}" site template, not "${wanted}" (set DRUPAL_SITE_TEMPLATE to run this scenario)`);
    return 'skipped';
  }
  return undefined;
});

/**
 * Run the rest of the scenario only when an add-on recipe was applied to the
 * site (Drupal CMS's Forms, Search, SEO tools, Accessibility tools, ..., or
 * any recipe by machine name); otherwise the scenario is skipped. The
 * recipes the site has come from `worldParameters.recipes`
 * (`DRUPAL_CMS_RECIPES`, comma separated).
 *
 * Example #1: Given the "drupal_cms_forms" recipe is applied
 * Example #2: Given the "drupal_cms_search" recipe is applied
 * Example #3: Given the "drupal_cms_seo_tools" recipe is applied
 * Example #4: Given the "drupal_cms_accessibility_tools" recipe was applied
 * Example #5: Given the "my_site_blog" recipe is applied
 *
 */
Given(/^the "([^"]*)" recipe (?:is|was) applied$/, function (recipe) {
  const wanted = String(recipe).trim().toLowerCase().replace(/^drupal\//, '');
  const applied = ((this.parameters && this.parameters.recipes) || []).map((r) => String(r).trim().toLowerCase().replace(/^drupal\//, ''));
  if (!applied.includes(wanted)) {
    this.attach(`skipped: the "${wanted}" recipe is not applied on this site (DRUPAL_CMS_RECIPES: ${applied.join(', ') || 'none'})`);
    return 'skipped';
  }
  return undefined;
});

/**
 * Assert what the suite was told about the site template, as a plain
 * statement for a report: fails when the template on record is another one.
 * Pair it with the core pack's site structure steps to assert what the
 * template actually put in place (content types, roles, menus, the front
 * page, the default theme, the Canvas pages).
 *
 * Example #1: Then the site template should be "drupal_cms_starter"
 * Example #2: Then the site template should be "Starter"
 * Example #3: Then the site template should not be "drupal_cms_blank"
 * Example #4: And the site template should be "drupal_cms_starter"
 * Example #5: Then the site template should not be "Blank"
 *
 */
Then(/^the site template should( not)* be "([^"]*)"$/, function (notCase, name) {
  const wanted = templateMachineName(name);
  const current = templateMachineName((this.parameters && this.parameters.siteTemplate) || 'drupal_cms_starter');
  const matches = wanted === current;
  assert.ok(
    notCase ? !matches : matches,
    friendly({
      message: notCase ? `Expected the site template not to be "${wanted}".` : `Expected the site template to be "${wanted}".`,
      cause: `the suite runs against the "${current}" site template (worldParameters.siteTemplate / DRUPAL_SITE_TEMPLATE)`,
    }).message
  );
});

/**
 * Assert the site answers the Canvas content listing with at least a number
 * of Canvas pages, which is the quickest proof that a site template with
 * Canvas default content applied: the listing at `/admin/content/pages` is
 * read with the current session.
 *
 * Example #1: Then the site should have at least 1 Canvas page
 * Example #2: Then the site should have at least 2 Canvas pages
 * Example #3: And the site should have at least 5 Canvas pages
 * Example #4: Then the site should have at least 1 Canvas pages
 * Example #5: And the site should have at least 3 Canvas pages
 *
 */
Then(/^the site should have at least (\d+) Canvas pages?$/, async function (expected) {
  const url = joinUrl(this.launchUrl, '/canvas/api/v0/content/canvas_page');
  const response = await this.page.request.get(url, { failOnStatusCode: false });
  if (response.status() !== 200) {
    throw friendly({
      message: 'Could not list the Canvas pages.',
      cause: `${url} answered ${response.status()}`,
      hint: 'Log in first as a user who may use the Canvas editor; the canvas module must be installed.',
    });
  }
  // The content API answers `{ data: [...], meta: { count }, links }`.
  const payload = await response.json().catch(() => null);
  const list = payload && Array.isArray(payload.data) ? payload.data : (Array.isArray(payload) ? payload : null);
  if (!list) {
    throw friendly({
      message: 'Could not read the list of Canvas pages.',
      cause: `${url} answered ${response.status()} without a list of pages`,
    });
  }
  const count = payload && payload.meta && Number.isFinite(payload.meta.count) ? payload.meta.count : list.length;
  const want = parseInt(expected, 10);
  assert.ok(
    count >= want,
    friendly({
      message: `Expected at least ${want} Canvas page(s).`,
      cause: `the site has ${count}`,
    }).message
  );
});

module.exports = { templateMachineName };
