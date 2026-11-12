Feature: The Gin administration theme
  As an editor
  I want the back end of Drupal CMS to show its navigation and its sticky action bar
  So that every form is saved from the same place

  Background:
    Given the site template is "drupal_cms_starter"
    And I am a logged in user with the "admin" user

  Scenario: Gin renders the back end with the Navigation sidebar
    Given I am on the dashboard
    Then "body" should have class "gin--core-navigation"
    And I see visible sidebar, dashboard
    And the navigation sidebar should list "Dashboard"
    And the navigation sidebar should list "Trash"
    And the navigation sidebar should list "Project Browser"

  Scenario: The content form has the sticky action bar and the meta sidebar
    Given I am adding a "page"
    Then I should see the page title "Create Utility page"
    And I see visible header bar, edit form, sticky form actions, sticky save button, meta sidebar

  Scenario: The top bar of a content page shows its title, its state and its actions
    Given I am on "/privacy-policy"
    Then I see visible header bar, top bar title, top bar status, more actions
    And ".top-bar .toolbar-badge" should contain text "Draft"
    When I open the top bar page actions
    Then I see visible more actions menu

  Scenario: A confirmation form is a Gin confirm form
    Given I am on "/admin/config/search/redirect/add"
    Then I see visible sticky form actions, sticky save button
    When I am on "/node/1/delete"
    Then I see visible confirm form
