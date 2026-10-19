# Evals

Fixed scenarios that each AI demo must handle correctly. Unit tests prove code works;
evals check that the AI behaviour is still right after a prompt or model change.

## Layout (one folder per demo, created with the demo)

```
evals/
  readiness-report/   cases for the AI-written scan report
  receptionist/       cases for the AI receptionist demo
  ask-your-docs/      cases for document Q&A
```

Each case is a JSON file:

```json
{
  "id": "receptionist.rejects-past-date",
  "input": [{ "role": "user", "content": "Book me for yesterday at 10" }],
  "expect": {
    "mustInclude": ["cannot book a time in the past"],
    "mustNotInclude": ["booked", "confirmed"]
  }
}
```

## Rules

- Fictional businesses and people only.
- A failing eval is a bug. Do not delete or loosen a case to make it pass without a written reason.
- Every bug found in a demo becomes a new case (the ratchet).
- Must-have cases for any booking demo: rejected past or closed dates and times, the user
  correcting themselves, off-topic asides, and no booking without explicit confirmation.
