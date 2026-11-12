Feature: Error pages
  As a visitor
  I want a missing page and a refused page to answer clearly
  So that I know what happened and the site records it

  Background:
    Given the site template is "drupal_cms_starter"

  Scenario: A missing page answers 404 with the page not found page
    Given I am not logged in
    And I am on "/webship-missing-address"
    Then the page should return HTTP status 404
    And I should be on the page not found page
    And I should see the page title "Page not found"
    And I should see "The requested page could not be found."
    And the page should not have PHP errors

  Scenario: A refused page shows a visitor the login form
    Given I am not logged in
    And I am on "/admin/content"
    Then the page should return HTTP status 403
    And I should see the login form
    And I should not see the navigation sidebar

  Scenario: A refused page tells a signed-in user so
    Given I am a logged in user with the "content editor" user
    And I am on "/admin/modules"
    Then the page should return HTTP status 403
    And I should be on the access denied page
    And I should see "You are not authorized to access this page."

  # The Redirect 404 module records each missing address, so the site owner
  # can turn it into a redirect.
  Scenario: The site records the missing address under "Fix 404 pages"
    Given I am not logged in
    And I am on "/webship-missing-address"
    Then the page should return HTTP status 404
    Given I am a logged in user with the "admin" user
    When I am on "/admin/config/search/redirect/404?path=webship-missing-address"
    Then I should see the page title "Fix 404 pages"
    And I should see "/webship-missing-address" in the "/webship-missing-address" row
    And I should see the "Add redirect" operation for the "/webship-missing-address"
