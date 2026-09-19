import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { CollectionService, OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EventCollectionService } from "@bitwarden/common/dirt/event-logs";
import { CipherId, CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { KeyService } from "@bitwarden/key-management";

import { CipherResponse } from "../vault/models/cipher.response";
import { CliRestrictedItemTypesService } from "../vault/services/cli-restricted-item-types.service";

import { ListCommand } from "./list.command";

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

function cipherFixture(
  id: string,
  name: string,
  collectionIds: string[] = [],
  organizationId?: OrganizationId,
): CipherView {
  return mock<CipherView>({
    id: id as CipherId,
    name,
    collectionIds: collectionIds as CollectionId[],
    organizationId,
    isDeleted: false,
    isArchived: false,
    fields: [],
    passwordHistory: [],
    attachments: [],
  }) as unknown as CipherView;
}

function buildCommand(options: {
  organizations?: Organization[];
  collections?: CollectionView[];
  ciphers?: CipherView[];
}) {
  const cipherService = mock<CipherService>();
  cipherService.getAllDecrypted.mockResolvedValue(options.ciphers ?? []);

  const collectionService = mock<CollectionService>();
  collectionService.decryptedCollections$.mockReturnValue(of(options.collections ?? []));

  const organizationService = mock<OrganizationService>();
  organizationService.memberOrganizations$.mockReturnValue(of(options.organizations ?? []));

  const accountService = mock<AccountService>();
  accountService.activeAccount$ = of({ id: userId } as Account);

  const eventCollectionService = mock<EventCollectionService>();
  eventCollectionService.collectMany.mockResolvedValue(undefined);

  const cliRestrictedItemTypesService = mock<CliRestrictedItemTypesService>();
  cliRestrictedItemTypesService.filterRestrictedCiphers.mockImplementation(async (c) => c);

  const cipherArchiveService = mock<CipherArchiveService>();
  cipherArchiveService.userCanArchive$.mockReturnValue(of(false));

  return new ListCommand(
    cipherService,
    mock<FolderService>(),
    collectionService,
    organizationService,
    mock<SearchService>(),
    mock<OrganizationUserApiService>(),
    mock<ApiService>(),
    eventCollectionService,
    accountService,
    mock<KeyService>(),
    cliRestrictedItemTypesService,
    cipherArchiveService,
  );
}

function itemIds(response: { data: unknown }): string[] {
  return (response.data as { data: CipherResponse[] }).data.map((item) => item.id);
}

describe("ListCommand name filters", () => {
  it("filters items by collection name", async () => {
    const command = buildCommand({
      collections: [collectionFixture("col-1", "Servers", engineering)],
      ciphers: [
        cipherFixture("cipher-1", "in collection", ["col-1"]),
        cipherFixture("cipher-2", "not in collection", ["col-2"]),
      ],
    });

    const response = await command.run("items", { collectionname: "Servers" });

    expect(response.success).toBe(true);
    expect(itemIds(response)).toEqual(["cipher-1"]);
  });

  it("scopes a collection name to the selected organization", async () => {
    const command = buildCommand({
      organizations: [organizationFixture(engineering, "Engineering")],
      collections: [collectionFixture("col-eng", "Servers", engineering)],
      ciphers: [
        cipherFixture("cipher-1", "in collection", ["col-eng"], engineering),
        cipherFixture("cipher-2", "elsewhere", ["col-other"], marketing),
      ],
    });

    const response = await command.run("items", {
      organizationname: "Engineering",
      collectionname: "Servers",
    });

    expect(response.success).toBe(true);
    expect(itemIds(response)).toEqual(["cipher-1"]);
  });

  it("fails, rather than returning everything, when the name matches nothing", async () => {
    const command = buildCommand({
      collections: [collectionFixture("col-1", "Servers", engineering)],
      ciphers: [cipherFixture("cipher-1", "in collection", ["col-1"])],
    });

    const response = await command.run("items", { collectionname: "Serverz" });

    expect(response.success).toBe(false);
    expect(response.message).toEqual('No collection found with name "Serverz".');
  });

  it("fails when the name is ambiguous", async () => {
    const command = buildCommand({
      collections: [
        collectionFixture("col-1", "Servers", engineering),
        collectionFixture("col-2", "Servers", marketing),
      ],
    });

    const response = await command.run("items", { collectionname: "Servers" });

    expect(response.success).toBe(false);
    expect(response.data).toEqual(["col-1", "col-2"]);
  });

  it("still filters by the legacy organization id", async () => {
    const command = buildCommand({
      ciphers: [
        cipherFixture("cipher-1", "in org", [], engineering),
        cipherFixture("cipher-2", "personal"),
      ],
    });

    const response = await command.run("items", { organizationid: engineering });

    expect(response.success).toBe(true);
    expect(itemIds(response)).toEqual(["cipher-1"]);
  });
});
