Feature: Drupal Canvas
  As a site builder
  I want to build Canvas pages through the editor and through its API
  So that the page builder Drupal CMS ships works end to end

  Background:
    Given the site template is "drupal_cms_starter"
    And I am a logged in user with the "admin" user

  Scenario: The component library offers the theme's components
    Then the Canvas component library should list the "Heading" component
    And the Canvas component library should list the "sdc.mercury.text" component
    And the Canvas component library should list the "block.system_branding_block" component
    And the Canvas component library should not list the "Legacy slider" component

  @critical
  Scenario: A page is built and published through the Canvas API
    Given there is a new Canvas page "Canvas API page" at "/canvas-api-page"
    When I add the "Heading" component to the bottom of the "Canvas API page" Canvas page and publish it:
      | heading_text | Heading from the API |
      | level        | 2                    |
    And I visit the "Canvas API page" Canvas page
    Then the page should return HTTP status 200
    And I should see "Heading from the API"
    When I add the "Text" component to the bottom of the "Canvas API page" Canvas page
    And I publish the pending Canvas changes
    Then the "Canvas API page" Canvas page should have 2 components
    And the "Canvas API page" Canvas page should have at least 1 component
    When I visit the "Canvas API page" Canvas page
    Then I should see "Heading from the API"

  Scenario: A page with one configured component is created in one step
    When I create a Canvas page "Canvas one-shot page" at "/canvas-one-shot-page" with the "sdc.mercury.heading" component:
      | heading_text | One-shot heading |
    And I visit the "Canvas one-shot page" Canvas page
    Then I should see "One-shot heading"
    And the "Canvas one-shot page" Canvas page should exist

  @critical
  Scenario: A component is inserted and published through the editor
    Given there is a new Canvas page "Canvas editor page" at "/canvas-editor-page"
    When I open the "Canvas editor page" Canvas page in the editor
    Then I should see the Canvas editor
    When I open the "Components" tab in the Canvas Library
    Then the Canvas Library "Components" tab should list "Heading"
    And the Canvas Library "Components" tab should list "Hero CTA"
    And the Canvas Library "Components" tab should not list "Legacy slider"
    When I filter the Canvas Library by "Heading"
    Then the Canvas Library "Components" tab should list "Heading"
    And the Canvas Library "Components" tab should not list "Hero CTA"
    When I filter the Canvas Library by ""
    And I insert the "Heading" component from the Canvas Library
    And I set the Canvas component option "Heading" to "Heading from the editor"
    And I publish the Canvas page changes through the editor
    And I visit the "Canvas editor page" Canvas page
    Then I should see "Heading from the editor"

  Scenario: A fresh install ships no patterns yet
    When I open the "Home" Canvas page in the editor
    And I open the "Patterns" tab in the Canvas Library
    Then the Canvas Library "Patterns" tab should not list "Hero slider"

  Scenario: The content editor may open the Canvas editor
    Given I am a logged in user with the "content editor" user
    When I open the "Home" Canvas page in the editor
    Then I should see the Canvas editor
