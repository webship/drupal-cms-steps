Feature: Editorial tools
  As an editor
  I want scheduling, the editorial workflow and redirects to work
  So that content goes live when planned and old addresses keep working

  Background:
    Given the site template is "drupal_cms_starter"

  Scenario: The Basic workflow has the states and transitions Drupal CMS ships
    Given I am a logged in user with the "admin" user
    Then the "Basic" workflow should have the "Draft" state
    And the "Basic" workflow should have the "Published" state
    And the "Basic" workflow should have the "Unpublished" state
    And the "Basic" workflow should not have the "Archived" state
    And the "Basic" workflow should have the "Create new draft" transition
    And the "Basic" workflow should have the "Publish" transition
    And the "Basic" workflow should have the "Unpublish" transition
    And the "Basic" workflow should not have the "Archive" transition

  Scenario: A utility page is scheduled for publication
    Given I am a logged in user with the "admin" user
    And I am adding a "page"
    When I fill in "Title" with "Webship scheduled page"
    And I fill in "field_description[0][value]" with "Scheduled by the webship-js acceptance suite."
    And I schedule the content to be published on "2031-01-15" at "09:30"
    And I save the content
    Then I should see a status message "Webship scheduled page has been created."
    And the content moderation state should be "Draft"
    And the scheduled content should list "Webship scheduled page"
    And I should see "15 Jan 2031 - 09:30" in the "Webship scheduled page" row
    When I open the "Webship scheduled page" link in the "Webship scheduled page" row
    And I delete the content item I am viewing
    Then the scheduled content should not list "Webship scheduled page"
    When I purge "Webship scheduled page" from the content trash
    Then the content trash should not hold "Webship scheduled page"

  Scenario: A redirect sends an old address to a page
    Given I am a logged in user with the "admin" user
    When I add a redirect from "webship-old-address" to "/user/login"
    Then I should see a status message "The redirect has been saved."
    And I should see "301" in the "/webship-old-address" row
    And the path "/webship-old-address" should redirect to "/user/login"
    And the path "/webship-old-address" should not redirect to "/home"
    When I delete the redirect from "webship-old-address"
    Then the path "/webship-old-address" should not redirect to "/user/login"

  # The Content editor role may manage redirects, but not the workflow itself.
  Scenario: The content editor manages redirects but not the workflow
    Given I am a logged in user with the "content editor" user
    And I am on "/admin/config/search/redirect"
    Then the page should return HTTP status 200
    And I should see the page title "Redirect"
    When I am on "/admin/config/workflow/workflows"
    Then the page should return HTTP status 403
    And I should be on the access denied page
