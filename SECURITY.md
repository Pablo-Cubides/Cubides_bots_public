# Security and privacy

This edition is intended for offline inspection and synthetic demonstrations. It contains no production connector configuration and does not require service credentials.

Do not post a suspected credential, personal record or unredacted incident log in a public issue. Use GitHub's private vulnerability reporting for this repository when available. A minimal synthetic reproduction can be shared after sensitive values have been removed.

The public checks enforce an exact file manifest and reject common credential and account patterns. They do not replace review, identity verification, connector authorization, network restrictions or production security testing.

If a real secret is exposed, revoke or rotate it first. Deleting a file in a later commit does not erase earlier Git history. Coordinate any history cleanup with the repository owner; do not publish the value while reporting the problem.

No response-time SLA or security certification is promised for this personal project.
