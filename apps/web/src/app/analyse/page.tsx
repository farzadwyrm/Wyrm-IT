import type { Metadata } from "next";
import { WorkflowAnalyser } from "@/components/analyser/analyser";
import { Container, CtaBand, PageHeader } from "@/components/sections";

export const metadata: Metadata = {
  title: "Workflow analysis",
  description:
    "Map one business process, measure it, and get a structured assessment: which steps AI agents should run, under what controls, the business case and a phased rollout plan.",
};

export default function AnalysePage() {
  return (
    <>
      <PageHeader
        title="See what you could automate"
        intro="Answer a few questions about one task. You get a clear report: what to automate, what it saves and how to start. About 15 minutes."
      />
      <Container className="pb-8">
        <WorkflowAnalyser />
      </Container>
      <CtaBand secondary={false} />
    </>
  );
}
