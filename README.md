# Cubides Bots — public automation toolkit

Selected automation components from a maintained private workspace, packaged as reproducible examples. This public edition demonstrates the decision logic behind approval workflows, editorial planning and content-quality checks. It runs locally without accounts, API keys or third-party packages.

## Run the examples

Requires Node.js 24 or newer.

```sh
git clone https://github.com/Pablo-Cubides/Cubides_bots_public.git
cd Cubides_bots_public
npm ci
npm run check
```

`npm run demo` produces a deterministic JSON report using synthetic content and reserved `example.com` URLs. It makes no network requests, sends no messages and publishes no posts.

## Concrete automations

| Automation | Input | Result | Implementation |
|---|---|---|---|
| Explicit approval commands | A short approval, rejection or revision instruction | Distinguishes a request to send from a question, draft or edit | [`src/approval-commands.mjs`](src/approval-commands.mjs) |
| Weekly editorial planning | Content pieces, a weekly pattern and available dates | Proposed moves, missing slots and surplus content, with sequencing checks | [`src/editorial-planner.mjs`](src/editorial-planner.mjs) |
| Page and sitemap quality review | HTML, canonical URL and response statuses | Findings for broken URLs, thin content, metadata and structured data | [`src/site-audit.mjs`](src/site-audit.mjs) |
| Pre-publication article checks | Title, slug, description and Markdown content | Normalized slugs and actionable publication-quality findings | [`src/article-quality.mjs`](src/article-quality.mjs) |

These modules separate decisions from side effects. The examples show what would happen before any integration sends a message or changes a publishing schedule. They are building blocks, not a hosted assistant or a complete messaging connector. An approval parser alone is not authorization: any real connector must also verify the actor, permissions and pending action.

## What to inspect

- [`examples/offline-demo.mjs`](examples/offline-demo.mjs): one runnable example covering approval, planning and quality checks.
- [`tests/automations.test.mjs`](tests/automations.test.mjs): behavior checks, including ambiguous approvals, immutable inputs and incorrect canonical URLs.
- [`docs/architecture.md`](docs/architecture.md): how these components fit into a larger automation system and their limitations.
- [`docs/public-export-policy.md`](docs/public-export-policy.md): the boundary between reusable software and private operational context.

There are no adoption, accuracy or time-saving claims in this edition. Tests verify the stated behaviors; live integrations, model quality and operational outcomes are outside the offline demo's scope.

## Project history

The earlier standalone [WhatsApp LLM chatbot](https://github.com/Pablo-Cubides/chatbot-whatsapp-llm) is retained as a historical reference. Its automation work continued in the broader bots workspace. This curated public edition replaces the older environment-specific template with small, inspectable examples of the current automation logic.

## Privacy and contributions

Do not submit real conversations, names, addresses, account identifiers, tokens or production configuration in examples, issues or pull requests. Use synthetic fixtures and reserved example domains. See [SECURITY.md](SECURITY.md) for reporting guidance and the scope of automated checks.

Source is publicly available for inspection. No open-source license is granted; all rights are reserved.
