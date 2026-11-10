Feature: Add-on recipes
  As a site builder
  I want the add-on recipes of Drupal CMS checked once they are applied
  So that a scenario about forms or search runs only where they exist

  # The Forms recipe adds the "Contact" webform, served at /form/contact-form,
  # and the tools to build forms.
  Scenario: The Forms recipe adds the contact form
    Given the "drupal_cms_forms" recipe is applied
    And I am not logged in
    And I am on "/form/contact-form"
    Then the response status code should be 200
    And I should see the page title "Contact"
    And "form.webform-submission-form" should be visible
    And the page should not have PHP errors

  # The Search recipe installs Search API with a database server and a
  # "Content" index; the search box itself is a block a site places.
  Scenario: The Search recipe installs the search index
    Given the "drupal_cms_search" recipe is applied
    And I am a logged in user with the "admin" user
    Then the "search_api" module should be installed
    And the "search_api_db" module should be installed
    When I am on "/admin/config/search/search-api"
    Then I should see the page title "Search API"
    And I should see "Content" in the "Content" row
    And the page should not have PHP errors
