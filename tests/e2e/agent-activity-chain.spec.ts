import { expect, test } from "@playwright/test";
import { coalesceAgentActivity } from "../../apps/web/src/lib/chat/agent-activity";
import { groupMessages } from "../../apps/web/src/lib/chat/messages";
import type { Message } from "../../apps/web/src/lib/types";

function message(seq: number, overrides: Partial<Message> = {}): Message {
  return {
    id: `message-${seq}`,
    workspace_id: "workspace-1",
    channel_id: "channel-1",
    author_id: "bot-agent",
    thread_root_id: `message-${seq}`,
    channel_seq: seq,
    body: `message ${seq}`,
    body_format: "markdown",
    created_at: new Date(Date.UTC(2026, 4, 9, 0, seq)).toISOString(),
    ...overrides,
  };
}

const visibleActivity = {
  hideCommentary: false,
  hideToolCalls: false,
};

test("long agent turns keep the preamble and exact final answer in one group", () => {
  const activity = message(1, {
    kind: "agent_commentary",
    turn_id: "turn-long",
    created_at: "2026-05-09T00:00:00Z",
  });
  const final = message(2, {
    body: "Final answer after a long tool run",
    created_at: "2026-05-09T00:12:00Z",
  });

  const coalesced = coalesceAgentActivity(
    [activity, final],
    visibleActivity,
    Date.parse("2026-05-09T00:12:00Z"),
  );

  expect(coalesced[0].preamble_block).toMatchObject({
    final: true,
    finalMessageId: final.id,
  });
  const groups = groupMessages(coalesced);
  expect(groups).toHaveLength(1);
  expect(groups[0].messages.map((item) => item.id)).toEqual([activity.id, final.id]);
});

test("later final response wins over an ordinary progress message in the same turn", () => {
  const activity = message(1, {
    kind: "agent_commentary",
    turn_id: "turn-progress",
  });
  const progress = message(2, { body: "Checking the deployed component." });
  const laterTool = message(3, {
    kind: "agent_tool",
    turn_id: "turn-progress",
    body: "**browser inspect**\n\nchecked the live UI",
  });
  const final = message(4, { body: "The deployed component is corrected." });

  const coalesced = coalesceAgentActivity([activity, progress, laterTool, final], visibleActivity);

  expect(coalesced.map((item) => item.id)).toEqual([progress.id, activity.id, final.id]);
  expect(coalesced.at(-2)?.preamble_block?.finalMessageId).toBe(final.id);
  expect(groupMessages(coalesced).at(-1)?.messages.at(-1)?.id).toBe(final.id);
});

test("an unfinished turn cannot claim a later turn's final answer", () => {
  const firstTurn = message(1, {
    kind: "agent_commentary",
    turn_id: "turn-one",
  });
  const secondTurn = message(2, {
    kind: "agent_commentary",
    turn_id: "turn-two",
  });
  const secondFinal = message(3, { body: "Second turn final" });

  const coalesced = coalesceAgentActivity([firstTurn, secondTurn, secondFinal], visibleActivity);

  expect(coalesced[0].preamble_block?.finalMessageId).toBeUndefined();
  expect(coalesced[1].preamble_block?.finalMessageId).toBe(secondFinal.id);
});
