Feature: Recommended add-ons
  As a site builder
  I want the add-on recipes of Drupal CMS read from the site itself
  So that the suite and the site agree on which recipes are applied

  Background:
    Given the site template is "drupal_cms_starter"
    And I am a logged in user with the "admin" user

  Scenario: Project Browser offers the add-ons of Drupal CMS
    Given I am on the recommended add-ons page
    Then I should see the page title "Browse projects"
    And the recommended add-ons should list "Accessibility Tools"
    And the recommended add-ons should list "AI Assistant"
    And the recommended add-ons should list "Forms"
    And the recommended add-ons should list "Google Analytics"
    And the recommended add-ons should list "Multilingual"
    And the recommended add-ons should list "drupal_cms_search"
    And the recommended add-ons should not list "Commerce"

  Scenario: The installed add-ons are the recipes the suite was told about
    Then the installed add-ons should match the recipes of the suite

  # The fixture never applies these, on any lane of the matrix.
  Scenario: Add-ons that were not applied are offered for installation
    Then the "AI Assistant" add-on should not be installed
    And the "Multilingual" add-on should not be installed
    And the "drupal_cms_google_analytics" add-on should not be installed

  Scenario: The Forms add-on is shown as installed
    Given the "drupal_cms_forms" recipe is applied
    Then the "Forms" add-on should be installed

  Scenario: The Search add-on is shown as installed
    Given the "drupal_cms_search" recipe is applied
    Then the "Search" add-on should be installed
    And the "drupal_cms_search" add-on should be installed

  Scenario: The content editor cannot browse add-ons
    Given I am a logged in user with the "content editor" user
    And I am on "/admin/modules/browse/recommended"
    Then the page should return HTTP status 403
    And I should be on the access denied page
