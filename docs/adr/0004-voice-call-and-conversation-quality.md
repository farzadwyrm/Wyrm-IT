# ADR 0004: Simulated phone call and conversation-quality upgrade

Date: 2026-10-19 · Status: accepted

## Context

The owner asked for the receptionist to sound like a human answering the phone, with a voice
mode that simulates a call and a polished audio visualisation. Two read-only specialist reviews
were commissioned (roles `ai_quality` and `ui_designer`, following ReceptionAI's
`AGENT_TEAM.md` / `AGENT_REVIEW_STANDARD.md`). Their findings drive this change.

## Decisions

### Voice (free, in the browser)
- Speech to text: Web Speech API (`apps/web/src/lib/voice/recognition.ts`). Chrome sends audio to
  Google's speech service, Edge can recognise English on the device, Safari uses Apple's service,
  Firefox is unsupported (the page offers the chat). The page says so.
- Text to speech: `speechSynthesis` with the most natural English voice available
  (`voices.ts`), replies converted to spoken form in code (`speech-text.ts`: references letter
  by letter, euros, ordinal dates, 24-hour times).
- Half-duplex turn-taking: the microphone listens only while the receptionist is silent, which
  avoids echo. "Skip" interrupts by button. Voice barge-in is a later improvement.
- Upgrade paths (not done): in-browser neural TTS (Kokoro, about 86 MB) or a paid voice provider.

### Call experience (ui_designer)
- One shared session for Chat and Call (`use-receptionist-session.ts`); `[Chat | Call]` switch.
- Pure call state machine (`call-machine.ts`), every state also shown as text in a status region.
- "Tide ring" canvas visualiser (`tide-ring.tsx`): ember and filled when the receptionist speaks,
  driven by a **simulated** envelope (`lib/voice/envelope.ts`) because `speechSynthesis` exposes no
  audio stream; ink with six lobes when the visitor speaks, driven by the real microphone level
  (`mic-level.ts`); a comet while a request is in flight; a moss pulse on booking. Reduced-motion
  mode draws a static ring with stepped thickness. Colours come from theme tokens.

### Conversation quality (ai_quality)
- **AIQ-1 (safety):** `isClearYes` now rejects unpunctuated changes and questions typical of
  speech recognition ("ok what about friday") and accepts natural yeses ("that's fine, go on
  then"). Regression tests in `confirmation.test.ts` and `agent.test.ts`.
- **AIQ-2:** text written alongside tool calls is kept (aside answers, "let me have a look").
- New system prompt (sections, examples, Haiku adherence line) plus a channel block for chat vs
  voice; the waiting proposal and bookings are described in words; 21-day calendar.
- Tools: `part_of_day` filter, spread suggestions, spoken labels (`say`, `summary_say`,
  `reference_say`), natural error wording.
- One-off AI failures retry next turn instead of switching to the basic receptionist for good
  (two in a row still switch).
- Cost accounting includes prompt-cache writes and reads.
- 14 new live eval scenarios run for both chat and voice, with deterministic human-likeness checks.

## Consequences and limits

- Not verified: real microphones, accents, room noise, each browser's voices and `boundary`
  events, iOS Safari, echo cancellation, and all live-model behaviour (`pnpm eval` needs an API
  key). Effort `low` vs `medium` for Haiku 5.5 should be compared with the evals once a key exists.
- Browser voices vary in quality; the receptionist's voice depends on the visitor's device.
- Automated tests use Chromium's fake microphone and scripted speech fakes (`apps/web/e2e/fake-speech.ts`).
