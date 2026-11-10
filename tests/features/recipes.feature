Feature: Add-on recipes
  As a site builder
  I want the add-on recipes of Drupal CMS checked once they are applied
  So that a scenario about forms or search runs only where they exist

  Scenario: The Forms recipe adds the contact form
    Given the "drupal_cms_forms" recipe is applied
    And I am not logged in
    And I am on "/contact"
    Then the response status code should be 200
    And I should see the page title "Contact"
    And "form.webform-submission-form" should be visible

  Scenario: The Search recipe adds the search page
    Given the "drupal_cms_search" recipe is applied
    And I am not logged in
    And I am on "/search"
    Then the response status code should be 200
    And the page should not have PHP errors
