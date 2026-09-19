import { firstValueFrom } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { UserId } from "@bitwarden/common/types/guid";

import { MultipleResultsMatch, Response } from "../../models/response";

/**
 * Resolves an organization or collection *name* to the local id the rest of the
 * CLI filters by.
 *
 * The vault is already synced when a command runs, so organization and collection
 * names can be resolved locally — no extra API call is needed. Names are only
 * accepted when they resolve to exactly one object: an unknown name must not
 * widen a filter, and an ambiguous name must not silently pick one of the matches.
 * Resolution failures are returned as a `Response` so callers can hand them
 * straight back to the user.
 */
export class CliNameFilterService {
  constructor(
    private organizationService: OrganizationService,
    private collectionService: CollectionService,
  ) {}

  /**
   * @returns the matching organization, or a `Response` describing why the name
   * could not be resolved unambiguously.
   */
  async resolveOrganization(userId: UserId, name: string): Promise<Organization | Response> {
    const organizations = await firstValueFrom(
      this.organizationService.memberOrganizations$(userId),
    );
    const normalized = normalizeName(name);
    const matches = organizations.filter((o) => normalizeName(o.name) === normalized);
    return this.singleMatch(matches, `No organization found with name "${name}".`, (o) => ({
      id: o.id,
      name: o.name,
    }));
  }

  /**
   * When `organizationId` is supplied the lookup is scoped to that organization,
   * so the same collection name in two organizations is not ambiguous.
   *
   * @returns the matching collection, or a `Response` describing why the name
   * could not be resolved unambiguously.
   */
  async resolveCollection(
    userId: UserId,
    name: string,
    organizationId?: string,
  ): Promise<CollectionView | Response> {
    let collections = await firstValueFrom(this.collectionService.decryptedCollections$(userId));
    if (organizationId != null) {
      collections = collections.filter((c) => c.organizationId === organizationId);
    }
    const normalized = normalizeName(name);
    const matches = collections.filter((c) => normalizeName(c.name) === normalized);
    return this.singleMatch(matches, `No collection found with name "${name}".`, (c) => ({
      id: c.id,
      name: c.name,
      organizationId: c.organizationId,
    }));
  }

  private singleMatch<T extends { id: string }>(
    matches: T[],
    notFoundMessage: string,
    describe: (match: T) => MultipleResultsMatch,
  ): T | Response {
    if (matches.length === 0) {
      return Response.badRequest(notFoundMessage);
    }
    if (matches.length > 1) {
      return Response.multipleResults(
        matches.map((m) => m.id),
        matches.map(describe),
      );
    }
    return matches[0];
  }
}

function normalizeName(name: string): string {
  return (name ?? "").trim().toLowerCase();
}
