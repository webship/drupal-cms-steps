#!/usr/bin/env bash
# Installs the fixture Drupal CMS site with a site template and, optionally, add-on recipes:
#
#   DRUPAL_SITE_TEMPLATE=drupal_cms_starter DRUPAL_CMS_RECIPES=drupal_cms_forms,drupal_cms_search bash drupal/install-site-template.sh
#
# Run from the repository root with the DDEV project in drupal/ started (see README,
# "Running this repo's own test suite" and "Site templates"). A template that is not part of
# drupal/cms (one from the catalogue, or your own) is required with Composer first when
# DRUPAL_SITE_TEMPLATE_PACKAGE names its package (drupal/<name> by default for a drupal_cms_*
# template is already in the codebase).
set -euo pipefail
cd "$(dirname "$0")"

TEMPLATE="${DRUPAL_SITE_TEMPLATE:-drupal_cms_starter}"
PACKAGE="${DRUPAL_SITE_TEMPLATE_PACKAGE:-}"
RECIPES="${DRUPAL_CMS_RECIPES:-}"
SITE_NAME="${DRUPAL_SITE_NAME:-Drupal CMS Steps}"
ADMIN_USER="${DRUPAL_ADMIN_USER:-admin}"
ADMIN_PASS="${DRUPAL_ADMIN_PASS:-admin}"
EDITOR_USER="${DRUPAL_EDITOR_USER:-content_editor}"
EDITOR_PASS="${DRUPAL_EDITOR_PASS:-content_editor}"
EDITOR_MAIL="${DRUPAL_EDITOR_MAIL:-content_editor@example.com}"
AUTH_USER="${DRUPAL_AUTHENTICATED_USER:-authenticated}"
AUTH_PASS="${DRUPAL_AUTHENTICATED_PASS:-authenticated}"

if [ -n "$PACKAGE" ]; then
  echo "Requiring the site template package $PACKAGE"
  ddev composer require "$PACKAGE" --with-all-dependencies --no-interaction
fi
if [ ! -d "recipes/$TEMPLATE" ] && [ -z "$PACKAGE" ]; then
  echo "The $TEMPLATE site template is not in recipes/; set DRUPAL_SITE_TEMPLATE_PACKAGE to its Composer package." >&2
  exit 1
fi

# The installer applies the chosen template; the form value is the recipe folder name.
# The installer ignores --account-name/--account-pass on some versions: the password is
# set again afterwards.
echo "Installing Drupal CMS with the $TEMPLATE site template"
ddev drush site:install drupal_cms_installer \
  "installer_site_template_form.add_ons=$TEMPLATE" \
  --site-name="$SITE_NAME" \
  --account-name="$ADMIN_USER" --account-pass="$ADMIN_PASS" \
  --yes
ddev drush user:password "$ADMIN_USER" "$ADMIN_PASS" || true

for RECIPE in ${RECIPES//,/ }; do
  if [ ! -d "recipes/$RECIPE" ]; then
    echo "Requiring the $RECIPE recipe"
    ddev composer require "drupal/$RECIPE" --with-all-dependencies --no-interaction
  fi
  echo "Applying the $RECIPE recipe"
  ddev drush cache:rebuild
  ddev drush recipe "/var/www/html/recipes/$RECIPE"
done

# The accounts of the users registry (cucumber.js): Drupal CMS creates the
# Content editor role but no user for it; "authenticated" has no role.
ddev drush user:create "$EDITOR_USER" --mail="$EDITOR_MAIL" --password="$EDITOR_PASS" || true
ddev drush user:role:add content_editor "$EDITOR_USER" || true
ddev drush user:create "$AUTH_USER" --mail="$AUTH_USER@example.com" --password="$AUTH_PASS" || true
# A fresh Drupal CMS has nothing to ask the visitor about: its consent manager
# (Klaro) runs silent with only required services. The fixture switches it to
# a notice and enables one optional service, so the cookie consent steps have a
# dialog to test; both are what a real site does when it adds analytics.
ddev drush config:set klaro.settings dialog_mode notice -y || true
ddev drush php:eval '$a = \Drupal::entityTypeManager()->getStorage("klaro_app")->load("matomo"); if ($a) { $a->setStatus(TRUE)->save(); }' || true
# The telemetry prompt would otherwise take Gin's sticky form actions on the first admin page.
ddev drush state:set drupal_cms_telemetry false --input-format=json || true
ddev drush cache:rebuild
echo "Installed $TEMPLATE${RECIPES:+ with $RECIPES}."
