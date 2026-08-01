Feature: Home page
  As a visitor
  I want to load the Drupal CMS home page
  So that I know the site is up and serving the starter content

  Scenario: Anonymous visitor loads the home page
    Given I am on the homepage
     Then the response status code should be 200
      And the page title should be "Home"
      And I should see "This is the home page of your new site."
      And I should not see the admin toolbar

  Scenario: Home page is also reachable through its path alias
    Given I am on "/home"
     Then the response status code should be 200
      And the page title should be "Home"

  Scenario: Anonymous visitor is offered a way to log in
    Given I am on the homepage
     Then I should see "Log in"
     When I click "Log in"
     Then I should see the login form
      And the page title should be "Log in"

  @mobile
  Scenario: Home page loads on a mobile viewport
    Given I am on the homepage
     When I set the viewport to the "xs" breakpoint
      And I reload the page
     Then the response status code should be 200
      And the page title should be "Home"