# drupal-cms-steps

[![Test](https://github.com/webship/drupal-cms-steps/actions/workflows/test.yml/badge.svg)](https://github.com/webship/drupal-cms-steps/actions/workflows/test.yml)

Drupal CMS specific Cucumber step definitions for [webship-js](https://www.npmjs.com/package/webship-js), a Playwright + Cucumber BDD testing framework. `@webship-js/drupal-cms-steps` covers what [Drupal CMS](https://www.drupal.org/about/drupal-cms) adds on top of a plain Drupal core site: the Navigation sidebar and top bar as Drupal CMS ships them, the dashboard and its sections, the content types a site template installs, the Gin node form, the editorial workflow, email login, and **Drupal Canvas**, both through its editor and through its authoring API.

It is a **plugin for webship-js** and builds on [`@webship-js/drupal-core-steps`](https://www.npmjs.com/package/@webship-js/drupal-core-steps): everything a Drupal core site has (login by user handle, named admin pages, status messages, page titles, breadcrumbs, listings and their operations, the rich text editor, the media library, session-aware HTTP status, cache flushing) comes from the core pack, and element, text, table row, URL and response assertions come from webship-js itself. This pack never duplicates a step either of them already provides.

## What's covered

- **Dashboard**: `Given I am on the dashboard`, `I should see the dashboard`, `I should see the "Recent content" dashboard section`, `I should not see the "Announcements" dashboard section`
- **Site templates and add-on recipes**: `Given the site template is "drupal_cms_starter"` and `Given the "drupal_cms_forms" recipe is applied` run a scenario only where that template or recipe is installed (skipped elsewhere), `the site template should be "..."`, `the site should have at least 1 Canvas page`; `scripts/install-site-template.sh` installs the fixture with any template and recipes (see "Site templates")
- **Cookie consent** (Klaro, which Drupal CMS ships): the suite pre-accepts it before every scenario (`acceptCookieConsent`, `KEEP_COOKIE_CONSENT=1` to keep the dialog), `I should (not) see the cookie consent dialog`, `I accept|decline the cookie consent`, `the cookie consent is not given yet`; the Autosave Form "resume your draft?" dialog is discarded after a step on a node form
- **Moderation Sidebar** (contrib): `When I open the moderation sidebar`, `the moderation sidebar should show "Draft"`, for sites that add that module (the Navigation sidebar, the top bar, the content types, the Gin-aware `save the content`, the required-field check and core's content moderation steps now live in the core pack and are available here)
- **Email login**: `When I log in with the email address of "content editor"` (the Login Email or Username module Drupal CMS ships)
- **Drupal Canvas, API**: `Given there is a new Canvas page "Landing" at "/landing"`, `When I add the "Heading" component to the bottom of the "Landing" Canvas page and publish it:` with a `| prop | value |` table, `When I create a Canvas page "…" at "/…" with the "…" component:`, `When I publish the pending Canvas changes`, `When I delete the "Landing" Canvas page`, `When I visit the "Landing" Canvas page`, `the "Landing" Canvas page should exist`, `the Canvas component library should list the "Heading" component`
- **Drupal Canvas, editor**: `When I open the "Landing" Canvas page in the editor`, `I should see the Canvas editor`, `When I open the "Components" tab in the Canvas Library`, `When I filter the Canvas Library by "Heading"`, `the Canvas Library "Components" tab should list "Heading"`, `When I insert the "Heading" component from the Canvas Library`, `When I set the Canvas component option "Heading" to "Welcome"`, `When I publish the Canvas page changes through the editor`, `the "Landing" Canvas page should have 2 components`

Every step accepts the `I` and `we` pronoun forms, and every assertion reads both polarities from one definition. Each step is documented inline in `tests/step-definitions/drupal-cms.steps.js` and `tests/step-definitions/drupal-canvas.steps.js` with its own Gherkin examples.

## Requirements

- Node.js >= 20
- A [webship-js](https://www.npmjs.com/package/webship-js) 2.x test project
- A Drupal CMS 2.x site to test against (any site template; the Canvas steps need the `canvas` module, which the Starter site template installs)

## Installation

```bash
npm install --save-dev webship-js @webship-js/drupal-cms-steps
```

That is the whole install: this pack depends on [`@webship-js/drupal-core-steps`](https://www.npmjs.com/package/@webship-js/drupal-core-steps) and loads its steps itself, so a Drupal CMS project installs **one** Drupal step pack and lists **two** step sources in `cucumber.js`, in this order:

```javascript
module.exports = {
  default: {
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',                   // webship-js core steps
      'node_modules/@webship-js/drupal-cms-steps/tests/step-definitions/**/*.js', // this pack, which brings the Drupal core pack along
      'tests/step-definitions/**/*.js',                                           // your own custom steps, if any
    ],
    paths: ['tests/features/**/*.feature'],
    worldParameters: {
      launchUrl: process.env.LAUNCH_URL || 'https://your-drupal-cms-site.example',
      // ... the settings below
    },
  },
};
```

A project that also lists the core pack's own glob keeps working (Node loads a file once). Run `npx cucumber-js --dry-run` once after wiring the sources: it reports any undefined or ambiguous step before a browser is opened.

## Settings

Everything the pack and the core pack read lives under `worldParameters` in `cucumber.js`. The block below is what this repository runs with and what a new project copies; every value has an environment variable so nothing site-specific is committed. It is complete on its own: a Drupal CMS project installs this pack and nothing else.

```javascript
worldParameters: {
  launchUrl: process.env.LAUNCH_URL || process.env.DDEV_PRIMARY_URL || 'http://localhost:8080',

  // The site template the site was installed with, and the add-on recipes applied on top
  // (see "Site templates"); the scenarios that need another one skip.
  siteTemplate: process.env.DRUPAL_SITE_TEMPLATE || 'drupal_cms_starter',
  recipes: (process.env.DRUPAL_CMS_RECIPES || '').split(',').map((r) => r.trim()).filter(Boolean),

  blockThirdPartyRequests: process.env.ALLOW_THIRD_PARTY_REQUESTS !== '1', // keep runs hermetic (tagify loads from a CDN)
  acceptCookieConsent: process.env.KEEP_COOKIE_CONSENT !== '1',           // pre-accept the Klaro consent dialog

  // The accounts `Given I am a logged in user with the "<handle>" user` logs in as. The script
  // that builds the site creates them; no feature creates or deletes a user.
  users: {
    admin:            { username: process.env.DRUPAL_ADMIN_USER || 'admin', password: process.env.DRUPAL_ADMIN_PASS || 'admin', email: process.env.DRUPAL_ADMIN_MAIL || 'admin@example.com', isAdmin: true },
    'content editor': { username: process.env.DRUPAL_EDITOR_USER || 'content_editor', password: process.env.DRUPAL_EDITOR_PASS || 'content_editor', email: process.env.DRUPAL_EDITOR_MAIL || 'content_editor@example.com', roles: ['content_editor'] },
    authenticated:    { username: process.env.DRUPAL_AUTHENTICATED_USER || 'authenticated', password: process.env.DRUPAL_AUTHENTICATED_PASS || 'authenticated', email: process.env.DRUPAL_AUTHENTICATED_MAIL || 'authenticated@example.com', roles: [] },
    anonymous:        { name: process.env.DRUPAL_ANONYMOUS_NAME || 'Webship QA', email: process.env.DRUPAL_ANONYMOUS_EMAIL || 'qa@example.com' },
  },

  minWaitTime: { page: parseInt(process.env.WEBSHIP_PAGE_WAIT || '3000', 10), before_scenario: 0, after_scenario: 0, before_step: 0, after_step: 0 },

  selectors: {
    css: {}, xpath: {},            // your own names win over the two presets
    filesPath: './tests/selectors/', files: [],
    offset: 60,
    breakpoints: { xs: { width: 375, height: 667 }, sm: { width: 576, height: 800 }, md: { width: 768, height: 1024 },
                   lg: { width: 992, height: 768 }, xl: { width: 1200, height: 900, default: true },
                   xxl: { width: 1400, height: 900 }, xxxl: { width: 1920, height: 1080 } },
  },

  screenshot: { dir: './screenshots', purge: false, onFailed: true, onEveryStep: false, alwaysFullscreen: false,
                failedPrefix: 'failed_', filenamePattern: '{datetime}.{feature_file}.feature_{step_line}.{ext}',
                filenamePatternFailed: '{failed_prefix}{datetime}.{feature_file}.feature_{step_line}.{ext}', infoTypes: '' },
  video: { mode: process.env.WEBSHIP_VIDEO || 'off', dir: './videos', size: { width: 1280, height: 720 },
           filenamePattern: '{datetime}.{feature_file}.{scenario}.{status}.{ext}' },
  javascript: { mode: process.env.WEBSHIP_JS_ERROR_MODE || 'warn', levels: ['error'], ignore: '', beforeScenario: false, afterScenario: true },
}
```

| Variable | Default | Used for |
| --- | --- | --- |
| `LAUNCH_URL` | `DDEV_PRIMARY_URL`, then `http://localhost:8080` | the site under test |
| `DRUPAL_SITE_TEMPLATE` / `DRUPAL_CMS_RECIPES` | `drupal_cms_starter` / none | what the site was installed with (see "Site templates") |
| `DRUPAL_ADMIN_USER` / `DRUPAL_ADMIN_PASS` / `DRUPAL_ADMIN_MAIL` | `admin` / `admin` / `admin@example.com` | the `admin` handle (the installer's account) |
| `DRUPAL_EDITOR_USER` / `DRUPAL_EDITOR_PASS` / `DRUPAL_EDITOR_MAIL` | `content_editor` / `content_editor` / `content_editor@example.com` | the `content editor` handle (Drupal CMS creates the role but no user; the install script creates one) |
| `DRUPAL_AUTHENTICATED_USER` / `DRUPAL_AUTHENTICATED_PASS` / `DRUPAL_AUTHENTICATED_MAIL` | `authenticated` / `authenticated` / `authenticated@example.com` | the `authenticated` handle, an account with no role |
| `DRUPAL_ANONYMOUS_NAME` / `DRUPAL_ANONYMOUS_EMAIL` | `Webship QA` / `qa@example.com` | what an anonymous visitor types into a contact form |
| `ALLOW_THIRD_PARTY_REQUESTS=1` | off | let cross-origin requests through |
| `KEEP_COOKIE_CONSENT=1` | off | show the cookie consent dialog instead of pre-accepting it |
| `WEBSHIP_PAGE_WAIT` | `3000` | the settle budget per page; `8000` is the safer value for the Gin admin and the Canvas editor on a slow runner |
| `WEBSHIP_STEP_TIMEOUT` | `45000` | the step timeout (a `timeout` key in cucumber.js is ignored: webship-js sets it when it loads) |
| `HEADLESS` / `SLOW_MO` | `true` / `300` (`800` when headed) | `playwright.config.ts`; `npm run test:headed` sets `HEADLESS=false` |
| `CUCUMBER_TAGS` / `FEATURES` | `not @wip and not @auth-setup` / all features | the lane to run, a subset of feature files |
| `WEBSHIP_VIDEO`, `WEBSHIP_JS_ERROR_MODE`, `WEBSHIP_SCREENSHOT_*`, `WEBSHIP_SELECTORS_*` | see the block above | webship-js's own switches |

### Users registry

Accounts are configuration, not test data. The script that builds the site creates them, the `users` registry names them, and no feature creates or deletes a user. A suite that makes its own accounts cannot run against a site where it may not, and leaves accounts behind when it fails.

| Handle | Account | Created by |
| --- | --- | --- |
| `admin` | the administrator (`isAdmin: true`) | the Drupal CMS installer |
| `content editor` | a user with the Content editor role | `scripts/install-site-template.sh` (Drupal CMS creates the role, but no user for it) |
| `authenticated` | a user with no role | `scripts/install-site-template.sh` |
| `anonymous` | not an account: the name and email a visitor types into a form | |

`Given I am a logged in user with the "content editor" user` (a core pack step) reads the registry and logs in; the login is verified, so a refused login fails with the message of the site. `When I log in with the email address of "content editor"` reads the `email` key. For a site of your own, create the accounts once (`drush user:create`, then `drush user:role:add`), or point the handles at accounts that exist, through the environment variables above.

### Named selectors

webship-js's named-selector steps (`Then I see visible <name>`, `Then I don't see <name>`, `When I click on <name>`) read names from a registry. Two presets are merged into every scenario, the core pack's for core's markup (`status message`, `page title`, `breadcrumb`, `navigation sidebar`, `save button`, `details`, `ajax throbber`, `media library dialog`, ...) and this pack's [`tests/selectors/drupal-cms.json`](tests/selectors/drupal-cms.json) for what Drupal CMS adds: the Gin admin theme (`header bar`, `sidebar`, `sticky form actions`, `sticky save button`, `more actions`, `dark mode toggle`, `edit form`, `confirm form`, `breadcrumb back`, `message item`), the `dashboard` and `dashboard section`, the Canvas editor (`canvas editor frame`, `canvas side menu`, `canvas topbar`, `canvas primary panel`, `canvas contextual panel`, `canvas library button`, `canvas layers button`, `canvas components library`, `canvas patterns library`, `canvas library search`, `canvas first component`, `canvas publish button`) and the consent dialog (`cookie consent dialog`, `cookie consent accept`, `cookie consent decline`). A name you define in `worldParameters.selectors` or load from `files` wins over both.

```gherkin
Given I am a logged in user with the "admin" user
And I am on the dashboard
Then I see visible dashboard, sidebar
```

## Site templates

A Drupal CMS site is installed from a **site template** (a "Site" recipe the installer applies: Starter, Blank, or one from the [catalogue](https://new.drupal.org/browse/site-templates)) and may get **add-on recipes** afterwards (Forms, Search, SEO tools, Accessibility tools, ...). The pack supports both halves of testing them.

**Installing.** `scripts/install-site-template.sh` installs the fixture site with any template and any add-on recipes, which is what CI runs in a matrix (Starter; Starter with Forms and Search; Blank):

```bash
cd drupal && ddev start && ddev composer create-project drupal/cms --no-interaction && cd ..
DRUPAL_SITE_TEMPLATE=drupal_cms_starter DRUPAL_CMS_RECIPES=drupal_cms_forms,drupal_cms_search bash scripts/install-site-template.sh
# A template that is not part of drupal/cms is required first:
DRUPAL_SITE_TEMPLATE=drupal_cms_blank DRUPAL_SITE_TEMPLATE_PACKAGE=drupal/drupal_cms_blank bash scripts/install-site-template.sh
# Your own template, from its Composer package:
DRUPAL_SITE_TEMPLATE=my_site DRUPAL_SITE_TEMPLATE_PACKAGE=drupal/my_site bash scripts/install-site-template.sh
```

The script runs the installer non-interactively with the template as the form value (`drush site:install drupal_cms_installer installer_site_template_form.add_ons=<template>`), requires and applies each add-on recipe (`drush recipe`), creates the registry accounts, turns the telemetry prompt off, and gives the consent manager something to ask about (the fixture enables one optional Klaro service and the notice, as a site with analytics would).

**Testing.** A site cannot say which template installed it, so the suite is told: `DRUPAL_SITE_TEMPLATE` and `DRUPAL_CMS_RECIPES` land in `worldParameters.siteTemplate` and `worldParameters.recipes`. A scenario states what it needs, and is skipped (reported as skipped, not failed) on a site that has something else:

```gherkin
Feature: The Starter site template
  Background:
    Given the site template is "drupal_cms_starter"
    And I am a logged in user with the "admin" user

  Scenario: The template installs its modules, theme, roles and content type
    Then the "canvas" module should be installed
    And the default theme should be "Mercury"
    And the "Content editor" role should exist
    And the "Utility page" content type should exist
    And the front page path should be "/home"
    And the "Main navigation" menu should contain "Home"
    And the site should have at least 1 Canvas page

  Scenario: The Forms recipe adds the contact form
    Given the "drupal_cms_forms" recipe is applied
    And I am on "/contact"
    Then I should see the page title "Contact"
```

What a template promises is asserted with the core pack's site structure steps (modules, default theme, roles, menus, front page, content types, canonical URLs) and this pack's Canvas steps; `tests/features/site-template-starter.feature`, `site-template-blank.feature` and `recipes.feature` are the models to copy for a template of your own. `Then the site template should be "..."` restates what the suite was told, for the report.

## Quick example

```gherkin
Feature: Canvas landing page

  Scenario: A heading is published through the Canvas API
    Given I am a logged in user with the "admin" user
    And there is a new Canvas page "Landing" at "/landing"
    When I add the "Heading" component to the bottom of the "Landing" Canvas page and publish it:
      | heading_text | Welcome |
    And I visit the "Landing" Canvas page
    Then I should see "Welcome"
```

More runnable examples: `tests/features/*.feature` in this repo.

## Running this repo's own test suite

This repository is itself a working webship-js project. Its `tests/features/*.feature` files run against a **self-hosted default Drupal CMS 2.x site managed by [DDEV](https://ddev.com/)**, installed non-interactively with `drush site:install drupal_cms_installer`, which applies the "Starter" site template. That template installs Drupal Canvas (the `canvas` module), the Utility page content type with the basic editorial workflow, the dashboard, the Navigation sidebar and top bar, and the starter content (a published Canvas "Home" page and an unpublished "Privacy policy" draft). The only addition is a `content_editor` account, because Drupal CMS creates the Content editor role but no user for it.

| Area | Feature files |
| --- | --- |
| Site templates | `site-template-starter`, `site-template-blank`, `recipes` (each scenario states the template or recipe it needs and is skipped elsewhere; CI runs the Starter template, the Starter with the Forms and Search recipes, and the Blank template) |
| Public pages and login | `home-page`, `login-logout`, `cookie-consent` |
| Administration | `admin-dashboard`, `navigation-toolbar`, `top-bar`, `user-management` |
| Content | `content-management` |
| Drupal Canvas | `canvas` |

The `drupal/` directory holds a committed `.ddev/config.yaml` for this fixture site; the Drupal CMS codebase itself (`web/`, `vendor/`, `composer.json`) is generated fresh by `ddev composer create-project` and gitignored, so every run starts from a clean install.

```bash
cd drupal
ddev start
ddev composer create-project drupal/cms --no-interaction
# drupal/cms scaffolds its own .ddev/config.yaml (no project name, a DDEV
# version constraint): put this project's name back and drop the constraint.
sed -i '/ddev_version_constraint/d' .ddev/config.yaml
ddev config --project-name=drupal-cms-steps-site --project-type=drupal --docroot=web
ddev start -y --reset-database --omit-snapshot   # the scaffold pins a database version; nothing is installed yet
cd ..
# The site template (Starter by default) and any add-on recipes, the accounts of the users
# registry, and the consent manager's notice: see "Site templates".
bash scripts/install-site-template.sh

npm install
npx playwright install --with-deps chromium
LAUNCH_URL=https://drupal-cms-steps-site.ddev.site npm test
```

Against DDEV's HTTPS URL, `cucumber.js` relaxes Node's TLS verification for `*.ddev.site` hosts only, because one webship-js step re-requests the page outside the browser and does not trust the mkcert certificate. The account names and passwords are read from `DRUPAL_ADMIN_USER`, `DRUPAL_ADMIN_PASS`, `DRUPAL_EDITOR_USER`, `DRUPAL_EDITOR_PASS` and `DRUPAL_EDITOR_MAIL` (defaults `admin`/`admin`, `content_editor`/`content_editor`, `content_editor@example.com`).

Drupal CMS ships contrib modules (`tagify`) that load front-end libraries from public CDNs with render-blocking script tags, which makes `/node/add/*` hang on runners without outbound internet access. The suite therefore aborts all cross-origin requests by default; set `ALLOW_THIRD_PARTY_REQUESTS=1` to let them through.

Other scripts:

| Script | Effect |
| --- | --- |
| `npm test` | Full suite, pretty output |
| `npm run test:dry` | `--dry-run`: checks for undefined and ambiguous steps across the three step sources, no browser |
| `npm run test:examples` | No browser: every step's JSDoc carries five `Example #n:` lines that match its own definition and no other (webship-js and the core pack included), and every feature step resolves to exactly one definition (also runs in CI) |
| `npm run test:headed` | Headed browser |
| `npm run test:chromium` / `test:firefox` / `test:webkit` | Pick a browser |

## Continuous integration

[.github/workflows/test.yml](.github/workflows/test.yml) provisions the same default Drupal CMS site with DDEV on the GitHub Actions runner (Starter site template, Canvas included), creates the content editor account, runs the dry run and then the `tests/features/**` suite against it. Cucumber's reports and any failure screenshots are uploaded as build artifacts.

## Publishing

The package is publish-ready: `name`, `version`, `main`, `files`, `repository`, `license` and `publishConfig.access` are set in `package.json`, and `LICENSE` ships with the tarball. It is released to npmjs.com as [`@webship-js/drupal-cms-steps`](https://www.npmjs.com/package/@webship-js/drupal-cms-steps); development happens in this GitHub repository, on the `2.0.x` branch.

## License

[MIT](LICENSE) © Webship.co
