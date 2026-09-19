// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";

import { BaseResponse } from "./response/base.response";

/**
 * Optional context for one candidate of an ambiguous (`multipleResults`) lookup.
 *
 * A name lookup can legitimately match several objects (for example two items
 * with the same name in different organizations or collections). The id alone is
 * enough for a human to retry, but a caller that wants to narrow the search
 * instead of retrying by id also needs to know *where* each candidate lives.
 */
export interface MultipleResultsMatch {
  id: string;
  name?: string;
  organizationId?: string;
  collectionIds?: string[];
}

function getErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof ErrorResponse) {
    const message = error.getSingleMessage();
    if (message) {
      return message;
    }
  }
  if (error instanceof Error) {
    return String(error);
  }
  if (error) {
    const errorWithMessage: { message?: unknown } = error; // To placate TypeScript.
    if (errorWithMessage.message && typeof errorWithMessage.message === "string") {
      return errorWithMessage.message;
    }
  }
  return JSON.stringify(error);
}

export class Response {
  static error(error: any, data?: any): Response {
    const res = new Response();
    res.success = false;
    res.message = getErrorMessage(error);
    res.data = data;
    return res;
  }

  static notFound(): Response {
    return Response.error("Not found.");
  }

  static noEditPermission(): Response {
    return Response.error("You do not have permission to edit this item");
  }

  static badRequest(message: string): Response {
    return Response.error(message);
  }

  /**
   * Reports an ambiguous lookup: a name (or other non-unique selector) matched
   * more than one object.
   *
   * The response stays a client error — guessing which of the matches the caller
   * meant would silently return the wrong object. `data` keeps the historical
   * shape (the array of matching ids). When `matches` is supplied, each entry is
   * appended to the message and returned in a new `matches` field so a caller can
   * disambiguate without a second round-trip. Every detailed line still starts
   * with the id, so the historical line-oriented message shape is preserved.
   */
  static multipleResults(ids: string[], matches?: MultipleResultsMatch[]): Response {
    let msg =
      "More than one result was found. Try getting a specific object by `id` instead. " +
      "The following objects were found:";
    const details = matches ?? ids.map((id) => ({ id }));
    details.forEach((match) => {
      msg += "\n" + describeMatch(match);
    });
    const res = Response.error(msg, ids);
    if (matches != null && matches.length > 0) {
      res.matches = matches;
    }
    return res;
  }

  static success(data?: BaseResponse): Response {
    const res = new Response();
    res.success = true;
    res.data = data;
    return res;
  }

  success: boolean;
  message: string;
  errorCode: number;
  data: BaseResponse;
  matches?: MultipleResultsMatch[];
}

function describeMatch(match: MultipleResultsMatch): string {
  const details: string[] = [];
  if (match.name != null) {
    details.push(`name="${match.name}"`);
  }
  if (match.organizationId != null) {
    details.push(`organizationId=${match.organizationId}`);
  }
  if (match.collectionIds != null && match.collectionIds.length > 0) {
    details.push(`collectionIds=[${match.collectionIds.join(", ")}]`);
  }
  return details.length === 0 ? match.id : `${match.id} (${details.join(", ")})`;
}
