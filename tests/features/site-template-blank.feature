Feature: The Blank site template
  As a site builder
  I want the promises of the Blank site template checked after an install
  So that a site that starts empty still has its base in place

  Background:
    Given the site template is "drupal_cms_blank"
    And I am a logged in user with the "admin" user

  Scenario: The base recipe is in place without the starter content
    Then the site template should be "drupal_cms_blank"
    And the "navigation" module should be installed
    And the "dashboard" module should be installed
    And the "Content editor" role should exist
    And the page should not have PHP errors
