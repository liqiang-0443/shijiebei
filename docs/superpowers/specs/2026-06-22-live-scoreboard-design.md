# Live Scoreboard Design

## Goal

Make the live-results tab a compact, readable FIFA scoreboard on desktop and mobile.

## Layout

- Remove the unused match-number badge.
- Render one stable scoreboard row per match: kickoff time, home team, score, away team, and status.
- Use red only for the live score/status emphasis. Finished and scheduled states remain restrained.
- Preserve a one-column, no-horizontal-scroll layout on narrow screens.

## Refresh

- Add a refresh icon button beside the tab heading.
- The button requests the existing live-results endpoint immediately.
- Disable the button while a request is in flight and restore it on success or failure.
- Keep the existing one-minute background sync while the tab is active.

## Data States

- Live matches display the FIFA-provided half/minute.
- Finished matches display the final score and completed state.
- Fallback data remains visibly marked by the existing updated-state text.

## Verification

- Add renderer tests confirming the unused match code is absent and the refresh control is present.
- Run the full Node test suite and inspect the local responsive page.
