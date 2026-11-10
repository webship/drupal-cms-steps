Feature: The Starter site template
  As a site builder
  I want the promises of the Starter site template checked after an install
  So that a Drupal CMS site built from it is known good before anyone edits it

  Background:
    Given the site template is "drupal_cms_starter"
    And I am a logged in user with the "admin" user

  Scenario: The template records itself and ships Canvas pages
    Then the site template should be "drupal_cms_starter"
    And the site template should not be "drupal_cms_blank"
    And the site should have at least 1 Canvas page
    And the "Home" Canvas page should exist

  Scenario: The template installs its modules, theme, roles and content type
    Then the "canvas" module should be installed
    And the "navigation" module should be installed
    And the "dashboard" module should be installed
    And the default theme should be "Mercury"
    And the "Content editor" role should exist
    And the "Utility page" content type should exist
    And the "Article" content type should not exist

  Scenario: The template sets the front page and the main menu
    Then the front page path should be "/home"
    And the "Main navigation" menu should contain "Home"
    And the page should not have PHP errors
