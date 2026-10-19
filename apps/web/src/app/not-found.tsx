import { ButtonLink } from "@wyrm/ui";
import { Container } from "@/components/sections";

export default function NotFound() {
  return (
    <Container className="py-24 sm:py-32">
      <p className="text-sm font-semibold uppercase tracking-wider text-ember">404</p>
      <h1 className="mt-3 font-display text-4xl font-semibold">This page wandered off</h1>
      <p className="mt-4 max-w-xl text-lg text-ink-muted">
        The page you were looking for does not exist or has moved.
      </p>
      <div className="mt-8">
        <ButtonLink href="/">Back to the home page</ButtonLink>
      </div>
    </Container>
  );
}
