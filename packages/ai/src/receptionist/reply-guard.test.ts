import { formatTime, freeTimes, SERVICES, type Service } from "@wyrm/receptionist";
import { describe, expect, it } from "vitest";
import { reviewReply, safeReply } from "./reply-guard";
import { executeTool, type Proposal } from "./tools";

const NOW = new Date(2026, 9, 19, 10, 0);
const CHECKUP = SERVICES.find((s) => s.id === "checkup") as Service;
const THURSDAY = "2026-10-22";
const NOON = freeTimes(THURSDAY, CHECKUP, NOW, []).find((t) => t >= 12 * 60) as number;
const hhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function proposal(time = NOON): Proposal {
  const out = executeTool(
    "propose_booking",
    { service_id: "checkup", day: THURSDAY, time: hhmm(time), name: "Sam" },
    { now: NOW, bookings: [], pendingFromEarlierTurn: null, latestVisitorMessage: "" },
  );
  if (out.event?.type !== "proposed") throw new Error("expected proposal");
  return out.event.proposal;
}

const booking = {
  reference: "HL-4321",
  serviceId: "checkup",
  day: THURSDAY,
  time: 16 * 60,
  name: "Sam",
};

describe("reviewReply", () => {
  it("flags a booking claim when nothing was booked (live bug)", () => {
    const issue = reviewReply(
      "All done, your check-up is booked for Thursday the 22nd of October at 4 pm, reference P-20261022-1600-checkup.",
      { eventsThisTurn: [], pending: proposal(), bookings: [] },
    );
    expect(issue?.kind).toBe("internal_id");
    expect(
      reviewReply("All done, your check-up is booked for Thursday the 22nd at 4 pm.", {
        eventsThisTurn: [],
        pending: proposal(),
        bookings: [],
      })?.kind,
    ).toBe("false_booking_claim");
  });

  it("flags a read-back of a time that was never proposed (live bug)", () => {
    const issue = reviewReply(
      "Sure, 4 pm on Thursday the 22nd of October works. So that's a check-up for Sam at 4 pm that day. Is that right?",
      { eventsThisTurn: [], pending: proposal(), bookings: [] },
    );
    expect(issue?.kind).toBe("unproposed_read_back");
  });

  it("accepts a booking claim when a booking really happened this turn", () => {
    expect(
      reviewReply("You're booked! Your reference is HL-4321.", {
        eventsThisTurn: [{ type: "booked", booking }],
        pending: null,
        bookings: [booking],
      }),
    ).toBeNull();
  });

  it("accepts mentioning an earlier real booking (goodbye summary)", () => {
    expect(
      reviewReply("You're all set for Thursday the 22nd at 4 pm, reference HL-4321. Goodbye!", {
        eventsThisTurn: [],
        pending: null,
        bookings: [booking],
      }),
    ).toBeNull();
  });

  it("accepts reading back the proposal that is waiting", () => {
    const p = proposal();
    const said = `So that's a check-up on Thursday the 22nd at ${formatTime(p.time)} for Sam. Is that right?`;
    expect(reviewReply(said, { eventsThisTurn: [], pending: p, bookings: [] })).toBeNull();
  });

  it("ignores confirmation questions that mention no time", () => {
    expect(
      reviewReply("Your name is Sam, is that right?", {
        eventsThisTurn: [],
        pending: null,
        bookings: [],
      }),
    ).toBeNull();
  });
});

describe("safeReply", () => {
  it("is honest that nothing is booked and offers the waiting proposal", () => {
    expect(safeReply(proposal(), [])).toMatch(
      /^Just to be sure, nothing is booked yet\. Would you like me to book a check-up on Thursday 22 October/,
    );
  });
});
