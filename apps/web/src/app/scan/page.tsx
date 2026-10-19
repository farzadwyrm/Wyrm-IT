import { QUESTIONS } from "@wyrm/assessment";
import type { Metadata } from "next";
import { ScanApp } from "@/components/scan/scan-app";
import { Container, PageHeader } from "@/components/sections";

export const metadata: Metadata = {
  title: "Free AI-Readiness Scan",
  description:
    "Answer 24 quick questions and see how ready your IT foundations are for AI, with your top fixes and an AI-written summary.",
};

export default function ScanPage() {
  return (
    <>
      <PageHeader
        eyebrow="Free AI-Readiness Scan"
        title="Is your business ready for AI?"
        intro="Four minutes, no sign-up. See how your accounts, devices, data and backups score across seven areas, and what to fix first."
      />
      <Container className="pb-24">
        <div className="max-w-3xl">
          <ScanApp questions={QUESTIONS} />
        </div>
      </Container>
    </>
  );
}
