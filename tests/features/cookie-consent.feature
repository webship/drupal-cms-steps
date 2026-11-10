Feature: Cookie consent
  As a visitor
  I want the cookie consent dialog to appear once and remember my choice
  So that the site respects the choice and never asks again

  Scenario: The suite accepts the consent up front, so the dialog never shows
    Given I am on the homepage
    Then I should not see the cookie consent dialog

  Scenario: Without the stored consent the dialog shows and can be accepted
    Given I am on the homepage
    And the cookie consent is not given yet
    Then I should see the cookie consent dialog
    When I accept the cookie consent
    Then I should not see the cookie consent dialog
    When I reload the page
    Then I should not see the cookie consent dialog

  Scenario: The consent can be declined
    Given I am on the homepage
    And the cookie consent is not given yet
    Then I should see the cookie consent dialog
    When I decline the cookie consent
    Then I should not see the cookie consent dialog
