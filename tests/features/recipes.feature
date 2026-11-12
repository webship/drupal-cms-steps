Feature: Add-on recipes
  As a site builder
  I want the add-on recipes of Drupal CMS checked once they are applied
  So that a scenario about forms or search runs only where they exist

  # The Forms recipe adds the "Contact" webform, served at /form/contact-form,
  # and the tools to build forms.
  Scenario: The Forms recipe adds the contact form
    Given the "drupal_cms_forms" recipe is applied
    And I am not logged in
    And I am on "/form/contact-form"
    Then the response status code should be 200
    And I should see the page title "Contact"
    And "form.webform-submission-form" should be visible
    And the page should not have PHP errors

  # The Search recipe installs Search API with a database server and a
  # "Content" index; the search box itself is a block a site places.
  Scenario: The Search recipe installs the search index
    Given the "drupal_cms_search" recipe is applied
    And I am a logged in user with the "admin" user
    Then the "search_api" module should be installed
    And the "search_api_db" module should be installed
    When I am on "/admin/config/search/search-api"
    Then I should see the page title "Search API"
    And I should see "Content" in the "Content" row
    And the page should not have PHP errors

  # A visitor sends the contact form: the fields, the "I'm not a robot" check
  # (ALTCHA, solved in the browser), the minimum time Honeypot wants, then the
  # confirmation. The administrator finds the submission and clears it.
  @critical
  Scenario: A visitor sends the contact form and the administrator finds the submission
    Given the "drupal_cms_forms" recipe is applied
    And I am not logged in
    And I am on "/form/contact-form"
    When I fill in "Name" with "Webship QA"
    And I fill in "Email" with "qa@example.com"
    And I fill in "Message" with "A message from the webship-js acceptance suite."
    And I pass the spam protection of the form
    And I press "Submit"
    Then I should see the form confirmation "Thanks for contacting us!"
    And I should not see an error message
    Given I am a logged in user with the "admin" user
    Then the "Contact" form should have at least 1 submission
    When I clear the submissions of the "Contact" form
    Then the "Contact" form should have 0 submissions

  Scenario: The contact form refuses a submission without its required fields
    Given the "drupal_cms_forms" recipe is applied
    And I am not logged in
    And I am on "/form/contact-form"
    When I pass the spam protection of the form
    And I press "Submit"
    Then I should not see the form confirmation
    And the "Name" field should block submission as required

  # The Search recipe also adds a "Search" component (a Views block over the
  # index) to the Canvas Library, for the site builder to place on a page.
  Scenario: The Search recipe adds the Search component to the Canvas Library
    Given the "drupal_cms_search" recipe is applied
    And the site template is "drupal_cms_starter"
    And I am a logged in user with the "admin" user
    Then the Canvas component library should list the "Search" component
    And the Canvas component library should list the "block.views_block.search-search" component

  # The exposed form of the Search component submits to "search": the site
  # builder gives the search its page by placing the form and the results on
  # a Canvas page at /search. Published content is indexed at once.
  Scenario: A visitor searches the site from a Canvas page at /search
    Given the "drupal_cms_search" recipe is applied
    And the site template is "drupal_cms_starter"
    And I am a logged in user with the "admin" user
    When I create a Canvas page "Webship search" at "/search" with the "block.views_exposed_filter_block.search-search" component
    And I add the "block.views_block.search-search" component to the bottom of the "Webship search" Canvas page and publish it
    And I create a Canvas page "Webship findable page" at "/webship-findable-page" with the "Heading" component:
      | heading_text | Zebrafinch heading |
    Given I am not logged in
    And I am on "/search"
    Then I should see "Enter keywords to search."
    When I fill in "keywords" with "Zebrafinch"
    And I press "Search"
    Then the url should match "keywords=Zebrafinch"
    And I should see "Webship findable page"
    When I fill in "keywords" with "Qzxjvwk"
    And I press "Search"
    Then I should not see "Webship findable page"
    Given I am a logged in user with the "admin" user
    When I delete the "Webship findable page" Canvas page
    And I delete the "Webship search" Canvas page
    And I purge "Webship findable page" from the Canvas pages trash
    And I purge "Webship search" from the Canvas pages trash
    Then the Canvas pages trash should not hold "Webship search"

