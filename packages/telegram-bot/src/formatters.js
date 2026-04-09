const GRADE_EMOJI = { 1: "😊 좋음", 2: "🙂 보통", 3: "😷 나쁨", 4: "🤢 매우나쁨" };
const CATEGORY_LABELS = {
  weather: "날씨",
  utility: "유틸리티",
  transit: "교통",
  finance: "금융",
  sports: "스포츠",
  shopping: "쇼핑",
  location: "위치 기반",
  reference: "자료검색",
  writing: "글쓰기",
  communication: "메신저",
  property: "부동산",
  logistics: "물류",
  document: "문서",
  configuration: "설정",
  environment: "환경",
  other: "기타",
};

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function gradeLabel(grade) {
  return GRADE_EMOJI[Number(grade)] || grade || "N/A";
}

export function categoryLabel(category) {
  return CATEGORY_LABELS[category] || category;
}

export function formatSkillList(groups) {
  const lines = ["<b>🐝 내가 할 수 있는 것들!</b>\n"];

  for (const [category, skills] of [...groups.entries()].sort()) {
    lines.push(`<b>[${categoryLabel(category)}]</b>`);
    for (const skill of skills) {
      lines.push(`  /skill_${skill.name.replaceAll("-", "_")} - ${escapeHtml(skill.description.slice(0, 60))}`);
    }
    lines.push("");
  }

  lines.push("궁금한 거 있으면 /skill_&lt;이름&gt; 으로 자세히 볼 수 있어!");
  return lines.join("\n");
}

export function formatSkillDetail(skill) {
  const lines = [
    `<b>🔧 ${escapeHtml(skill.name)}</b>`,
    `분류: ${categoryLabel(skill.category)}`,
    "",
    escapeHtml(skill.description),
  ];

  if (skill.longDescription) {
    lines.push("", escapeHtml(skill.longDescription));
  }

  if (skill.examples.length > 0) {
    lines.push("", "<b>이렇게 써봐:</b>");
    for (const ex of skill.examples) {
      lines.push(`  • ${escapeHtml(ex)}`);
    }
  }

  return lines.join("\n");
}

export function formatFineDust(data) {
  if (data.ambiguous) return data.message;

  return [
    `<b>🌫 미세먼지 - ${data.station}</b>`,
    `조회 시각: ${data.time}`,
    "",
    `PM10: ${data.pm10} ${gradeLabel(data.pm10Grade)}`,
    `PM2.5: ${data.pm25} ${gradeLabel(data.pm25Grade)}`,
    `통합대기: ${gradeLabel(data.khaiGrade)}`,
  ].join("\n");
}

export function formatWeather(data) {
  if (!data || !data.items) return "날씨 데이터를 못 가져왔어 🐝💦";

  const items = data.items;
  const byCategory = new Map();
  for (const item of items) {
    if (!byCategory.has(item.category)) {
      byCategory.set(item.category, item);
    }
  }

  const get = (cat) => byCategory.get(cat)?.fcstValue ?? "N/A";
  const skyMap = { 1: "맑음", 3: "구름많음", 4: "흐림" };
  const ptyMap = { 0: "없음", 1: "비", 2: "비/눈", 3: "눈", 4: "소나기" };

  return [
    `<b>🌤 날씨 예보</b>`,
    `기준: ${data.baseDate || ""} ${data.baseTime || ""}`,
    "",
    `기온: ${get("TMP")}°C`,
    `하늘: ${skyMap[get("SKY")] || get("SKY")}`,
    `강수형태: ${ptyMap[get("PTY")] || get("PTY")}`,
    `강수확률: ${get("POP")}%`,
    `강수량: ${get("PCP")}`,
    `습도: ${get("REH")}%`,
    `풍속: ${get("WSD")}m/s`,
  ].join("\n");
}

export function formatSubway(data) {
  if (!data?.realtimeArrivalList?.length) {
    return "지금은 도착 정보가 없어!";
  }

  const arrivals = data.realtimeArrivalList.slice(0, 8);
  const lines = [`<b>🚇 ${arrivals[0].statnNm || ""} 실시간 도착 정보</b>\n`];

  for (const a of arrivals) {
    const line = a.subwayId ? `${a.trainLineNm || a.subwayId}` : "";
    const msg = a.arvlMsg2 || a.arvlMsg3 || "";
    const dest = a.bstatnNm ? ` → ${a.bstatnNm}` : "";
    lines.push(`${line}${dest}: ${msg}`);
  }

  return lines.join("\n");
}

export function formatStockSearch(data) {
  if (!data?.results?.length) return "검색 결과가 없어 🐝";

  const lines = ["<b>📈 주식 검색 결과</b>\n"];
  for (const stock of data.results.slice(0, 10)) {
    lines.push(`${stock.isuNm || stock.isuAbbrv} (${stock.isuCd || ""}) - ${stock.mktNm || ""}`);
  }
  return lines.join("\n");
}

export function formatHanRiver(data) {
  if (!data?.items?.length) return "한강 수위 데이터를 못 가져왔어 🐝💦";

  const lines = ["<b>🌊 한강 수위 현황</b>\n"];
  for (const item of data.items) {
    lines.push(`${item.obsNm || item.wlobscd}: ${item.wl ?? "N/A"}m (${item.fw ?? "N/A"}m³/s)`);
  }
  return lines.join("\n");
}

export function formatGitHubIssues(issues) {
  if (!issues?.length) return "열린 이슈 없어! 깔끔 🍯";

  const lines = ["<b>📝 최근 이슈</b>\n"];
  for (const issue of issues) {
    const labels = issue.labels?.map((l) => l.name).join(", ") || "";
    lines.push(`#${issue.number} ${issue.title}${labels ? ` [${labels}]` : ""}`);
  }
  return lines.join("\n");
}

export function formatGitHubPRs(prs) {
  if (!prs?.length) return "열린 PR 없어! 깔끔 🍯";

  const lines = ["<b>🔀 최근 Pull Requests</b>\n"];
  for (const pr of prs) {
    const status = pr.draft ? "📝 Draft" : "🟢 Open";
    lines.push(`#${pr.number} ${status} ${pr.title}`);
  }
  return lines.join("\n");
}
