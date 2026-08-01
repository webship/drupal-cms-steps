Feature: Admin dashboard
  As an administrator
  I want to view the Drupal CMS admin dashboard
  So that I can get an overview of the site

  Scenario: Admin sees the full dashboard
    Given I am logged in as "admin"
      And I am on the admin dashboard
     Then I should see the admin dashboard
      And I should see the admin toolbar
      And the page title should be "Dashboard"
      And I should see the "Recent content" dashboard section
      And I should see the "Top tasks" dashboard section
      And I should see the "Announcements" dashboard section

  Scenario: The dashboard lists the starter content
    Given I am logged in as "admin"
      And I am on the admin dashboard
     Then I should see "Home"
      And I should see "Privacy policy"

  # The announcements feed is exposed by the "access announcements" permission,
  # which the Content editor role does not have.
  Scenario: Content editor sees a dashboard scoped to their permissions
    Given I am logged in as "content editor"
      And I am on the admin dashboard
     Then I should see the admin dashboard
      And I should see the "Recent content" dashboard section
      And I should see the "Top tasks" dashboard section
      But I should not see the "Announcements" dashboard section

  Scenario: Anonymous user is denied the dashboard and sent to the login form
    Given I am on "/admin/dashboard"
     Then the page should return HTTP status 403
      And I should see the login form
      And I should not see the admin toolbar
