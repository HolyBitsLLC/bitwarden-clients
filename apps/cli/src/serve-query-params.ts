import { Response } from "./models/response";

/**
 * Query parameters that are understood by every `bw serve` route.
 *
 * `pretty` is consumed by the JSON middleware, not by a command.
 */
export const COMMON_QUERY_PARAMS = ["pretty"] as const;

/**
 * `GET /list/object/:object` and `GET /send/list`.
 *
 * Mirrors the option surface of `bw list` (`ListCommand.Options`) — note that
 * the CLI registers these as command-level options, so the same names are
 * accepted for every listable object, in both the `organizationid` and
 * `organizationId` spellings.
 */
export const LIST_QUERY_PARAMS = [
  ...COMMON_QUERY_PARAMS,
  "organizationid",
  "organizationId",
  "organizationname",
  "organizationName",
  "collectionid",
  "collectionId",
  "collectionname",
  "collectionName",
  "folderid",
  "folderId",
  "search",
  "url",
  "trash",
  "archived",
] as const;

/** `bw send list` only supports `search` (`SendListCommand.Options`). */
export const SEND_LIST_QUERY_PARAMS = [...COMMON_QUERY_PARAMS, "search"] as const;

/** `GET /object/:object/:id` (`GetCommand.Options`). */
export const GET_QUERY_PARAMS = [
  ...COMMON_QUERY_PARAMS,
  "organizationid",
  "organizationId",
  "organizationname",
  "organizationName",
  "collectionid",
  "collectionId",
  "collectionname",
  "collectionName",
  "itemid",
  "itemId",
  "output",
] as const;

/** `GET /object/send/:id` (`SendGetCommand`). */
export const SEND_GET_QUERY_PARAMS = [...COMMON_QUERY_PARAMS, "text"] as const;

/**
 * Returns the query parameters that the route does not understand.
 *
 * Unknown query parameters used to be dropped silently, so a misspelled or
 * unsupported filter (for example `organizationName=` before it was supported,
 * or `orgId=`) returned every object in the vault with HTTP 200. For a caller
 * that reads a single value out of the response that is indistinguishable from a
 * correct answer, so the request must fail instead of quietly widening.
 */
export function findUnsupportedQueryParams(
  query: Record<string, unknown>,
  supported: readonly string[],
): string[] {
  const supportedNames = new Set(supported);
  return Object.keys(query ?? {}).filter((name) => !supportedNames.has(name));
}

/**
 * Builds the `400` response for a request carrying unsupported query parameters.
 */
export function unsupportedQueryParamsResponse(
  unsupported: string[],
  supported: readonly string[],
): Response {
  return Response.badRequest(
    `Unsupported query parameter(s): ${unsupported.join(", ")}. ` +
      `Supported parameters are: ${supported.join(", ")}.`,
  );
}
