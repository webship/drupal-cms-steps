# drupal-cms-steps

A [webship-js](https://www.npmjs.com/package/webship-js) test project for
testing an external [Drupal CMS](https://www.drupal.org/about/drupal-cms)
site: login/logout, the core Navigation admin toolbar, the admin dashboard,
content management, and user management.

This is a standalone test project, not a published npm package. It uses
webship-js's standard layout:

- `tests/step-definitions/drupal-cms.steps.js` — custom `Given`/`When`/`Then`
  steps for Drupal CMS's admin UI
- `tests/features/*.feature` — the Gherkin scenarios that exercise them
- `cucumber.js` — wires webship-js's core steps and this project's steps
  together and points at the site under test

## Install

```bash
npm install
npx playwright install --with-deps chromium
```

## Configure

Point the suite at the Drupal CMS site you want to test with the `LAUNCH_URL`
environment variable (falls back to `DDEV_PRIMARY_URL` if you're running
against a local [DDEV](https://ddev.com) site, then `http://localhost:8080`):

```bash
LAUNCH_URL=https://example.com npm test
```

Admin/editor test-account credentials are configurable via
`DRUPAL_ADMIN_USER` / `DRUPAL_ADMIN_PASS` / `DRUPAL_EDITOR_USER` /
`DRUPAL_EDITOR_PASS` / `DRUPAL_EDITOR_MAIL` (see `cucumber.js`).

### Site prerequisites

The scenarios assert against a **default Drupal CMS 1.x install** (the
`drupal_cms_installer` profile, which applies the `drupal_cms_starter`
recipe), so the site is expected to have:

> Drupal CMS 2.0 (released 2026-01-27) restructured content types (e.g.
> `page` is now "Utility page") and the homepage layout, so `composer
> create-project drupal/cms` must be pinned to `:^1.0` — see the CI workflow
> and the local setup below.

- the starter content — a published `Home` page and an unpublished
  `Privacy policy` draft
- the `Basic page` content type (`/node/add/page`) with its required
  `Description` field
- the `Content editor` role
- a `content_editor` user holding that role (Drupal CMS does not create one,
  so provision it yourself — see below)

### Third-party requests

Drupal CMS ships contrib modules (`tagify`) that load front-end libraries from
public CDNs with render-blocking `<script>` tags, which makes `/node/add/*`
hang on runners without outbound internet access. The suite therefore aborts
all cross-origin requests by default. Set `ALLOW_THIRD_PARTY_REQUESTS=1` to
let them through.

## Run

```bash
npm test              # BROWSER=chromium
npm run test:firefox
npm run test:webkit
```

## Testing against a local DDEV site

```bash
mkdir drupal-cms-site && cd drupal-cms-site
ddev config --project-type=drupal11 --docroot=web --project-name=drupal-cms-site
ddev start
ddev composer create-project drupal/cms:^1.0
ddev composer require drush/drush
ddev drush site:install drupal_cms_installer --account-name=admin --account-pass=admin --yes

# Drupal CMS creates the "Content editor" role but no user for it.
ddev drush user:create content_editor --mail="content_editor@example.com" --password="content_editor"
ddev drush user:role:add content_editor content_editor
cd ..
npm test
```

`cucumber.js` picks up `DDEV_PRIMARY_URL` automatically, so no `LAUNCH_URL`
override is needed when DDEV is running. If your DDEV project serves HTTPS
(a `*.ddev.site` URL), `cucumber.js` also relaxes Node's TLS verification for
that host only, since webship-js's status-code step hits the site directly
with axios, which doesn't trust DDEV's self-signed (mkcert) certificate.

## Continuous integration

[.github/workflows/test.yml](.github/workflows/test.yml) provisions a default
Drupal CMS site with DDEV on the GitHub Actions runner, creates an admin and
a content-editor test user, then runs the `tests/features/**` suite against
it. Cucumber's HTML report and any failure screenshots are uploaded as build
artifacts.

## License

[MIT](LICENSE) © Webship.co
