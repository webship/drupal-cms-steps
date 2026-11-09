Feature: Top bar page actions
  As an editor
  I want the top bar to offer the actions for the page I am viewing
  So that editing, revisions and deletion are one click away

  Background:
    Given I am a logged in user with the "admin" user
    And I am on "/privacy-policy"

  Scenario: The top bar offers the primary and secondary actions
    Then the top bar should offer the "Edit" action
    And the top bar should offer the "Delete" action
    And the top bar should offer the "Revisions" action
    And the top bar should not offer the "Edit layout" action

  Scenario: The more actions menu opens
    When I open the top bar page actions
    Then the top bar should offer the "Duplicate" action
    And I should see "Revisions"

  Scenario: Choosing an action follows it
    When I choose the "Edit" action in the top bar
    Then the url should match "/edit"
    And I should see the page title "Privacy policy"
    When I go back
    And I choose the "Revisions" action in the top bar
    Then the url should match "/revisions"
