// The run configuration of this repository's own suite, and the block a project
// that installs @webship-js/drupal-cms-steps copies into its cucumber.js: the
// `worldParameters` below are the settings the pack (and the core pack it
// brings along) read; see README, "Settings".
//
// Note on `timeout`: webship-js sets the step timeout itself when it loads
// (45 seconds); a `timeout` key here is ignored. Raise or lower it with
// WEBSHIP_STEP_TIMEOUT=<milliseconds>.

// webship-js's "response status code should be" step hits the current page's
// URL directly with axios (bypassing Playwright's ignoreHTTPSErrors), so it
// doesn't trust DDEV's self-signed (mkcert) HTTPS cert. Relax verification
// only for DDEV hosts, not for real HTTPS targets.
const launchUrl = process.env.LAUNCH_URL || process.env.DDEV_PRIMARY_URL || 'http://localhost:8080';
if (/^https:\/\/[^/]*\.ddev\.site(:\d+)?/.test(launchUrl)) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

module.exports = {
  default: {
    requireModule: ['tsx/cjs'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js', // webship-js core step definitions (auto HTML report on exit; disable: WEBSHIP_REPORT_DISABLE=1).
      'tests/step-definitions/**/*.js',                         // This pack. It loads @webship-js/drupal-core-steps itself (a project lists node_modules/@webship-js/drupal-cms-steps/tests/step-definitions/**/*.js instead).
    ],
    // FEATURES=tests/features/canvas.feature,tests/features/home-page.feature runs a subset.
    paths: process.env.FEATURES ? process.env.FEATURES.split(',') : ['tests/features/**/*.feature'],
    // Scenarios marked work-in-progress or auth-state setup stay out of the default run.
    tags: process.env.CUCUMBER_TAGS || 'not @wip and not @auth-setup',
    format: [
      '@cucumber/pretty-formatter',
      'json:tests/reports/cucumber_report.json',
    ],
    formatOptions: {
      theme: {
        'feature keyword': ['bold', 'blue'],
        'feature name': ['blue', 'underline'],
        'feature description': ['blueBright'],
        'scenario keyword': ['bold', 'magenta'],
        'scenario name': ['magenta', 'underline'],
        'step keyword': ['bold', 'green'],
        'step text': ['greenBright', 'italic'],
      },
    },
    worldParameters: {
      launchUrl,

      // ---------------------------------------------------------------------
      // The site template the fixture site was installed with, and the add-on
      // recipes applied on top of it (DRUPAL_SITE_TEMPLATE, DRUPAL_CMS_RECIPES,
      // comma separated). The steps "the site template is ..." and "the ...
      // recipe is applied" read them and skip a scenario that needs another
      // template or recipe; see README, "Site templates".
      // ---------------------------------------------------------------------
      siteTemplate: process.env.DRUPAL_SITE_TEMPLATE || 'drupal_cms_starter',
      recipes: (process.env.DRUPAL_CMS_RECIPES || '').split(',').map((r) => r.trim()).filter(Boolean),

      // Drupal CMS ships contrib modules (tagify) that pull front-end
      // libraries from public CDNs with render-blocking script tags. Aborting
      // every cross-origin request keeps runs hermetic and stops /node/add/*
      // from hanging on runners without outbound internet access. Set to false
      // to let third-party assets through.
      blockThirdPartyRequests: process.env.ALLOW_THIRD_PARTY_REQUESTS !== '1',

      // Accept the cookie consent dialog (Klaro, which Drupal CMS ships) before
      // every scenario, so it never covers what a scenario clicks. Set to false
      // to see the dialog, and use the cookie consent steps instead.
      acceptCookieConsent: process.env.KEEP_COOKIE_CONSENT !== '1',

      // ---------------------------------------------------------------------
      // Users registry: the accounts "I am a logged in user with the "<handle>"
      // user" logs in as, with the roles "I add the testing users" grants when
      // it creates them. Drupal CMS creates the Content editor role but no
      // user for it; "authenticated" is an account with no role at all. Every
      // value comes from the environment so no credential lives in a feature
      // file or in version control.
      // ---------------------------------------------------------------------
      users: {
        admin: {
          username: process.env.DRUPAL_ADMIN_USER || 'admin',
          password: process.env.DRUPAL_ADMIN_PASS || 'admin',
          email: process.env.DRUPAL_ADMIN_MAIL || 'admin@example.com',
          isAdmin: true,
        },
        'content editor': {
          username: process.env.DRUPAL_EDITOR_USER || 'content_editor',
          password: process.env.DRUPAL_EDITOR_PASS || 'content_editor',
          email: process.env.DRUPAL_EDITOR_MAIL || 'content_editor@example.com',
          roles: ['content_editor'],
        },
        authenticated: {
          username: process.env.DRUPAL_AUTHENTICATED_USER || 'authenticated',
          password: process.env.DRUPAL_AUTHENTICATED_PASS || 'authenticated',
          email: process.env.DRUPAL_AUTHENTICATED_MAIL || 'authenticated@example.com',
          roles: [],
        },
        // Not an account: what an anonymous visitor types into a contact form.
        anonymous: {
          name: process.env.DRUPAL_ANONYMOUS_NAME || 'Webship QA',
          email: process.env.DRUPAL_ANONYMOUS_EMAIL || 'qa@example.com',
        },
      },

      // How long a page gets to settle after a navigation (milliseconds). The
      // Gin admin theme and the Canvas editor are heavier than Claro: 3000 is
      // enough for the suite here, 8000 is the safer value on a slow runner.
      minWaitTime: {
        page: parseInt(process.env.WEBSHIP_PAGE_WAIT || '3000', 10),
        before_scenario: 0,
        after_scenario: 0,
        before_step: 0,
        after_step: 0,
      },

      // ---------------------------------------------------------------------
      // Named selectors. The core pack merges its preset for core's markup and
      // this pack adds tests/selectors/drupal-cms.json (the Gin admin theme,
      // the top bar, the dashboard, the Canvas editor, the cookie consent
      // dialog) into every scenario. Names set here, or loaded from `files`,
      // win over both presets.
      // ---------------------------------------------------------------------
      selectors: {
        css: {},
        xpath: {},
        filesPath: './tests/selectors/',
        files: [],
        offset: 60,                                  // WEBSHIP_SELECTORS_OFFSET
        breakpoints: {                               // WEBSHIP_SELECTORS_BREAKPOINTS (JSON)
          xs:   { width: 375,  height: 667  },
          sm:   { width: 576,  height: 800  },
          md:   { width: 768,  height: 1024 },
          lg:   { width: 992,  height: 768  },
          xl:   { width: 1200, height: 900, default: true },
          xxl:  { width: 1400, height: 900  },
          xxxl: { width: 1920, height: 1080 },
        },
      },

      screenshot: {
        dir: './screenshots',                        // WEBSHIP_SCREENSHOT_DIR
        purge: false,                                // WEBSHIP_SCREENSHOT_PURGE
        onFailed: true,                              // WEBSHIP_SCREENSHOT_ON_FAILED
        onEveryStep: false,                          // WEBSHIP_SCREENSHOT_ON_EVERY_STEP
        alwaysFullscreen: false,                     // WEBSHIP_SCREENSHOT_FULLSCREEN
        failedPrefix: 'failed_',                     // WEBSHIP_SCREENSHOT_FAILED_PREFIX
        filenamePattern: '{datetime}.{feature_file}.feature_{step_line}.{ext}',
        filenamePatternFailed: '{failed_prefix}{datetime}.{feature_file}.feature_{step_line}.{ext}',
        infoTypes: '',                               // WEBSHIP_SCREENSHOT_INFO_TYPES
      },

      // Video of the browser: 'off', 'on', 'on-failure' or 'tag' (@video / @no-video).
      video: {
        mode: process.env.WEBSHIP_VIDEO || 'off',
        dir: './videos',                             // WEBSHIP_VIDEO_DIR
        size: { width: 1280, height: 720 },
        filenamePattern: '{datetime}.{feature_file}.{scenario}.{status}.{ext}',
      },

      // JavaScript errors the page raises: 'warn' reports them, 'fail' fails the
      // scenario, 'off' ignores them; @js-fail, @js-warn and @js-off per scenario.
      javascript: {
        mode: process.env.WEBSHIP_JS_ERROR_MODE || 'warn',
        levels: ['error'],                           // WEBSHIP_JS_ERROR_LEVELS (csv)
        ignore: '',                                  // WEBSHIP_JS_ERROR_IGNORE (regex)
        beforeScenario: false,                       // WEBSHIP_JS_ERROR_BEFORE
        afterScenario: true,                         // WEBSHIP_JS_ERROR_AFTER
      },

      // Diffy visual-regression (optional). Uncomment and set apiKey / projectId to enable.
      // diffy: {
      //   apiKey: '',                                 // DIFFY_API_KEY
      //   projectId: 0,                               // DIFFY_PROJECT_ID
      //   breakpoints: '640,1200',                    // DIFFY_BREAKPOINTS
      //   windowHeight: 2000,                         // DIFFY_WINDOW_HEIGHT
      //   screenshotsDir: '',                         // DIFFY_SCREENSHOTS_DIR
      //   baseUrl: 'https://app.diffy.website/api/',  // DIFFY_API_BASE_URL
      //   maxWait: 30,                                // DIFFY_MAX_WAIT (seconds)
      //   env1Url: '',                                // DIFFY_ENV1_URL
      //   env2Url: '',                                // DIFFY_ENV2_URL
      // },
    },
  },
};
