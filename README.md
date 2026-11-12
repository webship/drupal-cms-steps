# drupal-cms-steps

[![Test](https://github.com/webship/drupal-cms-steps/actions/workflows/test.yml/badge.svg)](https://github.com/webship/drupal-cms-steps/actions/workflows/test.yml)

Cucumber step definitions for [Drupal CMS](https://www.drupal.org/about/drupal-cms), a plugin for [webship-js](https://www.npmjs.com/package/webship-js) (Playwright and Cucumber). `@webship-js/drupal-cms-steps` covers what Drupal CMS adds to a Drupal core site: the dashboard, the Gin administration theme, **Drupal Canvas** (the editor and its authoring API), the trash, the consent manager (Klaro), the recommended add-ons of Project Browser, the Forms and Search recipes, scheduling, the editorial workflow and redirects, and the site template a site was installed from.

It builds on [`@webship-js/drupal-core-steps`](https://www.npmjs.com/package/@webship-js/drupal-core-steps) and loads it: login by user handle, named administration pages, status messages, page titles, listings and their operations, the rich text editor, the media library, access control, the Navigation sidebar and the top bar, content moderation, meta tags and the accessibility audit come from the core pack and from webship-js. This pack never repeats a step either of them provides.

Every step in this pack was written against a real Drupal CMS 2.x site and runs against one in CI (see "Running this repository's own suite"); no step is proven on a mock page.

## What is covered

- **Dashboard**: `Given I am on the dashboard`, `I should see the dashboard`, `I should see the "Recent content" dashboard section`.
- **Drupal Canvas, the life of a page in the editor**: `When I add a Canvas page from the Pages listing`, `When I set the Canvas page "Title" to "Landing"`, `When I set the Canvas page "URL alias" to "/landing"`, `the Canvas editor should show the page as "Draft"`, `the Canvas editor should have 1 pending change`, `the Canvas preview should show "Welcome"`, `When I publish the Canvas page changes through the editor`, `publishing the Canvas page changes through the editor should fail with "is already in use"`, `When I discard the pending Canvas changes`, `When I delete the "Landing" page from the Canvas page list`.
- **Drupal Canvas, panels, components and patterns**: `When I open the "Layers" panel in the Canvas editor`, `the Canvas "Templates" panel should list "Full content template"`, `When I open the "Components" tab in the Canvas Library`, `When I filter the Canvas Library by "Heading"`, `When I insert the "Heading" component from the Canvas Library`, `When I set the Canvas component option "Heading" to "Welcome"`, `When I select the "Heading" component in the Canvas Layers`, `When I duplicate the "Heading" component in the Canvas Layers`, `When I save the "Heading" component as the Canvas pattern "Page heading"`, `When I delete the "Page heading" Canvas pattern`, `When I open the "Full content template" template in the Canvas editor`, `the Canvas editor should be editing "Utility page - Full content template"`.
- **Drupal Canvas, media**: `When I open the media library of the Canvas component option "Image"`, `When I upload "tests/fixtures/sample.png" to the media library with the alternative text "A blue sample image"`, `the Canvas component option "Image" should hold the media "sample.png"`.
- **Drupal Canvas, authoring API** (fast setup and checks, no editor): `Given there is a new Canvas page "Landing" at "/landing"`, `When I add the "Heading" component to the bottom of the "Landing" Canvas page and publish it:` with a `| prop | value |` table, `When I create a Canvas page "..." at "/..." with the "..." component:`, `When I publish the pending Canvas changes`, `When I delete the "Landing" Canvas page`, `When I visit the "Landing" Canvas page`, `the "Landing" Canvas page should exist`, `the "Landing" Canvas page should have 2 components`, `the Canvas component library should list the "Heading" component`, `the Canvas pattern library should list the "Page heading" pattern`.
- **Trash**: `Given I am on the Canvas pages trash`, `the content trash should hold "Old page"`, `When I restore "Old page" from the content trash`, `When I purge "Landing" from the Canvas pages trash`.
- **Cookie consent** (Klaro): the suite accepts the consent before every scenario (`acceptCookieConsent`); `the cookie consent is not given yet`, `I should see the cookie consent dialog`, `When I accept the cookie consent`, `When I decline the cookie consent`, `When I open the consent settings`, `When I allow the "Matomo" service in the consent settings`, `When I save the consent settings`, `the consent for the "matomo" service should be given`, `the cookie consent should be stored`.
- **Privacy settings of the site**: `the consent dialog mode should be "notice"`, `When I set the consent dialog mode to "silent"`, `the "Matomo" consent service should be enabled`.
- **Add-ons and recipes**: `Given the "drupal_cms_forms" recipe is applied` (runs a scenario only where the recipe is applied), `Given I am on the recommended add-ons page`, `the "Forms" add-on should be installed`, `the recommended add-ons should list "AI Assistant"`, `the installed add-ons should match the recipes of the suite`.
- **Forms** (the Forms recipe): `When I pass the spam protection of the form`, `I should see the form confirmation "Thanks for contacting us!"`, `the "Contact" form should have 1 submission`, `When I clear the submissions of the "Contact" form`.
- **Editorial tools**: `When I schedule the content to be published on "2031-01-15" at "09:30"`, `the scheduled content should list "Spring campaign"`, `the "Basic" workflow should have the "Draft" state`, `When I add a redirect from "old-address" to "/home"`, `the path "/old-address" should redirect to "/home"`, `When I delete the redirect from "old-address"`.
- **Site templates**: `Given the site template is "drupal_cms_starter"` (runs a scenario only on a site installed from that template), `the site template should be "..."`, `the site should have at least 1 Canvas page`; `scripts/install-site-template.sh` installs the fixture with any template and recipes.
- **Email login**: `When I log in with the email address of "content editor"`.

Every step accepts the `I` and `we` forms, and an assertion reads both polarities ("should" and "should not") from one definition. Each step is documented above its definition in `tests/step-definitions/` with five Gherkin examples; `npm run test:examples` checks them.

A scenario that creates content removes it again: a deleted page stays in the trash with its URL alias, so the features of this repository purge what they delete, and a suite that follows them leaves the site as it found it.

## Requirements

- Node.js >= 20
- A [webship-js](https://www.npmjs.com/package/webship-js) 2.x test project
- A Drupal CMS 2.x site to test against (any site template; the Canvas steps need the `canvas` module, which the Starter site template installs)

## Installation

```bash
npm install --save-dev webship-js @webship-js/drupal-cms-steps
```

That is the whole installation: this pack depends on [`@webship-js/drupal-core-steps`](https://www.npmjs.com/package/@webship-js/drupal-core-steps) and loads its steps itself, so a Drupal CMS project installs **one** Drupal step pack and lists **two** step sources in `cucumber.js`, in this order:

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

A project that also lists the glob of the core pack keeps working (Node.js loads a file once). Run `npx cucumber-js --dry-run` once after the sources are in place: it reports every undefined or ambiguous step before a browser opens.

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
  acceptCookieConsent: process.env.KEEP_COOKIE_CONSENT !== '1',           // accept the Klaro consent dialog up front
  formTimeLimit: parseInt(process.env.DRUPAL_FORM_TIME_LIMIT || '5', 10), // seconds Honeypot wants before a form is submitted

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
| `KEEP_COOKIE_CONSENT=1` | off | show the cookie consent dialog instead of accepting it up front |
| `DRUPAL_FORM_TIME_LIMIT` | `5` | the seconds Honeypot wants before a form is submitted (`0` for none) |
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

The named selector steps of webship-js (`Then I see visible <name>`, `Then I don't see <name>`, `When I click on <name>`) read names from a registry. Two presets are merged into every scenario: the core pack's, for the markup of Drupal core, and [`tests/selectors/drupal-cms.json`](tests/selectors/drupal-cms.json) of this pack, for what Drupal CMS adds. Every name in the preset matches the markup of Drupal CMS 2.x:

| Area | Names |
| --- | --- |
| Gin and the top bar | `header bar`, `top bar title`, `top bar status`, `more actions`, `more actions menu`, `sidebar`, `sidebar toggle`, `edit form`, `meta sidebar`, `meta sidebar toggle`, `confirm form`, `sticky form actions`, `sticky save button`, `message item` |
| Dashboard and add-ons | `dashboard`, `dashboard section`, `add-on` |
| Forms | `form confirmation`, `spam protection` |
| Canvas editor | `canvas editor frame`, `canvas preview`, `canvas side menu`, `canvas topbar`, `canvas primary panel`, `canvas contextual panel`, `canvas page data panel`, `canvas page data form`, `canvas component form`, `canvas library button`, `canvas layers button`, `canvas pages button`, `canvas templates button`, `canvas components library`, `canvas patterns library`, `canvas library search`, `canvas page list`, `canvas layer`, `canvas publish button`, `canvas review list` |
| Consent | `cookie consent dialog`, `cookie consent notice`, `cookie consent settings dialog`, `cookie consent accept`, `cookie consent decline`, `cookie consent settings`, `privacy settings link` |

A name you define in `worldParameters.selectors`, or load from `files`, wins over both presets.

```gherkin
Given I am a logged in user with the "admin" user
And I am adding a "page"
Then I see visible sticky form actions, sticky save button, meta sidebar
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
    And I am on "/form/contact-form"
    Then I should see the page title "Contact"
```

What a template promises is asserted with the core pack's site structure steps (modules, default theme, roles, menus, front page, content types, canonical URLs) and this pack's Canvas steps; `tests/features/site-template-starter.feature`, `site-template-blank.feature` and `recipes.feature` are the models to copy for a template of your own. `Then the site template should be "..."` restates what the suite was told, for the report.

The recipes are the one part the site can confirm: Project Browser lists the add-on recipes of Drupal CMS with their state under "Extend, Recommended add-ons". `Then the "Forms" add-on should be installed` reads that screen, and `Then the installed add-ons should match the recipes of the suite` fails when `DRUPAL_CMS_RECIPES` names a recipe the site does not have, or leaves out one it has.

## Quick example

```gherkin
Feature: A landing page

  Scenario: An editor builds and publishes a page in Canvas
    Given I am a logged in user with the "admin" user
    When I add a Canvas page from the Pages listing
    And I set the Canvas page "Title" to "Landing"
    And I set the Canvas page "URL alias" to "/landing"
    And I open the "Components" tab in the Canvas Library
    And I insert the "Heading" component from the Canvas Library
    And I set the Canvas component option "Heading" to "Welcome"
    Then the Canvas preview should show "Welcome"
    When I publish the Canvas page changes through the editor
    Then the Canvas editor should show the page as "Published"
    When I visit the "Landing" Canvas page
    Then I should see "Welcome"
    # Leave the site as it was: a deleted page keeps its URL alias in the trash.
    When I delete the "Landing" Canvas page
    And I purge "Landing" from the Canvas pages trash
    Then the Canvas pages trash should not hold "Landing"
```

More examples that run: `tests/features/*.feature` in this repository.

## Running this repository's own suite

This repository is a working webship-js project. Its features run against a **real Drupal CMS 2.x site managed by [DDEV](https://ddev.com/)**, installed without the browser by `drush site:install drupal_cms_installer` with the Starter site template. The template installs Drupal Canvas, the Utility page content type with the Basic editorial workflow, the dashboard, the Navigation sidebar and the top bar, and the starter content (a published Canvas page, "Home", and an unpublished draft, "Privacy policy"). The install script adds the two accounts of the users registry, switches the consent manager to its notice with one optional service, and turns the telemetry prompt off.

| Area | Feature files |
| --- | --- |
| Site templates, add-ons and recipes | `site-template-starter`, `site-template-blank`, `add-ons`, `recipes` (each scenario states the template or recipe it needs and is skipped elsewhere) |
| Public pages and login | `home-page`, `login-logout`, `cookie-consent`, `error-pages`, `seo`, `accessibility` |
| Administration | `admin-dashboard`, `navigation-toolbar`, `top-bar`, `gin`, `user-management` |
| Content | `content-management`, `editorial`, `trash` |
| Drupal Canvas | `canvas`, `canvas-page-lifecycle`, `canvas-library` |

The `drupal/` directory holds a committed `.ddev/config.yaml` for the fixture site. The Drupal CMS codebase (`web/`, `vendor/`, `composer.json`) is created by `ddev composer create-project` and ignored by Git, so every build starts from a clean install.

```bash
cd drupal
ddev start
ddev composer create-project drupal/cms --no-interaction
# drupal/cms writes its own .ddev/config.yaml (no project name, a DDEV version
# constraint): put the name of this project back and drop the constraint.
sed -i '/ddev_version_constraint/d' .ddev/config.yaml
ddev config --project-name=drupal-cms-steps-site --project-type=drupal --docroot=web
ddev start -y --reset-database --omit-snapshot   # the scaffold may configure another database version; nothing is installed yet
cd ..
# The site template (Starter by default), any add-on recipes, the accounts of the
# users registry and the notice of the consent manager: see "Site templates".
bash scripts/install-site-template.sh

npm install
npx playwright install --with-deps chromium
LAUNCH_URL=https://drupal-cms-steps-site.ddev.site npm test
# With the Forms and Search recipes applied to the site:
LAUNCH_URL=https://drupal-cms-steps-site.ddev.site DRUPAL_CMS_RECIPES=drupal_cms_forms,drupal_cms_search npm test
```

A DDEV release older than 1.25 has no `--reset-database` and refuses that `ddev config`: there, add `name: drupal-cms-steps-site` as the first line of `.ddev/config.yaml` instead and run `ddev restart`.

For the DDEV address with HTTPS, `cucumber.js` relaxes the TLS verification of Node.js for `*.ddev.site` hosts only, because one webship-js step requests the page outside the browser and does not trust the local certificate.

Drupal CMS ships modules (Tagify, for one) that load front-end libraries from public CDNs with render-blocking script tags, which makes `/node/add/*` hang where the internet cannot be reached. The suite therefore aborts every cross-origin request; `ALLOW_THIRD_PARTY_REQUESTS=1` lets them through.

| Script | Effect |
| --- | --- |
| `npm test` | The full suite |
| `npm run test:dry` | `--dry-run`: no undefined and no ambiguous step across webship-js, the core pack and this pack; no browser |
| `npm run test:examples` | No browser: every step carries five `Example #n:` lines that match its own definition and no other, and every feature step resolves to exactly one definition |
| `npm run test:headed` | The suite in a visible browser |
| `npm run test:chromium` / `test:firefox` / `test:webkit` | The suite in one browser |

## Continuous integration

[.github/workflows/test.yml](.github/workflows/test.yml) builds the same Drupal CMS site with DDEV on the GitHub Actions runner, three times: the Starter site template, the Starter site template with the Forms and Search recipes, and the Blank site template. Each lane runs the examples check, the dry run and the suite. The Cucumber reports and the screenshots of failures are kept as build artifacts.

## Publishing

The package is released to npmjs.com as [`@webship-js/drupal-cms-steps`](https://www.npmjs.com/package/@webship-js/drupal-cms-steps). Development happens in this repository, on the `2.0.x` branch.

## License

[MIT](LICENSE) © Webship.co
