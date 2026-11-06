import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Explanation } from "@/engine/explain/select";
import { ExplanationView } from "./ExplanationView";

afterEach(cleanup);

const explanation = (tier: 1 | 2 | 3): Explanation => ({
  moment: "correct",
  blocks: [{ kind: "fact", id: "IRL.f9", tier, text: "Ireland has no native snakes." }],
  snippetIds: ["f:IRL.f9"],
});

describe("ExplanationView", () => {
  it("puts a heading above a tier 3 fact, apart from the fact itself", () => {
    render(<ExplanationView explanation={explanation(3)} />);
    const label = screen.getByText("Bonus fact");
    const fact = screen.getByText("Ireland has no native snakes.");
    expect(fact).not.toContainElement(label);
    expect(label.compareDocumentPosition(fact) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows other facts without a heading", () => {
    render(<ExplanationView explanation={explanation(2)} />);
    expect(screen.queryByText("Bonus fact")).toBeNull();
    expect(screen.getByText("Ireland has no native snakes.")).toBeInTheDocument();
  });
});
