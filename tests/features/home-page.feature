Feature: Home page
  As a visitor
  I want to load the Drupal CMS home page
  So that I know the site is up and serving the starter content

  Scenario: Anonymous visitor loads the home page
    Given I am not logged in
    And I am on the homepage
    Then the response status code should be 200
    And I should be on the front page
    And I should not see the navigation sidebar
    And the site should be running Drupal 11

  Scenario: The home page is also reachable through its path alias
    Given I am on "/home"
    Then the response status code should be 200
    And I should be on the front page

  Scenario: The home page is a Canvas page
    Given I am a logged in user with the "admin" user
    Then the "Home" Canvas page should exist
    When I visit the "Home" Canvas page
    Then I should be on the front page

  @mobile
  Scenario: Home page loads on a mobile viewport
    Given I am on the homepage
    When I set the viewport to the "xs" breakpoint
    And I reload the page
    Then the response status code should be 200
    And I should be on the front page
