import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";

import { Response } from "../../models/response";

import { CliNameFilterService } from "./name-filter.service";

const userId = "user-1" as UserId;
const engineering = "org-engineering" as OrganizationId;
const marketing = "org-marketing" as OrganizationId;

function organizationFixture(id: OrganizationId, name: string): Organization {
  return mock<Organization>({ id, name }) as unknown as Organization;
}

function collectionFixture(
  id: string,
  name: string,
  organizationId: OrganizationId,
): CollectionView {
  return mock<CollectionView>({
    id: id as CollectionId,
    name,
    organizationId,
  }) as unknown as CollectionView;
}

function buildService(organizations: Organization[], collections: CollectionView[]) {
  const organizationService = mock<OrganizationService>();
  organizationService.memberOrganizations$.mockReturnValue(of(organizations));
  const collectionService = mock<CollectionService>();
  collectionService.decryptedCollections$.mockReturnValue(of(collections));

  return new CliNameFilterService(organizationService, collectionService);
}

describe("CliNameFilterService", () => {
  describe("resolveOrganization", () => {
    it("resolves a name to its organization", async () => {
      const service = buildService([organizationFixture(engineering, "Engineering")], []);

      const result = await service.resolveOrganization(userId, "Engineering");

      expect(result).not.toBeInstanceOf(Response);
      expect((result as Organization).id).toEqual(engineering);
      expect((result as Organization).name).toEqual("Engineering");
    });

    it("matches case-insensitively and ignores surrounding whitespace", async () => {
      const service = buildService([organizationFixture(engineering, "Engineering")], []);

      const result = await service.resolveOrganization(userId, "  engineering ");

      expect((result as Organization).id).toEqual(engineering);
    });

    it("fails when no organization has that name", async () => {
      const service = buildService([organizationFixture(engineering, "Engineering")], []);

      const result = await service.resolveOrganization(userId, "Engineeringg");

      expect(result).toBeInstanceOf(Response);
      expect((result as Response).success).toBe(false);
      expect((result as Response).message).toEqual(
        'No organization found with name "Engineeringg".',
      );
    });

    it("fails instead of guessing when the name is ambiguous", async () => {
      const service = buildService(
        [
          organizationFixture(engineering, "Shared name"),
          organizationFixture(marketing, "Shared name"),
        ],
        [],
      );

      const result = await service.resolveOrganization(userId, "Shared name");

      expect(result).toBeInstanceOf(Response);
      expect((result as Response).data).toEqual([engineering, marketing]);
      expect((result as Response).matches).toEqual([
        { id: engineering, name: "Shared name" },
        { id: marketing, name: "Shared name" },
      ]);
    });
  });

  describe("resolveCollection", () => {
    it("resolves a collection name", async () => {
      const service = buildService([], [collectionFixture("col-1", "Servers", engineering)]);

      const result = await service.resolveCollection(userId, "Servers");

      expect((result as CollectionView).id).toEqual("col-1");
    });

    it("scopes the lookup to a selected organization", async () => {
      const service = buildService(
        [],
        [
          collectionFixture("col-engineering", "Servers", engineering),
          collectionFixture("col-marketing", "Servers", marketing),
        ],
      );

      const result = await service.resolveCollection(userId, "Servers", marketing);

      expect((result as CollectionView).id).toEqual("col-marketing");
    });

    it("is ambiguous without an organization when the name exists in two", async () => {
      const service = buildService(
        [],
        [
          collectionFixture("col-engineering", "Servers", engineering),
          collectionFixture("col-marketing", "Servers", marketing),
        ],
      );

      const result = await service.resolveCollection(userId, "Servers");

      expect(result).toBeInstanceOf(Response);
      expect((result as Response).data).toEqual(["col-engineering", "col-marketing"]);
      expect((result as Response).matches).toEqual([
        { id: "col-engineering", name: "Servers", organizationId: engineering },
        { id: "col-marketing", name: "Servers", organizationId: marketing },
      ]);
    });

    it("fails when the scoped organization has no collection with that name", async () => {
      const service = buildService(
        [],
        [collectionFixture("col-engineering", "Servers", engineering)],
      );

      const result = await service.resolveCollection(userId, "Servers", marketing);

      expect(result).toBeInstanceOf(Response);
      expect((result as Response).message).toEqual('No collection found with name "Servers".');
    });
  });
});
