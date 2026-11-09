Feature: User management
  As an administrator
  I want to manage user accounts
  So that I control who has access to the site

  Scenario: The administrator views the people page
    Given I am a logged in user with the "admin" user
    And I am on the people page
    Then I should see the navigation sidebar
    And I should see the page title "People"
    And I should see "Administrator" in the "admin" row
    And I should see "Content editor" in the "content_editor" row
    And I should see the "Edit" operation for the "content_editor" user

  Scenario: The content editor cannot administer people
    Given I am a logged in user with the "content editor" user
    And I am on "/admin/people"
    Then the page should return HTTP status 403
    And I should be on the access denied page
    And I should see "You are not authorized to access this page."

  # The Content editor role has "access administration pages" but none of the
  # site building permissions, so admin sections beyond content stay closed.
  Scenario Outline: The content editor cannot reach site administration pages
    Given I am a logged in user with the "content editor" user
    And I am on "<path>"
    Then the page should return HTTP status 403
    And I should be on the access denied page

    Examples:
      | path                  |
      | /admin/modules        |
      | /admin/reports/status |

  Scenario: Anonymous visitors cannot reach the people page
    Given I am not logged in
    And I am on "/admin/people"
    Then the page should return HTTP status 403
    And I should see the login form
