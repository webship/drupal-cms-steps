@a11y
Feature: Accessibility
  As a site owner
  I want the front page, a Canvas page and the login page audited
  So that what Drupal CMS and Canvas render stays usable for everyone

  Background:
    Given the site template is "drupal_cms_starter"

  Scenario: The front page has its structure and no critical violation
    Given I am not logged in
    And I am on the homepage
    Then the page should declare a language
    And the page should have a title
    And the page should have a main landmark
    And the page should have a navigation landmark
    And the page should have exactly one h1
    And the page should have a skip link
    And the heading hierarchy should be valid
    And every image should have an alt attribute
    And every button should have an accessible name
    And the page should have no critical accessibility violations

  # The content of the page is what Canvas renders; the header and the footer
  # come from the theme.
  Scenario: The content of the front page passes the accessibility audit
    Given I am not logged in
    And I am on the homepage
    Then the element "main" should pass an accessibility audit
    And the element "main" should not violate the accessibility rule "color-contrast"
    And the element "main" should not violate the accessibility rule "link-name"

  Scenario: A Canvas page built from components passes the audit
    Given I am a logged in user with the "admin" user
    And there is a new Canvas page "Canvas accessible page" at "/canvas-accessible-page"
    When I add the "Heading" component to the bottom of the "Canvas accessible page" Canvas page:
      | heading_text | An accessible heading |
      | level        | 1                     |
    And I add the "Text" component to the bottom of the "Canvas accessible page" Canvas page and publish it
    Given I am not logged in
    And I am on "/canvas-accessible-page"
    Then the response status code should be 200
    And the page should have exactly one h1
    And the page should have a main landmark
    And the heading hierarchy should be valid
    And the element "main" should pass an accessibility audit
    And the page should have no critical accessibility violations
    Given I am a logged in user with the "admin" user
    When I delete the "Canvas accessible page" Canvas page
    And I purge "Canvas accessible page" from the Canvas pages trash
    Then the Canvas pages trash should not hold "Canvas accessible page"

  Scenario: The login page has labelled fields and no serious violation
    Given I am not logged in
    And I am on the login page
    Then the page should declare a language
    And the page should have a title
    And the page should have a main landmark
    And the page should have exactly one h1
    And every form field should have an accessible label
    And every button should have an accessible name
    And every link should have an accessible name
    And the page should have no serious accessibility violations

  Scenario: The cookie consent notice does not break the audit of the page
    Given I am on the homepage
    And the cookie consent is not given yet
    Then I should see the cookie consent dialog
    And the element ".klaro" should pass an accessibility audit
    And the page should have no critical accessibility violations
