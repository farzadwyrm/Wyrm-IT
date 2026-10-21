import "server-only";
import { answerAsAgent, brainClassifiers, clientsFromEnv, judgeReply } from "@wyrm/ai";
import type { Judge, RuntimeDeps } from "@wyrm/core";

/**
 * Model connections for the brain (live chat, test runs) built from server-only environment
 * keys: Claude Haiku when ANTHROPIC_API_KEY is set, Groq's free models when GROQ_API_KEY is set.
 */
export function modelDeps(): { deps: RuntimeDeps; judge: Judge } {
  const clients = clientsFromEnv();
  return {
    deps: {
      classifiers: brainClassifiers(clients),
      answer: (knowledge, history, options) => answerAsAgent(clients, knowledge, history, options),
    },
    judge: { judge: (expectation, transcript) => judgeReply(clients, expectation, transcript) },
  };
}
