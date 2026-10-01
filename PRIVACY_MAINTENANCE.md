# Portfolio privacy maintenance

This site uses the public professional name **Dilanjan DK**. The public site does not publish a direct email address, a phone number, a home address, or a downloadable detailed CV.

## Before publishing

- Review page text, metadata, image filenames, alt text, and documents for personal contact details, exact addresses, full legal name, personal dates, or references' details.
- Keep GitHub links limited to project pages where they directly support the work being shown.
- Do not publish a full CV or private reference information in `site/public`.

## Monthly checklist

- Search for the public name, `dilanjandk.com`, and distinctive project titles; check for unexpected mirrors, cloned profiles, or impersonation.
- Review Formspree submissions and mark spam in its dashboard.
- Review GitHub security alerts, active sessions, recovery methods, and two-factor authentication.
- Review new portfolio content before deployment and remove unneeded personal or timeline details.

## Formspree dashboard setup

Complete these account-side steps once for the existing form:

1. Open the Formspree project settings for form `mwkggdjb`.
2. Enable spam protection / reCAPTCHA.
3. Set **Restrict to Domain** to `dilanjandk.com` (without `www`, so both the root domain and subdomains are covered).
4. Test one normal form submission and one submission with the `_gotcha` field populated; the latter should be ignored as spam.

The repository adds the `_gotcha` honeypot field to both public forms. Domain restriction is intentionally configured in Formspree's dashboard because it cannot be safely controlled by deployed static-site source code.
