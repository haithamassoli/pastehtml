import { describe, expect, it } from "vitest";
import {
  arrangePastes,
  displayName,
  isoDate,
  type ListedPaste,
} from "./paste-list";

function paste(over: Partial<ListedPaste> & { token: string }): ListedPaste {
  return {
    filename: "index.html",
    viewsCount: 0,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

const pastes = [
  paste({
    token: "aaa",
    title: "Zebra",
    createdAt: 3,
    updatedAt: 1,
    viewsCount: 5,
  }),
  paste({
    token: "bbb",
    filename: "menu.html",
    createdAt: 2,
    updatedAt: 9,
    viewsCount: 1,
    folderId: "f1",
  }),
  paste({
    token: "ccc",
    title: "  ",
    filename: "apple.html",
    createdAt: 1,
    updatedAt: 5,
    viewsCount: 9,
  }),
];

const tokens = (list: ListedPaste[]) => list.map((p) => p.token);

describe("displayName", () => {
  it("falls back to the filename when the title is missing or blank", () => {
    expect(displayName(pastes[0])).toBe("Zebra");
    expect(displayName(pastes[1])).toBe("menu.html");
    expect(displayName(pastes[2])).toBe("apple.html");
  });
});

describe("arrangePastes", () => {
  it("sorts newest first by default", () => {
    expect(tokens(arrangePastes(pastes))).toEqual(["aaa", "bbb", "ccc"]);
  });

  it("sorts by update time, views, and name", () => {
    expect(tokens(arrangePastes(pastes, { sort: "updated" }))).toEqual([
      "bbb",
      "ccc",
      "aaa",
    ]);
    expect(tokens(arrangePastes(pastes, { sort: "views" }))).toEqual([
      "ccc",
      "aaa",
      "bbb",
    ]);
    expect(tokens(arrangePastes(pastes, { sort: "name" }))).toEqual([
      "ccc",
      "bbb",
      "aaa",
    ]);
  });

  it("searches title, filename and token, case-insensitively", () => {
    expect(tokens(arrangePastes(pastes, { query: "zeb" }))).toEqual(["aaa"]);
    expect(tokens(arrangePastes(pastes, { query: "MENU" }))).toEqual(["bbb"]);
    expect(tokens(arrangePastes(pastes, { query: "ccc" }))).toEqual(["ccc"]);
    expect(tokens(arrangePastes(pastes, { query: "  " }))).toHaveLength(3);
    expect(arrangePastes(pastes, { query: "nothing" })).toEqual([]);
  });

  it("filters by folder, and by having no folder at all", () => {
    expect(tokens(arrangePastes(pastes, { folderId: "f1" }))).toEqual(["bbb"]);
    expect(tokens(arrangePastes(pastes, { folderId: null }))).toEqual([
      "aaa",
      "ccc",
    ]);
    expect(arrangePastes(pastes, { folderId: "missing" })).toEqual([]);
  });

  it("leaves the input untouched", () => {
    const before = tokens(pastes);
    arrangePastes(pastes, { sort: "name" });
    expect(tokens(pastes)).toEqual(before);
  });
});

describe("isoDate", () => {
  it("renders a date the server and the browser agree on", () => {
    expect(isoDate(Date.UTC(2026, 7, 30, 23, 59))).toBe("2026-08-30");
  });
});
