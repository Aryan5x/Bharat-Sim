# Market Fit Canvas: draft (BharatSim, Team Deccans)

**Read this first.** No customer interviews have been run yet. Everything below marked HYPOTHESIS is
the team's assumption and must be replaced with real findings. Nothing here is customer evidence.

| Block | Content | Status |
|---|---|---|
| Customer segment | Small Android teams (2–20 engineers) shipping payments, public-service or education apps to Tier-2/3 India users, without a device lab | HYPOTHESIS |
| Problem | Failures that only show up on cheap phones and weak networks (timeouts turning into duplicate charges, OOM kills, ANRs) are found by users, not before release | HYPOTHESIS |
| Current alternatives | Manual testing on a few team phones; BrowserStack / Firebase Test Lab (real devices, but no Indian network conditions or vernacular reporting); Android Studio emulator by hand | Desk research, to verify |
| Unique value | Describe the bug in your language → runnable test on a budget-phone emulator → measured assertions → FixProof says whether the next build fixed it, explained in Hindi/Tamil/Marathi | Built (see FINALE_AUDIT.md) |
| Key metric | Bugs reproduced and fixes verified per team per month | Proposed |
| Channels (first 100 users) | Android developer communities (GDG chapters, Android India meetups), college incubators, fintech/UPI developer forums, public-service app vendors via hackathon networks | Proposed, untested |
| Pricing | Free tier (a few runs per day); paid per-run or team plan. No price has been tested | HYPOTHESIS |
| First payer | Small fintech/UPI app team, because a duplicate charge costs money and trust | HYPOTHESIS, no conversations yet |
| Named first user | Not yet identified | NOT DONE |

## Customer validation status
- Interviews completed: **0 of 3 required**. Nothing is recorded because none have happened.
- Product changes from feedback: **none yet**.
- To do before judging: run 3 real conversations (e.g. two Android developers and one PM), record date, role, the
  problem they described, and one product change made because of it. Do not fill this in from assumptions.

## Competitor notes (desk research, verify before quoting)
- BrowserStack App Live/Automate, Firebase Test Lab, AWS Device Farm: real devices and automation, global focus.
- Network link conditioners (Charles, Android emulator console): manual, no reporting or fix verification.
- BharatSim's difference: language-first test creation (Sarvam), Indian network personas, evidence-backed FixProof.
