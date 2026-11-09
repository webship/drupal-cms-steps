Feature: Navigation toolbar
  As a signed-in user
  I want the navigation sidebar to offer the sections my role may use
  So that the back end is scoped to my permissions

  Scenario: The administrator's sidebar lists the site building sections
    Given I am a logged in user with the "admin" user
    Then I should see the navigation sidebar
    And the navigation toolbar should list "Dashboard"
    And the navigation toolbar should list "Pages"
    And the navigation toolbar should list "Media"
    And the navigation toolbar should list "People"
    And the navigation sidebar should list "Structure"
    And the navigation sidebar should list "Extend"

  Scenario: The content editor's sidebar hides the site building sections
    Given I am a logged in user with the "content editor" user
    Then the navigation toolbar should list "Dashboard"
    And the navigation toolbar should list "Pages"
    And the navigation menu should list "Media"
    But the navigation toolbar should not list "People"
    And the navigation toolbar should not list "Extend"
    And the navigation toolbar should not list "Appearance"

  Scenario: A sidebar link opens its page
    Given I am a logged in user with the "admin" user
    When I click "Pages" in the navigation toolbar
    Then I should be on an admin page
    And I should see the page title "Pages"
    And I should see "Home" in the "Home" row
    When I click "Media" in the navigation sidebar
    Then I should see the page title "Media"
