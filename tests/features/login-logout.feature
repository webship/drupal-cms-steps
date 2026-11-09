Feature: Login and logout
  As a Drupal CMS user
  I want to log in and out
  So that I can access what my role allows

  Scenario: The administrator logs in and lands on the dashboard
    Given I am a logged in user with the "admin" user
    Then I should be logged in
    And I should see the navigation sidebar
    And I should see the page title "Dashboard"

  Scenario: Logging out ends the session
    Given I am a logged in user with the "admin" user
    When I log out
    Then I should not be logged in
    And I should not see the navigation sidebar

  Scenario: The content editor logs in and lands on the dashboard
    Given I am a logged in user with the "content editor" user
    Then I should be logged in
    And I should see the navigation sidebar
    And I should see the page title "Dashboard"

  Scenario: A user can log in with an email address instead of a username
    When I log in with the email address of "content editor"
    Then I should be logged in
    And I should see the page title "Dashboard"

  Scenario: A wrong password is rejected
    Given I am on the login page
    When I log in as "admin" with password "definitely-not-the-password"
    Then I should see a login error "Unrecognized username or password."
    And I should not be logged in
    And I should see the login form
