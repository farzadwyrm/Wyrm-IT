import type { Metadata } from "next";
import { WorkflowAnalyser } from "@/components/analyser/analyser";
import { Container, CtaBand, PageHeader } from "@/components/sections";

export const metadata: Metadata = {
  title: "Workflow assessment",
  description:
    "Map one business process, measure it, and get a structured assessment: which steps AI agents should run, under what controls, the business case and a phased rollout plan.",
};

export default function AnalysePage() {
  return (
    <>
      <PageHeader
        eyebrow="workflow assessment"
        title="Assess a process for AI automation"
        intro="Map one process as it runs today, with volumes, step times and exceptions. You get the assessment a consultant would produce: a recommendation, process KPIs, a step-by-step automation verdict capped by risk, the business case and a rollout plan. About 15 minutes."
      />
      <Container className="pb-8">
        <WorkflowAnalyser />
      </Container>
      <CtaBand />
    </>
  );
}
