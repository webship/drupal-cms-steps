Feature: Cookie consent
  As a visitor
  I want the cookie consent notice to appear once and to remember my choice
  So that the site respects the choice and never asks again

  # The fixture sets the consent manager to the "notice" dialog mode and
  # enables one optional service (Matomo), as a site with analytics would;
  # a fresh Drupal CMS is silent and has nothing to ask.

  Scenario: The suite accepts the consent up front, so the notice never shows
    Given I am on the homepage
    Then I should not see the cookie consent dialog
    And the cookie consent should be stored

  Scenario: Without a stored consent the notice shows and can be accepted
    Given I am on the homepage
    And the cookie consent is not given yet
    Then I should see the cookie consent dialog
    And the cookie consent should not be stored
    When I accept the cookie consent
    Then I should not see the cookie consent dialog
    And the cookie consent should be stored
    And the consent for the "klaro" service should be given
    When I reload the page
    Then I should not see the cookie consent dialog

  Scenario: Declining stores a refusal of the optional service
    Given I am on the homepage
    And the cookie consent is not given yet
    Then I should see the cookie consent dialog
    When I decline the cookie consent
    Then I should not see the cookie consent dialog
    And the cookie consent should be stored
    And the consent for the "cms" service should be given
    And the consent for the "matomo" service should not be given

  Scenario: A visitor allows one service in the consent settings
    Given I am on the homepage
    And the cookie consent is not given yet
    When I open the consent settings
    And I allow the "Matomo" service in the consent settings
    And I save the consent settings
    Then I should not see the cookie consent dialog
    And the consent for the "matomo" service should be given

  # The "My privacy settings" link is in the footer menu of the Starter site template.
  Scenario: A visitor changes the choice later through "My privacy settings"
    Given the site template is "drupal_cms_starter"
    And I am on the homepage
    And the cookie consent is not given yet
    When I open the consent settings
    And I allow the "Matomo" service in the consent settings
    And I save the consent settings
    Then the consent for the "matomo" service should be given
    When I open my privacy settings
    And I refuse the "matomo" service in the consent settings
    And I save my privacy settings
    Then the consent for the "matomo" service should not be given

  Scenario: The administrator reads the privacy settings of the site
    Given I am a logged in user with the "admin" user
    Then the consent dialog mode should be "notice"
    And the consent dialog mode should not be "silent"
    And the "Drupal CMS" consent service should be enabled
    And the "Consent manager" consent service should be enabled
    And the "Matomo" consent service should be enabled
    And the "YouTube" consent service should be disabled

  # Silent is what Drupal CMS installs: no notice, a service that needs a
  # consent stays blocked. The scenario sets the fixture's mode back.
  Scenario: In the silent mode a visitor is not asked
    Given I am a logged in user with the "admin" user
    When I set the consent dialog mode to "silent"
    Then the consent dialog mode should be "silent"
    Given I am not logged in
    And I am on the homepage
    And the cookie consent is not given yet
    Then I should not see the cookie consent dialog
    And the cookie consent should not be stored
    Given I am a logged in user with the "admin" user
    When I set the consent dialog mode to "notice"
    Then the consent dialog mode should be "notice"
    Given I am not logged in
    And I am on the homepage
    And the cookie consent is not given yet
    Then I should see the cookie consent dialog

  Scenario: Anonymous visitors cannot reach the privacy settings of the site
    Given I am not logged in
    And I am on "/admin/config/user-interface/klaro"
    Then the page should return HTTP status 403
    And I should see the login form
