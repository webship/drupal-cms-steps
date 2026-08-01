Feature: Content management
  As a content editor
  I want to manage content
  So that I can publish and review pages on the site

  Scenario: Content editor reviews the starter content in the content overview
    Given I am logged in as "content editor"
      And I am on the content overview page
     Then I should see the admin toolbar
      And the page title should be "Content"
      And I should see "Home" in the content list
      And I should see "Privacy policy" in the content list
      And the content list row for "Home" should show "Published"
      And the content list row for "Privacy policy" should show "Unpublished"

  # The starter recipe ships the privacy policy as an unpublished draft that
  # the site owner is meant to review, so it must not leak to the public.
  Scenario: The unpublished privacy policy is hidden from anonymous visitors
    Given I am on "/privacy-policy"
     Then the response status code should be 404
      And the page title should be "Page not found"

  Scenario: An editor can preview the unpublished privacy policy
    Given I am logged in as "content editor"
      And I am on "/privacy-policy"
     Then the page should return HTTP status 200
      And the page title should be "Privacy policy"
      And the content item should be unpublished

  Scenario: Admin opens the add-page form for the only content type
    Given I am logged in as "admin"
      And I am adding a "page"
     Then I should see the admin toolbar
      And the page title should be "Create Basic page"

  # Drupal CMS marks the Basic page "Description" field required (it feeds the
  # search-engine description), so a title alone must not be accepted.
  Scenario: A basic page cannot be saved without a description
    Given I am logged in as "content editor"
      And I am adding a "page"
     When I fill in the field "#edit-title-0-value" with "Page with no description"
      And I save the content
     Then the "Description" field should block submission as required
      And the page title should be "Create Basic page"

  # New content enters the basic_editorial workflow as a Draft, so it is
  # created unpublished even though the editor may publish it later.
  Scenario: Content editor creates a basic page and it starts as an unpublished draft
    Given I am logged in as "content editor"
      And I am adding a "page"
     When I fill in the field "#edit-title-0-value" with "Webship acceptance page"
      And I fill in the field "#edit-field-description-0-value" with "Created by the webship-js acceptance suite."
      And I save the content
     Then I should see a status message "Webship acceptance page has been created."
      And the page title should be "Webship acceptance page"
      And the content item should be unpublished
     When I delete the content item I am viewing
     Then I should see a status message "Webship acceptance page has been deleted."

  Scenario: Anonymous user cannot reach the content overview page
    Given I am on "/admin/content"
     Then the page should return HTTP status 403
      And I should see the login form
      And I should not see the admin toolbar