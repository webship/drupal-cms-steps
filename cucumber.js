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
    timeout: 60000,
    requireModule: ['tsx/cjs'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',                    // webship-js core step definitions (auto HTML report on exit; disable: WEBSHIP_REPORT_DISABLE=1).
      'node_modules/@webship-js/drupal-core-steps/tests/step-definitions/**/*.js', // Drupal core step pack (login, named pages, messages, listings, editor, media library, ...).
      'tests/step-definitions/**/*.js',                                            // This pack: Drupal CMS specific steps (Navigation toolbar, dashboard, Canvas, ...).
    ],
    paths: ['tests/features/**/*.feature'],
    format: [
      '@cucumber/pretty-formatter',
      'json:tests/reports/cucumber_report.json',
    ],
    formatOptions: {
      colorsEnabled: true,
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
      launchUrl: process.env.LAUNCH_URL || process.env.DDEV_PRIMARY_URL || 'http://localhost:8080',
      minWaitTime: {
        page: 3000,
        before_scenario: 0,
        after_scenario: 0,
        before_step: 0,
        after_step: 0,
      },
      // Drupal CMS ships contrib modules (tagify) that pull front-end
      // libraries from public CDNs with render-blocking script tags. Aborting
      // every cross-origin request keeps runs hermetic and stops /node/add/*
      // from hanging on runners without outbound internet access. Set to false
      // to let third-party assets through.
      blockThirdPartyRequests: process.env.ALLOW_THIRD_PARTY_REQUESTS !== '1',
      // Accounts the core pack's "I am a logged in user with the "<handle>"
      // user" step can log in as. Keys are the handles feature files use;
      // each entry holds the real username and password (and an email for the
      // email login step). Override with DRUPAL_ADMIN_USER / DRUPAL_ADMIN_PASS
      // / DRUPAL_EDITOR_USER / DRUPAL_EDITOR_PASS / DRUPAL_EDITOR_MAIL.
      users: {
        admin: {
          username: process.env.DRUPAL_ADMIN_USER || 'admin',
          password: process.env.DRUPAL_ADMIN_PASS || 'admin',
        },
        'content editor': {
          username: process.env.DRUPAL_EDITOR_USER || 'content_editor',
          password: process.env.DRUPAL_EDITOR_PASS || 'content_editor',
          email: process.env.DRUPAL_EDITOR_MAIL || 'content_editor@example.com',
        },
      },
      selectors: {
        css: {},
        xpath: {},
        filesPath: './tests/selectors/',
        files: [],
        offset: 60,
        breakpoints: {
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
        dir: './screenshots',
        purge: false,
        onFailed: true,
        onEveryStep: false,
        alwaysFullscreen: false,
        failedPrefix: 'failed_',
        filenamePattern: '{datetime}.{feature_file}.feature_{step_line}.{ext}',
        filenamePatternFailed: '{failed_prefix}{datetime}.{feature_file}.feature_{step_line}.{ext}',
        infoTypes: '',
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
