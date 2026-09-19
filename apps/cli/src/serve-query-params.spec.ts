import {
  findUnsupportedQueryParams,
  GET_QUERY_PARAMS,
  LIST_QUERY_PARAMS,
  SEND_GET_QUERY_PARAMS,
  SEND_LIST_QUERY_PARAMS,
  unsupportedQueryParamsResponse,
} from "./serve-query-params";

describe("findUnsupportedQueryParams", () => {
  it("returns nothing for a request that only uses supported parameters", () => {
    expect(
      findUnsupportedQueryParams(
        { organizationid: "org-1", search: "google", pretty: "1" },
        LIST_QUERY_PARAMS,
      ),
    ).toEqual([]);
  });

  it("reports a parameter the endpoint does not understand", () => {
    // `orgId` is not one of the accepted spellings — before this guard it was
    // dropped silently and the request returned the whole vault.
    expect(findUnsupportedQueryParams({ orgId: "org-1" }, LIST_QUERY_PARAMS)).toEqual(["orgId"]);
  });

  it("reports every unsupported parameter, not just the first", () => {
    expect(
      findUnsupportedQueryParams({ orgId: "org-1", folderName: "x" }, LIST_QUERY_PARAMS),
    ).toEqual(["orgId", "folderName"]);
  });

  it("accepts both documented spellings of each filter on every read endpoint", () => {
    const spellings = [
      "organizationid",
      "organizationId",
      "organizationname",
      "organizationName",
      "collectionid",
      "collectionId",
      "collectionname",
      "collectionName",
    ];

    for (const supported of [LIST_QUERY_PARAMS, GET_QUERY_PARAMS]) {
      for (const spelling of spellings) {
        expect(findUnsupportedQueryParams({ [spelling]: "value" }, supported)).toEqual([]);
      }
    }
  });

  it("does not let the list endpoint's filters leak onto the send endpoints", () => {
    expect(findUnsupportedQueryParams({ folderid: "folder-1" }, SEND_LIST_QUERY_PARAMS)).toEqual([
      "folderid",
    ]);
    expect(findUnsupportedQueryParams({ folderid: "folder-1" }, SEND_GET_QUERY_PARAMS)).toEqual([
      "folderid",
    ]);
  });

  it("handles an absent query object", () => {
    expect(findUnsupportedQueryParams(undefined, LIST_QUERY_PARAMS)).toEqual([]);
  });
});

describe("unsupportedQueryParamsResponse", () => {
  it("names the rejected parameters and the ones that are accepted", () => {
    const response = unsupportedQueryParamsResponse(["orgId"], ["search", "pretty"]);

    expect(response.success).toBe(false);
    expect(response.message).toEqual(
      "Unsupported query parameter(s): orgId. Supported parameters are: search, pretty.",
    );
  });
});
