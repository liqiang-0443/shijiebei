# World Cup Workbench Design

## Purpose

Turn the current separate selection page and submission admin page into one World
Cup workbench. The application remains an information, selection, and record
tool; it does not place bets or take payments.

The first view must contain four tabs in this order:

1. `实时赛况`
2. `明日情报`
3. `明日选单`
4. `选单结果`

All date boundaries use `Asia/Shanghai`. "Today" and "tomorrow" are therefore
consistent across the displayed matches, submissions, live data, and analysis.

## User Experience

### 实时赛况

Show only today's World Cup matches. Each match card contains the match number,
teams, scheduled start time, current score, and one of these statuses: scheduled,
first half, halftime, second half, finished, or postponed. Live matches also
show the current minute. When available, show a compact time line of goals,
cards, and substitutions.

The tab automatically refreshes every 60 seconds and displays the most recent
successful server synchronization time. It must never show a source name.

### 明日情报

Show only tomorrow's World Cup matches. Each match has a compact overview
(ranking, current tournament record, recent form, and head-to-head summary) and
a separate prediction panel. The prediction panel contains:

- a win/draw/loss preference and confidence;
- a handicap win/draw/loss preference based on the actual handicap for the match;
- a specific total-goals preference plus an optional adjacent alternative;
- three ranked score candidates;
- one or two ranked half/full-time combinations from the nine official outcomes;
- short evidence and risk lists.

Predictions are explicitly labeled as analysis preferences. A low-confidence
result must say why the data is weak or contradictory.

### 明日选单

Retain the existing odds, selection, multiplier, prize estimate, name, and
submission flow. The selection tray appears only in this tab. Switching tabs or
automatic data refreshes must retain all in-progress selections in local
storage.

### 选单结果

Merge the current `admin.html` behavior into the fourth tab. It shows only
today's Beijing-time submissions, supports person and pass-mode filters,
displays payer totals, groups picks by match, and retains direct deletion.

## Backend Data Flow

The Node server remains the only component that contacts external sources.
Browser code only requests the local application API.

### Existing odds task

Retain the five-minute odds refresh and the existing parsing/caching behavior.

### Live-results task

Add a live-source adapter which queries a public football live-score page and
normalizes source fields to match ID, scheduled time, status, minute, score, and
events. The first candidate source is the 500 live-score site; implementation
must validate the actual response shape before relying on it.

Run the task every minute. Filter and cache only today's World Cup matches in
`live-YYYY-MM-DD.json`. On a source or parsing failure, preserve the last good
cache, expose its successful update time, and log the failure. Do not invent a
live minute, score, or event.

### Analysis-input task

Add an analysis-source adapter for tomorrow's standings, tournament record,
recent matches, and head-to-head data. Normalize all source values before use.
Store the raw data together with the odds snapshot that is current at generation
time in `analysis-raw-YYYY-MM-DD.json`.

### Analysis task

At Beijing time `00:10`, `04:10`, `08:10`, `12:10`, `16:10`, and `20:10`, build
one analysis payload for tomorrow's four matches and submit it to a model API.
The task must be scheduler-based rather than an in-memory interval alone: after
a server restart, it checks whether the current four-hour slot is missing and
runs once when needed.

The model is instructed to use only the supplied structured facts. Its response
is validated against a fixed schema before it is saved to
`analysis-YYYY-MM-DD.json`. One analysis record includes a data snapshot time,
analysis generation time, all prediction fields, evidence, risks, and an
explicit confidence level. The UI reads only the latest saved version; old
versions may remain on disk for operational diagnostics.

No manual re-analysis endpoint is added.

## API Contract

Keep existing endpoints unchanged and add:

- `GET /api/live-matches`: today's normalized live match list and the last
  successful synchronization timestamp.
- `GET /api/match-analysis`: tomorrow's normalized facts, generated analysis,
  data timestamp, and generation timestamp.

Both endpoints return a stable empty-state response when there are no relevant
matches. A cache failure returns the last good payload with a stale indicator;
an initial failure returns a readable unavailable state rather than a 500 page.

## Storage and Secrets

Persist new cache files in the existing `DATA_DIR` volume so Docker redeploys do
not discard them. Add the model API key only as a VPS environment variable, for
example `OPENAI_API_KEY`; it must not appear in Git, static files, browser
responses, logs, or saved analysis records.

The deployment script and documentation will expose the variable as an optional
feature configuration. When the key is absent, the analysis tab stays available
but explains that the next analysis has not been generated; live scores,
selections, and records keep working.

## Frontend Structure

Replace the standalone pages with one page shell and a four-button tab bar.
Split client code into a tab controller and focused modules for selection,
results, analysis, and submissions. Reuse existing selection and admin rendering
logic where possible, while keeping each tab responsible only for its own data
and refresh timer.

The layout remains mobile-first, contains no horizontal page scrolling, and uses
compact match cards. The selected-ticket tray is fixed only while the selection
tab is active.

## Validation

Before release, verify:

1. All tabs work at desktop and narrow mobile widths without horizontal scroll.
2. Tab switching preserves selections, multiplier, and name.
3. Live refresh runs every minute and stale-cache handling preserves the last
   successful result.
4. Analysis scheduler produces at most one record per scheduled four-hour slot,
   including after a server restart.
5. The model response schema rejects missing or invalid half/full-time results.
6. API keys are absent from responses, logs, Git status, and static assets.
7. Existing submission, filtering, summary, and deletion behavior still works.

