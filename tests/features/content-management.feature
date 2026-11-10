Feature: Content management
  As a content editor
  I want to manage content
  So that I can review drafts and publish pages on the site

  # The starter content, the Utility page type and the editorial workflow come
  # with the Starter site template.
  Background:
    Given the site template is "drupal_cms_starter"

  Scenario: The content editor reviews the starter content in the content overview
    Given I am a logged in user with the "content editor" user
    And I am on the content overview page
    Then I should see the navigation sidebar
    And I should see the page title "Content"
    And I should see "Privacy policy" in the "Privacy policy" row
    And I should see "Unpublished" in the "Privacy policy" row
    And I should see the "Edit" operation for the "Privacy policy" content

  Scenario: The site template installs the Utility page content type only
    Given I am a logged in user with the "admin" user
    Then the "Utility page" content type should exist
    And the "Article" content type should not exist
    And the "Basic page" content type should not exist

  # The starter template ships the privacy policy as an unpublished draft that
  # the site owner is meant to review, so it must not leak to the public.
  Scenario: The unpublished privacy policy is hidden from anonymous visitors
    Given I am not logged in
    And I am on "/privacy-policy"
    Then the response status code should be 404
    And I should be on the page not found page

  Scenario: An editor can preview the unpublished privacy policy
    Given I am a logged in user with the "content editor" user
    And I am on "/privacy-policy"
    Then the page should return HTTP status 200
    And I should see the page title "Privacy policy"
    And I should be on a "page" content page
    And the content moderation state should be "Draft"
    And the content moderation state should not be "Published"

  Scenario: The administrator opens the add form of the only content type
    Given I am a logged in user with the "admin" user
    And I am adding a "page"
    Then I should see the navigation sidebar
    And I should see the page title "Create Utility page"
    And the "Add media" button should be visible

  # Drupal CMS marks the Utility page "Description" field required (it feeds
  # the search engine description), so a title alone must not be accepted.
  Scenario: A utility page cannot be saved without a description
    Given I am a logged in user with the "content editor" user
    And I am adding a "page"
    When I fill in "Title" with "Page with no description"
    And I save the content
    Then the "Description" field should block submission as required
    And I should see the page title "Create Utility page"

  # New content enters the basic editorial workflow as a Draft, so it is
  # created unpublished even though the editor may publish it right away.
  @critical
  Scenario: The content editor creates a utility page, publishes it through the workflow and removes it
    Given I am a logged in user with the "content editor" user
    And I am adding a "page"
    When I fill in "Title" with "Webship acceptance page"
    # The add form carries two fields labelled "Description" (the page's own
    # and the menu link's), so this one is named by its field name.
    And I fill in "field_description[0][value]" with "Created by the webship-js acceptance suite."
    And I fill in the rich text editor field "Content" with "<p>Body written through the rich text editor.</p>"
    And I save the content
    Then I should see a status message "Webship acceptance page has been created."
    And I should see the page title "Webship acceptance page"
    And I should see "Body written through the rich text editor."
    And the content moderation state should be "Draft"
    When I change the moderation state to "Published"
    Then the content moderation state should be "Published"
    And the content moderation state should not be "Draft"
    When I delete the content item I am viewing
    Then I should see a status message "has been deleted."

  Scenario: Anonymous visitors cannot reach the content overview
    Given I am not logged in
    And I am on "/admin/content"
    Then the page should return HTTP status 403
    And I should see the login form
    And I should not see the navigation sidebar
