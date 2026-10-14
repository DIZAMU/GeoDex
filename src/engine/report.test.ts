import { describe, expect, it } from "vitest";
import { reportIssueUrl } from "./report";

describe("reportIssueUrl", () => {
  it("prefills the title, body and label of a new issue", () => {
    const url = new URL(
      reportIssueUrl("https://github.com/DIZAMU/GeoDex/", {
        snippetId: "NOR.f2",
        cardId: "NOR:map_to_name",
        locale: "nb",
        text: "Norge har en lang kyst & mange fjorder.",
        title: "Feil fakta: NOR.f2",
        body: "Fakta: Norge har en lang kyst & mange fjorder.",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://github.com/DIZAMU/GeoDex/issues/new");
    expect(url.searchParams.get("title")).toBe("Feil fakta: NOR.f2");
    expect(url.searchParams.get("body")).toBe("Fakta: Norge har en lang kyst & mange fjorder.");
    expect(url.searchParams.get("labels")).toBe("content");
  });
});
