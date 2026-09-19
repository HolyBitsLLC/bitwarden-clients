import { Response } from "./response";

describe("Response.multipleResults", () => {
  it("keeps the historical message and payload when no match details are supplied", () => {
    const response = Response.multipleResults(["id-a", "id-b"]);

    expect(response.success).toBe(false);
    expect(response.data).toEqual(["id-a", "id-b"]);
    expect(response.matches).toBeUndefined();
    expect(response.message).toEqual(
      "More than one result was found. Try getting a specific object by `id` instead. " +
        "The following objects were found:\nid-a\nid-b",
    );
  });

  it("reports where each match lives when match details are supplied", () => {
    const matches = [
      { id: "id-a", name: "Shared name", organizationId: "org-1", collectionIds: ["col-1"] },
      { id: "id-b", name: "Shared name", organizationId: "org-2" },
    ];

    const response = Response.multipleResults(
      matches.map((m) => m.id),
      matches,
    );

    // The machine-readable id list is unchanged, and the detail is additive.
    expect(response.data).toEqual(["id-a", "id-b"]);
    expect(response.matches).toEqual(matches);
    expect(response.message).toContain(
      'id-a (name="Shared name", organizationId=org-1, collectionIds=[col-1])',
    );
    expect(response.message).toContain('id-b (name="Shared name", organizationId=org-2)');
  });

  it("still leads every detail line with the id", () => {
    const response = Response.multipleResults(
      ["id-a", "id-b"],
      [{ id: "id-a", name: "Shared name" }, { id: "id-b" }],
    );

    const detailLines = response.message.split("\n").slice(1);
    expect(detailLines.map((line) => line.split(" ")[0])).toEqual(["id-a", "id-b"]);
  });
});
