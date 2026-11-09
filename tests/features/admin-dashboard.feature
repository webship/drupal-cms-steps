Feature: Admin dashboard
  As an administrator
  I want to view the Drupal CMS dashboard
  So that I get an overview of the site after logging in

  Scenario: The administrator sees the full dashboard
    Given I am a logged in user with the "admin" user
    And I am on the dashboard
    Then I should see the dashboard
    And I should see the navigation sidebar
    And I should see the page title "Dashboard"
    And I should see the "Recent content" dashboard section
    And I should see the "Top tasks" dashboard section
    And I should see the "Announcements" dashboard section

  Scenario: The dashboard lists the starter content
    Given I am a logged in user with the "admin" user
    And I am on the admin dashboard page
    Then I should see "Privacy policy"
    And I should see "Home"

  # The announcements feed needs the "access announcements" permission, which
  # the Content editor role does not have.
  Scenario: The content editor sees a dashboard scoped to their permissions
    Given I am a logged in user with the "content editor" user
    And I am on the dashboard page
    Then I should see the dashboard
    And I should see the "Recent content" dashboard section
    And I should see the "Top tasks" dashboard section
    But I should not see the "Announcements" dashboard section

  Scenario: Anonymous visitors are refused the dashboard
    Given I am not logged in
    And I am on "/admin/dashboard"
    Then the page should return HTTP status 403
    And I should see the login form
    And I should not see the navigation sidebar
    And I should not see the dashboard
