Feature: The trash
  As an editor
  I want deleted content kept in the trash, to restore it or to purge it
  So that a deletion is never a loss and the site stays clean

  Background:
    Given the site template is "drupal_cms_starter"

  Scenario: The trash has a listing for content and one for Canvas pages
    Given I am a logged in user with the "admin" user
    And I am on the content trash
    Then I should see the page title "Trash"
    And the path should be "/admin/content/trash"
    Given I am on the Canvas pages trash
    Then I should see the page title "Trash"
    And the path should be "/admin/content/trash/canvas_page"

  Scenario: A deleted utility page is restored from the trash, then purged
    Given I am a logged in user with the "admin" user
    And I am adding a "page"
    When I fill in "Title" with "Webship trash page"
    And I fill in "field_description[0][value]" with "Created to be deleted."
    And I save the content
    Then I should see a status message "Webship trash page has been created."
    When I delete the content item I am viewing
    Then the content trash should hold "Webship trash page"
    And the Canvas pages trash should not hold "Webship trash page"
    When I restore "Webship trash page" from the content trash
    Then the content trash should not hold "Webship trash page"
    When I am on the content overview page
    Then I should see "Webship trash page" in the "Webship trash page" row
    When I open the "Webship trash page" link in the "Webship trash page" row
    And I delete the content item I am viewing
    And I purge "Webship trash page" from the content trash
    Then the content trash should not hold "Webship trash page"

  Scenario: Anonymous visitors cannot reach the trash
    Given I am not logged in
    And I am on "/admin/content/trash"
    Then the page should return HTTP status 403
    And I should see the login form
