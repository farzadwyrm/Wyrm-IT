import type { Metadata } from "next";
import { WorkflowPlanner } from "@/components/planner/workflow-planner";
import { Container, CtaBand, PageHeader } from "@/components/sections";

export const metadata: Metadata = {
  title: "AI workflow planner",
  description:
    "Describe a task your team does by hand. Our AI designs the agent workflow for it: trigger, agent steps, systems, human checks and guardrails.",
};

export default function PlannerPage() {
  return (
    <>
      <PageHeader
        eyebrow="workflow planner"
        title="Describe the work. Get the agent workflow."
        intro="Tell us a task your team repeats every week. The AI designs how an agent would run it: what triggers it, what the agent does, which systems it touches and where a person stays in control."
      />
      <Container className="pb-8">
        <WorkflowPlanner />
      </Container>
      <CtaBand />
    </>
  );
}
