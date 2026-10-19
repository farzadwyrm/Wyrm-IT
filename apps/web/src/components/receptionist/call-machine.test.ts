import { describe, expect, it } from "vitest";
import {
  type CallEvent,
  type CallState,
  callReducer,
  initialCall,
  statusLabel,
} from "./call-machine";

const run = (events: CallEvent["type"][], start: CallState = initialCall) =>
  events.reduce((s, type) => callReducer(s, { type } as CallEvent), start);

describe("callReducer", () => {
  it("walks a normal call: request, connect, greet, listen, think, answer", () => {
    expect(run(["CALL"]).phase).toBe("requesting");
    expect(run(["CALL", "MIC_GRANTED"]).phase).toBe("connecting");
    expect(run(["CALL", "MIC_GRANTED", "SPEAK"]).phase).toBe("speaking");
    expect(run(["CALL", "MIC_GRANTED", "SPEAK", "SPOKEN"]).phase).toBe("listening");
    expect(run(["CALL", "MIC_GRANTED", "SPEAK", "SPOKEN", "HEARD"]).phase).toBe("thinking");
    expect(run(["CALL", "MIC_GRANTED", "SPEAK", "SPOKEN", "HEARD", "SPEAK"]).phase).toBe(
      "speaking",
    );
  });

  it("handles a blocked microphone and allows trying again", () => {
    const denied = run(["CALL", "MIC_DENIED"]);
    expect(denied.phase).toBe("denied");
    expect(run(["CALL"], denied).phase).toBe("requesting");
  });

  it("counts silences and resets them when the caller speaks", () => {
    const silent = run(["CALL", "MIC_GRANTED", "SPEAK", "SPOKEN", "SILENCE", "SILENCE"]);
    expect(silent.silences).toBe(2);
    expect(run(["HEARD"], silent).silences).toBe(0);
  });

  it("only hears the caller while listening (half-duplex)", () => {
    const speaking = run(["CALL", "MIC_GRANTED", "SPEAK"]);
    expect(run(["HEARD"], speaking).phase).toBe("speaking");
  });

  it("mutes only during a live call and clears mute when the call ends", () => {
    expect(run(["TOGGLE_MUTE"]).muted).toBe(false);
    const muted = run(["CALL", "MIC_GRANTED", "SPEAK", "SPOKEN", "TOGGLE_MUTE"]);
    expect(muted.muted).toBe(true);
    expect(statusLabel(muted, false)).toBe("You're muted");
    expect(run(["END"], muted)).toMatchObject({ phase: "ended", muted: false });
  });

  it("can end from any live phase, including while thinking or speaking", () => {
    for (const path of [
      ["CALL", "MIC_GRANTED"],
      ["CALL", "MIC_GRANTED", "SPEAK"],
      ["CALL", "MIC_GRANTED", "SPEAK", "SPOKEN", "HEARD"],
    ] as CallEvent["type"][][]) {
      expect(run([...path, "END"]).phase).toBe("ended");
    }
  });

  it("ignores events that do not fit the current phase", () => {
    expect(run(["SPEAK"])).toEqual(initialCall);
    expect(run(["HEARD"])).toEqual(initialCall);
    expect(run(["END"])).toEqual(initialCall);
  });

  it("shows a slower thinking message after a while", () => {
    const thinking = run(["CALL", "MIC_GRANTED", "SPEAK", "SPOKEN", "HEARD"]);
    expect(statusLabel(thinking, false)).toBe("One moment…");
    expect(statusLabel(thinking, true)).toBe("Checking the calendar…");
  });
});
