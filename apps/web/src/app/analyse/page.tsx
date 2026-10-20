import type { Metadata } from "next";
import { WorkflowAnalyser } from "@/components/analyser/analyser";
import { Container, CtaBand, PageHeader } from "@/components/sections";

export const metadata: Metadata = {
  title: "Workflow analysis",
  description:
    "Analyse one of your workflows in about seven minutes: a process map, a verdict for every step (automate, AI agent, AI assist or keep human), a risk tier with guardrails, an agent design and the hours it would free up.",
};

export default function AnalysePage() {
  return (
    <>
      <PageHeader
        eyebrow="workflow analysis"
        title="Find out which steps an AI agent should take over"
        intro="The same method automation consultants use, in about seven minutes: map one workflow from the last real case, time each step, and get a verdict per step, a risk tier with guardrails, an agent design and an honest range of hours saved."
      />
      <Container className="pb-8">
        <WorkflowAnalyser />
      </Container>
      <CtaBand />
    </>
  );
}
