This project, codenamed "Бір сөз" (meaning "One Word"), is a browser-based language learning tool designed to solve the "post-course cliff"—the period after a language course ends when a student's skills rapidly decline due to lack of practice.

Instead of requiring dedicated study sessions, it integrates into the user's existing digital life by utilizing micro-waiting moments to maintain a constant, low-friction contact with the Kazakh language.

## Core Concept & Problem Solving

Traditional apps like Duolingo or Anki fail because they require a conscious decision to "sit down and study". This project shifts the paradigm from active study sessions to passive micro-interactions.

• The Problem: Once a formal course ends, students lose the daily environment of the language. Within 3-6 months, their foundation often crumbles.

• The Solution: A browser extension that acts as a lightweight "micro-captcha." It intercepts specific triggers (like opening a new tab or returning from an idle state) and presents a single small, skippable popup with one language task. The task should be quick, but it must not block browsing or enforce a hard time limit.

## Product Mechanics

The extension operates silently in the background, surfacing only when triggered by user behavior.

### Key Triggers

• New Tab: Opening a new tab in the browser.

• Idle Return: Coming back to the computer after a period of inactivity.

• Navigation: Every N-th link click. Page-transition and SPA-route handling can be added later if needed.

### The Learning Loop

• Task Type: For the initial version, the task is a simple multiple-choice English → Russian translation (1 out of 4). This is temporary for fast content generation and iteration; the long-term goal remains Kazakh practice.

• Popup UX: The task appears as a small centered popup overlay on top of the current page. It should be skippable and non-blocking. For new-tab moments, use the same popup approach wherever extension injection is allowed; no custom new-tab page is required for the MVP.

• Timing Feedback: Do not enforce a countdown or time limit. After completion, show a small timing notification/feedback so users can optionally try to answer faster next time.

• SRS Integration: It uses the SM-2 (Spaced Repetition System) algorithm to determine which words to show, ensuring the user focuses on what they are most likely to forget. Answer speed should influence the SRS quality score along with correctness/skips.

• User Control: Users can adjust the frequency of tasks, set "quiet hours," or quickly skip/dismiss a task if they are in a rush.

## Technical Architecture

To remain lightweight and private, the project is designed to be serverless for the MVP stage.

• Manifest v3 Extension: Built for Chrome.

• Storage: Progress and settings are stored locally via chrome.storage.local.

• Content: For the current MVP iteration, a static generated English → Russian word-pair dataset is acceptable. Later, replace this with a static JSON file containing 100–150 curated Kazakh word pairs (CEFR levels A1–A2) covering everyday topics.

• Dashboard: An internal extension page provides users with a visual streak, a 7-day progress graph, and a list of mastered words.

## Strategic Value for Institutions

The project offers a unique "Jury Angle" for language centers or government bodies:

1. Measurable Outcomes: It provides a dashboard showing how many words graduates actually retain months after their course ends.

2. Lifetime Impact: Unlike a 3-month course, this tool stays with the user indefinitely, turning the institution’s one-time effort into a lifelong habit.

3. Active Vocabulary Metrics: It measures real proficiency based on how quickly a user can identify a word without hints—a truer metric of fluency than "lessons completed".

## Roadmap & MVP Scope (24–48 Hours)

The focus is on delivering a polished "Micro-Experience" rather than a feature-heavy application.

|Phase|Included (Ship)|Excluded (Cut)|
|:----|:----:|---:|
|Development|New tab/Idle triggers, SM-2 logic, Dashboard|Mobile app, Syncing, Social features
|Content|Initially generated English-oriented content is acceptable for fast iteration; later replace with 100-150 hand-picked Kazakh word pairs|Machine-translated unreviewed bulk lists for final Kazakh content|
|UX|Small skippable popup, frequency settings, skip button, dark/light mode, optional passive elapsed-time indicator|Blocking pages, hard countdown failure, multiple task types, theme-matching content|

## Risks & Mitigations

• User Annoyance: If it interrupts too often, users will delete it. Fix: Default to low-frequency triggers, show only a small popup, and allow easy skipping.

• Content Quality: Machine translation errors break trust. Fix: Generated English-oriented content is acceptable temporarily for product iteration, but final Kazakh content should be hand-curated/reviewed.

• Political Context: The Kazakh language transition between Cyrillic and Latin scripts. Fix: Include a toggle in the settings to support both when Kazakh content is restored.

## Resolved Clarifications

1. Temporary content direction: English → Russian multiple-choice translation.
2. Popup placement: small centered popup overlay.
3. New-tab behavior: use the same small popup on top of pages where extension injection is allowed; no custom new-tab page for MVP.
4. Navigation trigger: count link clicks first. Page loads and SPA routes can be revisited later.
5. Passive timer: show timing feedback after completion as a small notification; no visible countdown and no enforced time limit.
6. SRS quality: answer speed should affect scheduling together with correctness/skips.
