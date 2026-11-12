'use strict';

// What this pack brings along for every scenario. Not a step file.
//
//   1. The core pack's steps. A Drupal CMS project installs this pack alone;
//      everything a plain Drupal site has (login by handle, the users registry,
//      named pages, messages, listings, the editor, the media library, access
//      control, the Navigation sidebar and top bar, content moderation, site
//      structure, Layout Builder) comes from @webship-js/drupal-core-steps,
//      which this package depends on and loads here, so one `require` glob in
//      cucumber.js is enough. A project that lists the core pack's glob as well
//      is fine: Node loads a file once.
//
//   2. The named selectors Drupal CMS adds on top of core's: the Gin admin
//      theme, the Navigation top bar as Gin styles it, the dashboard, the
//      Drupal Canvas editor, the cookie consent dialog. Merged after the
//      project's own names and the core preset, never overriding them.

const fs = require('fs');
const path = require('path');
const { Before } = require('@cucumber/cucumber');

const CORE_STEPS_DIR = path.join(path.dirname(require.resolve('@webship-js/drupal-core-steps/package.json')), 'tests', 'step-definitions');
for (const file of fs.readdirSync(CORE_STEPS_DIR).filter((f) => f.endsWith('.js')).sort()) {
  require(path.join(CORE_STEPS_DIR, file));
}

const { mergeSelectorPreset } = require('@webship-js/drupal-core-steps/tests/step-definitions/drupal-defaults');

const CMS_SELECTORS_FILE = path.join(__dirname, '..', 'selectors', 'drupal-cms.json');

// After webship-js (default order) and after the core preset (10100).
Before({ order: 10200 }, function () {
  mergeSelectorPreset(this, CMS_SELECTORS_FILE);
});

module.exports = { CORE_STEPS_DIR, CMS_SELECTORS_FILE };
