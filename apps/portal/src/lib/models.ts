import "server-only";
import {
  answerAsAgent,
  answerFromDocuments,
  brainClassifiers,
  clientsFromEnv,
  expandQuestion,
  judgeReply,
} from "@wyrm/ai";
import type { Judge, KnowledgeDeps, RuntimeDeps } from "@wyrm/core";
import { calendarDeps } from "./calendar";

/**
 * Model connections for the brain (live chat, test runs) built from server-only environment
 * keys: Claude Haiku when ANTHROPIC_API_KEY is set, Groq's free models when GROQ_API_KEY is set.
 */
export function modelDeps(): { deps: RuntimeDeps; judge: Judge } {
  const clients = clientsFromEnv();
  const calendar = calendarDeps();
  return {
    deps: {
      classifiers: brainClassifiers(clients),
      answer: (knowledge, history, options) => answerAsAgent(clients, knowledge, history, options),
      ...(calendar ? { calendar } : {}),
    },
    judge: { judge: (expectation, transcript) => judgeReply(clients, expectation, transcript) },
  };
}

/** Models for "Ask your documents": free models only (search words and the cited answer). */
export function knowledgeDeps(): KnowledgeDeps {
  const clients = clientsFromEnv();
  return {
    expand: (question) => expandQuestion(clients, question),
    answer: (input) => answerFromDocuments(clients, input, { allowPaid: false }),
  };
}
