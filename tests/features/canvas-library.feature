Feature: The Canvas Library, templates and media
  As a site builder
  I want patterns, templates and media to work in the Canvas editor
  So that pages are built from reusable parts and from the media library

  Background:
    Given the site template is "drupal_cms_starter"
    And I am a logged in user with the "admin" user

  Scenario: A component is saved as a pattern, inserted on a page and removed
    Given there is a new Canvas page "Canvas pattern page" at "/canvas-pattern-page"
    When I add the "Heading" component to the bottom of the "Canvas pattern page" Canvas page and publish it:
      | heading_text | Pattern heading |
    And I open the "Canvas pattern page" Canvas page in the editor
    And I save the "Heading" component as the Canvas pattern "Webship heading pattern"
    Then the Canvas pattern library should list the "Webship heading pattern" pattern
    When I open the "Patterns" tab in the Canvas Library
    Then the Canvas Library "Patterns" tab should list "Webship heading pattern"
    When I insert the "Webship heading pattern" pattern from the Canvas Library
    Then the "Canvas pattern page" Canvas page should have 2 components
    When I delete the "Webship heading pattern" Canvas pattern
    Then the Canvas pattern library should not list the "Webship heading pattern" pattern
    When I discard the pending Canvas changes
    And I delete the "Canvas pattern page" Canvas page
    And I purge "Canvas pattern page" from the Canvas pages trash
    Then the Canvas pages trash should not hold "Canvas pattern page"

  Scenario: The Templates panel lists the content template and the page template
    When I open the "Home" Canvas page in the editor
    And I open the "Templates" panel in the Canvas editor
    Then the Canvas "Templates" panel should list "Utility page"
    And the Canvas "Templates" panel should list "Full content template"
    And the Canvas "Templates" panel should list "Mercury theme"
    And the Canvas "Templates" panel should not list "Landing page"

  Scenario: The content template of the Utility page opens in the editor
    When I open the "Home" Canvas page in the editor
    Then the Canvas editor should be editing "Home"
    When I open the "Full content template" template in the Canvas editor
    Then the Canvas editor should be editing "Utility page - Full content template"
    And the Canvas editor should not be editing "Home"
    And the url should match "/canvas/template/node/page/full"

  Scenario: The Pages panel lists the pages of the site
    When I open the "Home" Canvas page in the editor
    And I open the "Pages" panel in the Canvas editor
    Then the Canvas "Pages" panel should list "Home"
    And the Canvas "Pages" panel should not list "Old landing"

  Scenario: An image is uploaded to the media library from a Canvas component
    Given there is a new Canvas page "Canvas media page" at "/canvas-media-page"
    When I add the "Image" component to the bottom of the "Canvas media page" Canvas page
    And I open the "Canvas media page" Canvas page in the editor
    And I select the "Image" component in the Canvas Layers
    And I open the media library of the Canvas component option "Image"
    And I upload "tests/fixtures/sample.png" to the media library with the alternative text "A blue sample image"
    And I insert the selected media
    Then the Canvas component option "Image" should hold the media "sample.png"
    And the Canvas component option "Image" should not hold the media "other.png"
    When I publish the Canvas page changes through the editor
    And I visit the "Canvas media page" Canvas page
    Then I should see an image with the "A blue sample image" alt text
    When I delete the "Canvas media page" Canvas page
    And I purge "Canvas media page" from the Canvas pages trash
    And I am on "/admin/content/media"
    And I open the "Delete" link in the "sample.png" row
    And I confirm the deletion
    Then I should see a status message
