Feature: User management
  As an administrator
  I want to manage user accounts
  So that I can control who has access to the site

  Scenario: Admin views the people administration page
    Given I am logged in as "admin"
      And I am on the people administration page
     Then I should see the admin toolbar
      And the page title should be "People"
      And I should see the user "admin"
      And the user "admin" should have the "Administrator" role
      And I should see the user "content_editor"
      And the user "content_editor" should have the "Content editor" role

  Scenario: Content editor cannot administer people
    Given I am logged in as "content editor"
      And I am on "/admin/people"
     Then the page should return HTTP status 403
      And I should be denied access
      And I should see "You are not authorized to access this page."

  # The Content editor role has "access administration pages" but none of the
  # site-building permissions, so admin sections beyond content stay closed.
  Scenario Outline: Content editor cannot reach site administration pages
    Given I am logged in as "content editor"
      And I am on "<path>"
     Then the page should return HTTP status 403
      And I should be denied access

      Examples:
        | path                  |
        | /admin/modules        |
        | /admin/reports/status |

  Scenario: Anonymous user cannot reach the people administration page
    Given I am on "/admin/people"
     Then the page should return HTTP status 403
      And I should see the login form