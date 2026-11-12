Feature: The life of a Canvas page
  As an editor
  I want to create, build, publish and remove a Canvas page in the editor
  So that the whole path of a page is known to work, from "Add Page" to the trash

  Background:
    Given the site template is "drupal_cms_starter"
    And I am a logged in user with the "admin" user

  @critical
  Scenario: An editor creates, builds, publishes and deletes a page in the editor
    When I add a Canvas page from the Pages listing
    Then I should see the Canvas editor
    And the Canvas editor should show the page as "Draft"
    When I set the Canvas page "Title" to "Canvas lifecycle page"
    And I set the Canvas page "URL alias" to "/canvas-lifecycle-page"
    Then the Canvas editor should have at least 1 pending change
    When I open the "Components" tab in the Canvas Library
    And I insert the "Heading" component from the Canvas Library
    And I set the Canvas component option "Heading" to "Lifecycle heading"
    Then the Canvas preview should show "Lifecycle heading"
    And the Canvas "Layers" panel should list "Heading"
    And the Canvas "Layers" panel should not list "Image"
    When I publish the Canvas page changes through the editor
    Then the Canvas editor should show the page as "Published"
    And the Canvas editor should not show the page as "Draft"
    And the Canvas editor should have no pending changes
    And the Canvas "Pages" panel should list "Canvas lifecycle page"
    When I visit the "Canvas lifecycle page" Canvas page
    Then the page should return HTTP status 200
    And the path should be "/canvas-lifecycle-page"
    And I should see "Lifecycle heading"
    When I open the "Home" Canvas page in the editor
    And I delete the "Canvas lifecycle page" page from the Canvas page list
    Then the Canvas "Pages" panel should not list "Canvas lifecycle page"
    And the "Canvas lifecycle page" Canvas page should not exist
    And the Canvas pages trash should hold "Canvas lifecycle page"
    When I purge "Canvas lifecycle page" from the Canvas pages trash
    Then the Canvas pages trash should not hold "Canvas lifecycle page"

  Scenario: A component is duplicated and deleted through the Layers panel
    Given there is a new Canvas page "Canvas layers page" at "/canvas-layers-page"
    When I add the "Heading" component to the bottom of the "Canvas layers page" Canvas page and publish it:
      | heading_text | Layers heading |
    And I open the "Canvas layers page" Canvas page in the editor
    Then the Canvas "Layers" panel should list "Heading"
    When I duplicate the "Heading" component in the Canvas Layers
    Then the "Canvas layers page" Canvas page should have 2 components
    And the Canvas editor should have at least 1 pending change
    When I select the "Heading" component in the Canvas Layers
    And I set the Canvas component option "Heading" to "Layers heading, edited"
    Then the Canvas preview should show "Layers heading, edited"
    When I delete the "Heading" component in the Canvas Layers
    Then the "Canvas layers page" Canvas page should have 1 component
    When I discard the pending Canvas changes
    Then the Canvas editor should have no pending changes
    And the Canvas preview should show "Layers heading"
    And the Canvas preview should not show "Layers heading, edited"
    When I delete the "Canvas layers page" Canvas page
    And I purge "Canvas layers page" from the Canvas pages trash
    Then the Canvas pages trash should not hold "Canvas layers page"

  # A deleted page goes to the trash and keeps its URL alias there. Canvas then
  # refuses to publish another page at that alias, until the first is purged.
  Scenario: A page in the trash keeps its URL alias until it is purged
    Given there is a new Canvas page "Canvas alias page" at "/canvas-alias-page"
    When I delete the "Canvas alias page" Canvas page
    Then the "Canvas alias page" Canvas page should not exist
    And the Canvas pages trash should hold "Canvas alias page"
    When I add a Canvas page from the Pages listing
    And I set the Canvas page "Title" to "Canvas alias successor"
    And I set the Canvas page "URL alias" to "/canvas-alias-page"
    Then publishing the Canvas page changes through the editor should fail with "The alias /canvas-alias-page is already in use in this language."
    # Canvas keeps the refusal with the pending change until the field
    # changes, so the alias is entered again once the trash is purged.
    When I purge "Canvas alias page" from the Canvas pages trash
    And I open the "Canvas alias successor" Canvas page in the editor
    And I set the Canvas page "URL alias" to "/canvas-alias-successor"
    And I set the Canvas page "URL alias" to "/canvas-alias-page"
    And I publish the Canvas page changes through the editor
    Then the Canvas editor should show the page as "Published"
    When I visit the "Canvas alias successor" Canvas page
    Then the page should return HTTP status 200
    And the path should be "/canvas-alias-page"
    When I delete the "Canvas alias successor" Canvas page
    And I purge "Canvas alias successor" from the Canvas pages trash
    Then the Canvas pages trash should not hold "Canvas alias successor"

  Scenario: A deleted page is restored from the trash
    Given there is a new Canvas page "Canvas restore page" at "/canvas-restore-page"
    When I delete the "Canvas restore page" Canvas page
    And I am on "/canvas-restore-page"
    Then the page should return HTTP status 404
    When I restore "Canvas restore page" from the Canvas pages trash
    Then the Canvas pages trash should not hold "Canvas restore page"
    And the "Canvas restore page" Canvas page should exist
    When I visit the "Canvas restore page" Canvas page
    Then the page should return HTTP status 200
    When I delete the "Canvas restore page" Canvas page
    And I purge "Canvas restore page" from the Canvas pages trash
    Then the "Canvas restore page" Canvas page should not exist
