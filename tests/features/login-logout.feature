Feature: Login and logout
  As a Drupal CMS user
  I want to log in and out
  So that I can access content appropriate to my role

  Background:
    Given I am on the homepage
     Then I should not see the admin toolbar

  Scenario: Admin logs in and lands on the dashboard
    Given I am logged in as "admin"
     Then I should see the admin toolbar
      And the page title should be "Dashboard"

  Scenario: Admin logs out and loses the admin toolbar
    Given I am logged in as "admin"
     When I log out
     Then I should not see the admin toolbar
      And I should see "Log in"

  Scenario: Content editor logs in and lands on the dashboard
    Given I am logged in as "content editor"
     Then I should see the admin toolbar
     And the page title should be "Dashboard"

  Scenario: A user can log in with an email address instead of a username
    When I log in with the email address of "content editor"
    Then I should see the admin toolbar
     And the page title should be "Dashboard"

  Scenario: A wrong password is rejected
    When I try to log in as "admin" with the password "definitely-not-the-password"
    Then I should see "Unrecognized username or password."
     And I should not see the admin toolbar
     And I should see the login form
