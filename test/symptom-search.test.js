import { describe, expect, it } from "vitest";
import { extractSearchKeywords } from "../server/symptom-search.js";

describe("extractSearchKeywords", () => {
  it("splits free text into lowercase words, dropping stopwords", () => {
    expect(extractSearchKeywords("Grinding noise when braking")).toEqual(
      expect.arrayContaining(["grinding", "noise", "braking"]),
    );
  });

  it("filters out stopwords", () => {
    const result = extractSearchKeywords("the car has a noise when braking");
    expect(result).not.toContain("the");
    expect(result).not.toContain("has");
    expect(result).not.toContain("when");
  });

  it("filters out words under 3 characters", () => {
    const result = extractSearchKeywords("it is a go car");
    expect(result).not.toContain("it");
    expect(result).not.toContain("is");
    expect(result).not.toContain("a");
  });

  it("de-duplicates repeated words", () => {
    expect(extractSearchKeywords("noise noise noise")).toEqual(["noise"]);
  });

  it("handles Spanish input including accented characters", () => {
    const result = extractSearchKeywords("rechinido cuando freno a baja velocidad");
    expect(result).toContain("rechinido");
    expect(result).toContain("freno");
    expect(result).toContain("baja");
    expect(result).toContain("velocidad");
    expect(result).not.toContain("cuando");
  });

  it("handles empty and undefined input without throwing", () => {
    expect(extractSearchKeywords("")).toEqual([]);
    expect(extractSearchKeywords(undefined)).toEqual([]);
  });
});
