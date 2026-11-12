Feature: Search engine optimisation
  As a site owner
  I want the pages to carry the meta tags, the sitemap and the robots rules
  So that search engines and social networks read the site correctly

  Background:
    Given the site template is "drupal_cms_starter"

  Scenario: The front page carries its meta tags
    Given I am not logged in
    And I am on the homepage
    Then the "og:type" meta tag should be "website"
    And the "og:title" meta tag should be "Home"
    And the "twitter:card" meta tag should be "summary_large_image"
    And the "twitter:title" meta tag should be "Home"
    And the "Generator" meta tag should contain "Drupal 11"
    And the "og:title" meta tag should not contain any HTML tags

  Scenario: A utility page fills its meta tags from its fields
    Given I am a logged in user with the "content editor" user
    And I am on "/privacy-policy"
    Then the "og:title" meta tag should be "Privacy policy"
    And the "og:type" meta tag should be "article"
    And the "twitter:title" meta tag should be "Privacy policy"
    And the canonical URL should end with "/privacy-policy"
    And the "description" meta tag should not contain any HTML tags

  Scenario: The XML sitemap lists the front page
    Given I am not logged in
    And I am on "/sitemap.xml"
    Then the response status code should be 200
    And the response should contain "http://www.sitemaps.org/schemas/sitemap/0.9"
    And the response should contain "<loc>"

  Scenario: robots.txt keeps crawlers out of the back end
    Given I am not logged in
    And I am on "/robots.txt"
    Then the response status code should be 200
    And the response should contain "Disallow: /admin/"
    And the response should contain "Disallow: /user/login"

  Scenario: The administrator opens the SEO tools
    Given I am a logged in user with the "admin" user
    When I am on "/admin/config/search/metatag"
    Then I should see the page title "Metatag"
    When I am on "/admin/config/search/simplesitemap"
    Then I should see the page title "Simple XML Sitemap"
    When I am on "/admin/config/search/redirect"
    Then I should see the page title "Redirect"
    And the page should not have PHP errors
