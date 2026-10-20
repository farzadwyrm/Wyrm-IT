import type { Metadata } from "next";
import { WorkflowAnalyser } from "@/components/analyser/analyser";
import { Container, CtaBand, PageHeader } from "@/components/sections";

export const metadata: Metadata = {
  title: "Workflow analysis",
  description:
    "Six quick questions about one task: see which steps AI can do, where you stay in control, and how many hours a week it could free up.",
};

export default function AnalysePage() {
  return (
    <>
      <PageHeader
        eyebrow="workflow analysis"
        title="See what AI could take off your plate"
        intro="Answer six quick questions about one task. You get a clear answer: which steps AI can do, where you stay in control, and how many hours a week it could free up."
      />
      <Container className="pb-8">
        <WorkflowAnalyser />
      </Container>
      <CtaBand />
    </>
  );
}
