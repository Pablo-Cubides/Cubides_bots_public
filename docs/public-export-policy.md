# Public export policy

This repository is a curated source-code edition, not a mirror or backup of a private workspace. Only the exact text files listed in public-manifest.json may be published.

Allowed: selected dependency-free source, synthetic examples, tests, public architecture and a CI workflow without service secrets.

Excluded: personal profiles, health/academic records, contacts, conversations, memories, dossiers, operational reports, logs, session screenshots, credentials, encrypted secret containers, environment files, cookies, browser profiles, account IDs, private endpoints and private Git metadata/history.

Before publishing, review the exact manifest and compare its contents with private identifiers without copying those values into reports. Then run a separate redacting secret scan on the working tree and all history intended for publication. Check examples, documentation, source literals and commit metadata.

Automated checks are defense in depth, not a guarantee that arbitrary personal information can always be recognized. New exports require a content review and both passes again. Never add real identifiers as scanner fixtures or allowlist exceptions.
