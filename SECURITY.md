# Security Policy

## Reporting a Vulnerability

Please **do not open a public GitHub issue** for suspected security vulnerabilities.

If you believe you have found a security vulnerability in this project, please report it privately using GitHub’s private vulnerability reporting feature:

1. Open this repository on GitHub.
2. Go to the **Security** tab.
3. Click **Report a vulnerability**.
4. Include as much detail as possible so we can understand, reproduce, and fix the issue.

If private vulnerability reporting is not available, please contact the maintainers privately at:

`adm-zip@pm.me`

## What to Include

Please include the following information in your report, where possible:

* The affected package, version, commit, or branch.
* A clear description of the vulnerability.
* Steps to reproduce the issue.
* A minimal proof of concept, if available.
* The expected impact of the vulnerability.
* Any known workarounds or mitigations.
* Whether the issue has been disclosed anywhere else.

Please avoid including sensitive data from real users or production systems in your report.

## Supported Versions

Security fixes are provided for the currently supported versions of this project.

| Version               | Supported                   |
| --------------------- | --------------------------- |
| Latest stable release | Yes                         |
| Older releases        | No, unless otherwise stated |

Users are encouraged to upgrade to the latest stable release to receive security fixes.

## Response Process

After receiving a report, we will try to:

1. Acknowledge the report within 3 business days.
2. Investigate and confirm the issue.
3. Work on a fix or mitigation.
4. Release a patched version when appropriate.
5. Publish a security advisory if the issue affects users.

We may contact you for additional information during the investigation.

## Disclosure Policy

Please give us a reasonable amount of time to investigate and fix the issue before publicly disclosing it.

Do not publicly disclose the vulnerability, proof of concept, or exploit details until we have released a fix or otherwise agreed that disclosure is appropriate.

## Security Advisories and Credit

When appropriate, we may publish a GitHub Security Advisory for confirmed vulnerabilities.

We are happy to credit reporters who responsibly disclose valid security issues, unless you prefer to remain anonymous.

## Scope

This policy applies to security vulnerabilities in this repository’s source code, official releases, and documented usage.

Examples of in-scope issues may include:

* Vulnerabilities in the library code.
* Unsafe behavior caused by documented usage.
* Issues that could lead to code execution, privilege escalation, data exposure, authentication bypass, or similar security impact.

Examples of out-of-scope issues include:

* Vulnerabilities only affecting unsupported versions.
* Vulnerabilities in third-party dependencies without a demonstrated impact through this project.
* Social engineering.
* Denial-of-service reports based only on excessive automated traffic.
* Issues requiring physical access, compromised developer machines, or already-leaked credentials.

## Safe Harbor

We consider security research conducted in good faith to be authorized, provided that you:

* Follow this policy.
* Avoid privacy violations, data destruction, and service disruption.
* Do not access, modify, or delete data that does not belong to you.
* Report the vulnerability privately and give us time to fix it.

This does not authorize testing against systems, services, or applications that you do not own or do not have permission to test.

## No Bug Bounty

This project does not currently offer a paid bug bounty program. Reports are appreciated, but compensation should not be expected unless explicitly agreed in advance.
