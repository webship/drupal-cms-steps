# drupal-cms-steps

[![Test](https://github.com/webship/drupal-cms-steps/actions/workflows/test.yml/badge.svg)](https://github.com/webship/drupal-cms-steps/actions/workflows/test.yml)

Drupal CMS specific Cucumber step definitions for [webship-js](https://www.npmjs.com/package/webship-js), a Playwright + Cucumber BDD testing framework. `@webship-js/drupal-cms-steps` covers what [Drupal CMS](https://www.drupal.org/about/drupal-cms) adds on top of a plain Drupal core site: the Navigation sidebar and top bar as Drupal CMS ships them, the dashboard and its sections, the content types a site template installs, the Gin node form, the editorial workflow, email login, and **Drupal Canvas**, both through its editor and through its authoring API.

It is a **plugin for webship-js** and builds on [`@webship-js/drupal-core-steps`](https://www.npmjs.com/package/@webship-js/drupal-core-steps): everything a Drupal core site has (login by user handle, named admin pages, status messages, page titles, breadcrumbs, listings and their operations, the rich text editor, the media library, session-aware HTTP status, cache flushing) comes from the core pack, and element, text, table row, URL and response assertions come from webship-js itself. This pack never duplicates a step either of them already provides.

## What's covered

- **Navigation sidebar**: `the navigation toolbar should list "Pages"`, `the navigation toolbar should not list "People"`, `When I click "Media" in the navigation sidebar`
- **Top bar**: `the top bar should offer the "Edit" action`, `When I open the top bar page actions`, `When I choose the "Revisions" action in the top bar`
- **Dashboard**: `Given I am on the dashboard`, `I should see the dashboard`, `I should see the "Recent content" dashboard section`, `I should not see the "Announcements" dashboard section`
- **Content types and the node form**: `the "Utility page" content type should exist`, `When I save the content` (the Gin sticky Save), `the "Description" field should block submission as required`
- **Editorial workflow**: `the content moderation state should be "Draft"`, `When I change the moderation state to "Published"`; plus the contrib Moderation Sidebar steps (`When I open the moderation sidebar`, `the moderation sidebar should show "Draft"`) for sites that add that module
- **Email login**: `When I log in with the email address of "content editor"` (the Login Email or Username module Drupal CMS ships)
- **Drupal Canvas, API**: `Given there is a new Canvas page "Landing" at "/landing"`, `When I add the "Heading" component to the bottom of the "Landing" Canvas page and publish it:` with a `| prop | value |` table, `When I create a Canvas page "…" at "/…" with the "…" component:`, `When I publish the pending Canvas changes`, `When I delete the "Landing" Canvas page`, `When I visit the "Landing" Canvas page`, `the "Landing" Canvas page should exist`, `the Canvas component library should list the "Heading" component`
- **Drupal Canvas, editor**: `When I open the "Landing" Canvas page in the editor`, `I should see the Canvas editor`, `When I open the "Components" tab in the Canvas Library`, `the Canvas Library "Components" tab should list "Heading"`, `When I insert the "Heading" component from the Canvas Library`, `When I set the Canvas component option "Heading" to "Welcome"`, `When I publish the Canvas page changes through the editor`

Every step accepts the `I` and `we` pronoun forms, and every assertion reads both polarities from one definition. Each step is documented inline in `tests/step-definitions/drupal-cms.steps.js` and `tests/step-definitions/drupal-canvas.steps.js` with its own Gherkin examples.

## Requirements

- Node.js >= 20
- A [webship-js](https://www.npmjs.com/package/webship-js) 2.x test project
- `@webship-js/drupal-core-steps` 2.x
- A Drupal CMS 2.x site to test against (any site template; the Canvas steps need the `canvas` module, which the Starter site template installs)

## Installation

```bash
npm install --save-dev webship-js @webship-js/drupal-core-steps @webship-js/drupal-cms-steps
```

Add the three step sources to your project's `cucumber.js`, in this order: webship-js, then the core pack, then this pack.

```javascript
module.exports = {
  default: {
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',                    // webship-js core steps
      'node_modules/@webship-js/drupal-core-steps/tests/step-definitions/**/*.js', // Drupal core step pack
      'node_modules/@webship-js/drupal-cms-steps/tests/step-definitions/**/*.js',  // this pack
      'tests/step-definitions/**/*.js',                                            // your own custom steps, if any
    ],
    paths: ['tests/features/**/*.feature'],
    worldParameters: {
      launchUrl: process.env.LAUNCH_URL || 'https://your-drupal-cms-site.example',
      users: {
        admin: { username: 'admin', password: process.env.DRUPAL_ADMIN_PASS || 'admin' },
        'content editor': {
          username: 'content_editor',
          password: process.env.DRUPAL_EDITOR_PASS || 'content_editor',
          email: 'content_editor@example.com',
        },
      },
    },
  },
};
```

The `users` registry is what the core pack's `Given I am a logged in user with the "admin" user` step reads; the `email` key is what this pack's email login step reads. Run `npx cucumber-js --dry-run` once after wiring the three sources: it reports any undefined or ambiguous step before a browser is opened.

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
| Public pages and login | `home-page`, `login-logout` |
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
ddev drush site:install drupal_cms_installer --site-name="Drupal CMS Steps" --account-name=admin --account-pass=admin --yes

# Drupal CMS creates the "Content editor" role but no user for it.
ddev drush user:create content_editor --mail="content_editor@example.com" --password="content_editor"
ddev drush user:role:add content_editor content_editor
ddev drush cache:rebuild
# Drupal Canvas comes with the Starter site template; confirm it is enabled.
ddev drush pm:list --status=enabled --type=module --format=list | grep -x canvas
cd ..

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
