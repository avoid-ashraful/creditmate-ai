# Product review — October 2026

CreditMate helps Bangladeshi consumers discover and compare credit cards. The existing product already includes categories, recommendations, rewards estimates, comparison/share, saved collections, alerts, reviews, source links, and English/Bengali content. Building duplicate versions of those features would add little value.

## Prioritized delivery list

1. **P0: Supported runtimes and reproducible dependencies.** Upgrade Python and the frontend toolchain after compatibility checks. Keep lockfiles authoritative. Acceptance: clean installs, application checks, tests, production/container builds, and documented supported versions.
2. **P0: Repair CI and improve test coverage.** Diagnose the backend repository's failed Tests and Code Quality workflows. Remove dependency mutations during CI and use meaningful deterministic checks. Include `common` and root API-contract tests in the parent matrix. Acceptance: hosted checks pass for the actual PR heads; do not bypass checks.
3. **P1: Borrowing costs in the rewards calculator.** Add optional average carried balance; estimate annual interest from the published APR and show net annual value after interest. Zero balance retains the current behavior. Unknown APR remains unknown and cannot win a definitive borrowing-cost ranking. Acceptance: input validation, unknown/zero handling, ranking regression tests, accessible localized UI, and browser flow checks.
4. **P1 follow-up: Fee-waiver scenarios.** Distinguish spend thresholds, transaction counts, first-year offers, renewal rules, and VAT. Let users model a scenario without asserting they qualify. Acceptance: explicit conditions, unknowns preserved, first-year/renewal tests, and source links. Requires a separate extraction/model audit before numeric estimates.
5. **P1 follow-up: Data freshness and conflicting terms.** Existing verification timestamps and correction reports are a foundation. Add visible stale/conflict states and an operator queue. Acceptance: timestamp provenance, defined freshness policy, no automatic claim that a fresh crawl equals human verification.
6. **P1 follow-up: Accessibility and bilingual parity.** Extend keyboard/mobile tests for comparison, borrowing scenarios, and bank terms; review Bengali financial labels. Acceptance: keyboard-only completion and desktop/tablet/mobile coverage with translated errors and assumptions.
7. **P2 follow-up: Application preparation checklist.** Provide source-linked bank-specific documents and eligibility requirements. Acceptance: no approval predictions, no collection of NID/income documents, and dated bank sources.

The batch also fixes audited regressions: Advanced Search rendering, honest device-local search saves, public collection share routes, public comparison visibility queries, and review submission quotas. Items 1–3 are the initial implementation batch. Follow-ups are a product backlog, not claims of delivered functionality. Verification and implementation details belong in PR descriptions and delivery notes.

## Market evidence and implications

- [NerdWallet's comparison tool](https://www.nerdwallet.com/credit-cards/compare) exposes fees and rewards side by side. CreditMate already covers comparison; clearer costs offer a more useful next increment than another comparison page.
- [EBL card terms](https://www.ebl.com.bd/assets/cards/5631f7364325796573be41c650e342b3.pdf) describe finance charges based on average daily balance when the current balance is not fully paid by the due date. An annual average-balance estimate can illustrate cost, but cannot replace the bank's billing calculation.
- [CFPB's explanation of interest calculations](https://www.consumerfinance.gov/ask-cfpb/how-does-my-credit-card-company-calculate-the-amount-of-interest-i-owe-en-51/) explains daily balance calculations. This supports explicit assumptions and excludes presenting a simple APR estimate as a repayment schedule. US legal requirements are not applied to Bangladesh.
- [EBL card listings](https://www.ebl.com.bd/retail/EBL-Cards) include transaction-based annual fee waivers; [EBL schedules](https://www.ebl.com.bd/charges) provide the underlying terms. These support a conditional waiver scenario rather than treating all annual fees as automatically waived.
- [City Bank's published Islamic card schedule](https://citybankplc.com/uploads/files/reports/fees-and-charges/17803057665335721.pdf) distinguishes first-year/renewal fees and maintenance charges. Missing APR on an Islamic product must not imply borrowing is free.

These are qualitative product observations from primary product/bank material, not a market-size study or proof of conversion uplift. Research accessed 2026-10-20; bank schedules can change. Calculator values must come from card records, never hardcoded from this research.

## Delivery approach

Three isolated implementation streams: backend runtime/CI, frontend dependency/toolchain modernization, and borrowing-cost scenarios. Initial drafts used Codex N and an OpenCode free model; reviewed repairs and validation used replacement Codex workers where those drafts stalled or failed review. The parent agent reviews source changes and independent test evidence, integrates the component commits, verifies hosted checks, and merges ready PRs. Existing local QA artifacts remain untouched. No production data, crawls, deployments, or credentials are changed by this batch.

## Initial batch verification

The implementation uses Python 3.14 (supported 3.13–3.14), Node 24, Vite 8, Jest 30, TypeScript 5.9, and Router 7.18.4. It includes the borrowing-cost scenario and audited sharing/search/quota repairs. Local validation passed 2,400 backend tests on Python 3.13, 2,398 on Python 3.14 plus separately verified new visibility cases, 65 Redis regressions, 1,129 frontend tests, and nine new browser cases across three viewport sizes. Types, lint, formatting, token reproducibility, schema/migrations, production build, bundle limits, and Storybook also passed. Hosted PR checks remain the final merge gate, including image builds on the parent PR.

Production dependency audits report no known vulnerabilities. The frontend development-inclusive audit fell from 114 findings to 38 (15 high, 22 moderate, one low). Those remaining Storybook/lint dependency findings are explicit maintenance debt; the runtime image installs production dependencies only. Major development-tool upgrades require their own compatibility checks. Neither audit results nor synthetic browser fixtures establish the correctness or freshness of live bank terms.
