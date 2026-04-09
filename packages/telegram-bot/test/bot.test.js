import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadSkills, searchSkills, groupByCategory } from "../src/skills.js";
import * as fmt from "../src/formatters.js";

describe("skills", () => {
  let skills;

  it("loads skills from repo root", async () => {
    skills = await loadSkills();
    assert.ok(skills.size > 0, "should load at least one skill");
    assert.ok(skills.has("korea-weather"), "should include korea-weather");
    assert.ok(skills.has("fine-dust-location"), "should include fine-dust-location");
  });

  it("each skill has required fields", async () => {
    if (!skills) skills = await loadSkills();

    for (const [name, skill] of skills) {
      assert.ok(skill.name, `${name} should have name`);
      assert.ok(skill.description, `${name} should have description`);
      assert.ok(skill.category, `${name} should have category`);
    }
  });

  it("searchSkills finds by keyword", async () => {
    if (!skills) skills = await loadSkills();

    const weatherResults = searchSkills(skills, "날씨");
    assert.ok(weatherResults.length > 0, "should find weather skill");

    const subwayResults = searchSkills(skills, "지하철");
    assert.ok(subwayResults.length > 0, "should find subway skill");
  });

  it("searchSkills returns empty for nonsense", async () => {
    if (!skills) skills = await loadSkills();

    const results = searchSkills(skills, "xyzzy_no_match_12345");
    assert.equal(results.length, 0);
  });

  it("groupByCategory groups correctly", async () => {
    if (!skills) skills = await loadSkills();

    const groups = groupByCategory(skills);
    assert.ok(groups.size > 0, "should have at least one category");

    for (const [cat, list] of groups) {
      assert.ok(list.length > 0, `${cat} should have skills`);
      for (const skill of list) {
        assert.equal(skill.category, cat);
      }
    }
  });
});

describe("formatters", () => {
  it("gradeLabel maps known grades", () => {
    assert.match(fmt.gradeLabel(1), /좋음/);
    assert.match(fmt.gradeLabel(3), /나쁨/);
    assert.equal(fmt.gradeLabel(null), "N/A");
  });

  it("formatFineDust handles ambiguous response", () => {
    const result = fmt.formatFineDust({
      ambiguous: true,
      message: "후보 측정소가 있습니다.",
    });
    assert.match(result, /후보/);
  });

  it("formatFineDust handles normal response", () => {
    const result = fmt.formatFineDust({
      ambiguous: false,
      station: "강남구",
      time: "2026-04-09 12:00",
      pm10: "45",
      pm10Grade: "2",
      pm25: "22",
      pm25Grade: "2",
      khaiGrade: "2",
    });
    assert.match(result, /강남구/);
    assert.match(result, /PM10/);
    assert.match(result, /45/);
  });

  it("formatSubway handles empty data", () => {
    assert.match(fmt.formatSubway(null), /없습니다/);
    assert.match(fmt.formatSubway({ realtimeArrivalList: [] }), /없습니다/);
  });

  it("formatStockSearch handles empty results", () => {
    assert.match(fmt.formatStockSearch({ results: [] }), /없습니다/);
    assert.match(fmt.formatStockSearch(null), /없습니다/);
  });

  it("formatGitHubIssues handles data", () => {
    const result = fmt.formatGitHubIssues([
      { number: 1, title: "Test issue", labels: [{ name: "bug" }] },
    ]);
    assert.match(result, /#1/);
    assert.match(result, /Test issue/);
    assert.match(result, /bug/);
  });

  it("formatGitHubPRs handles data", () => {
    const result = fmt.formatGitHubPRs([
      { number: 10, title: "Add feature", draft: false },
    ]);
    assert.match(result, /#10/);
    assert.match(result, /Add feature/);
  });

  it("formatSkillList generates valid output", async () => {
    const skills = await loadSkills();
    const groups = groupByCategory(skills);
    const result = fmt.formatSkillList(groups);
    assert.match(result, /스킬 목록/);
    assert.ok(result.length > 100, "should have substantial content");
  });

  it("formatSkillDetail includes examples", async () => {
    const skills = await loadSkills();
    const weather = skills.get("korea-weather");
    assert.ok(weather, "korea-weather should exist");

    const result = fmt.formatSkillDetail(weather);
    assert.match(result, /korea-weather/);
    assert.match(result, /사용 예시/);
  });
});
