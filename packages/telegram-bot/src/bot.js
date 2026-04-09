import { Telegraf } from "telegraf";
import { loadSkills, searchSkills, groupByCategory } from "./skills.js";
import * as proxy from "./proxy-client.js";
import * as github from "./github-client.js";
import * as fmt from "./formatters.js";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN 환경변수를 설정해 주세요.");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// --- Load skills on startup ---
let skills;
let skillsByCmd;

async function initSkills() {
  skills = await loadSkills();
  skillsByCmd = new Map();
  for (const [name, skill] of skills) {
    const cmd = name.replaceAll("-", "_");
    skillsByCmd.set(cmd, skill);
  }
  console.log(`${skills.size}개 스킬 로드 완료`);
}

// --- Helpers ---

function reply(ctx, text) {
  return ctx.reply(text, { parse_mode: "HTML", disable_web_page_preview: true });
}

function safeHandler(fn) {
  return async (ctx) => {
    try {
      await fn(ctx);
    } catch (error) {
      console.error("Handler error:", error);
      await ctx.reply(`오류가 발생했습니다: ${error.message}`).catch(() => {});
    }
  };
}

// --- Commands ---

bot.start(
  safeHandler(async (ctx) => {
    await reply(
      ctx,
      [
        "<b>👋 안녕하세요! k-skill 비서 봇입니다.</b>",
        "",
        "한국 생활에 유용한 다양한 정보를 제공합니다.",
        "",
        "<b>📌 주요 명령어</b>",
        "/skills - 전체 스킬 목록",
        "/search &lt;키워드&gt; - 스킬 검색",
        "/dust &lt;지역&gt; - 미세먼지 조회",
        "/weather &lt;위도&gt; &lt;경도&gt; - 날씨 예보",
        "/subway &lt;역명&gt; - 지하철 도착 정보",
        "/stock &lt;종목명&gt; - 주식 검색",
        "/hanriver - 한강 수위",
        "/issues - GitHub 이슈",
        "/prs - GitHub PR",
        "",
        "또는 자연어로 물어보세요!",
        '예: "강남역 미세먼지 어때?" "삼성전자 주가"',
      ].join("\n"),
    );
  }),
);

bot.command(
  "skills",
  safeHandler(async (ctx) => {
    const groups = groupByCategory(skills);
    await reply(ctx, fmt.formatSkillList(groups));
  }),
);

bot.command(
  "search",
  safeHandler(async (ctx) => {
    const query = ctx.message.text.replace(/^\/search\s*/, "").trim();
    if (!query) {
      return reply(ctx, "사용법: /search <키워드>\n예: /search 날씨");
    }

    const results = searchSkills(skills, query);
    if (results.length === 0) {
      return reply(ctx, `"${query}" 관련 스킬을 찾을 수 없습니다.`);
    }

    const lines = [`<b>🔍 "${query}" 검색 결과 (${results.length}건)</b>\n`];
    for (const s of results) {
      lines.push(`<b>${s.name}</b> [${fmt.categoryLabel(s.category)}]`);
      lines.push(`  ${s.description.slice(0, 80)}\n`);
    }
    await reply(ctx, lines.join("\n"));
  }),
);

// --- Proxy-backed commands ---

bot.command(
  "dust",
  safeHandler(async (ctx) => {
    const region = ctx.message.text.replace(/^\/dust\s*/, "").trim();
    if (!region) {
      return reply(ctx, "사용법: /dust <지역명>\n예: /dust 강남구");
    }

    await ctx.sendChatAction("typing");
    const data = await proxy.getFineDust(region);
    await reply(ctx, fmt.formatFineDust(data));
  }),
);

bot.command(
  "weather",
  safeHandler(async (ctx) => {
    const args = ctx.message.text.replace(/^\/weather\s*/, "").trim().split(/\s+/);
    if (args.length < 2) {
      return reply(ctx, "사용법: /weather <위도> <경도>\n예: /weather 37.5665 126.9780");
    }

    await ctx.sendChatAction("typing");
    const data = await proxy.getWeather({ lat: args[0], lon: args[1] });
    await reply(ctx, fmt.formatWeather(data));
  }),
);

bot.command(
  "subway",
  safeHandler(async (ctx) => {
    const station = ctx.message.text.replace(/^\/subway\s*/, "").trim();
    if (!station) {
      return reply(ctx, "사용법: /subway <역명>\n예: /subway 강남");
    }

    await ctx.sendChatAction("typing");
    const data = await proxy.getSubwayArrival(station);
    await reply(ctx, fmt.formatSubway(data));
  }),
);

bot.command(
  "stock",
  safeHandler(async (ctx) => {
    const query = ctx.message.text.replace(/^\/stock\s*/, "").trim();
    if (!query) {
      return reply(ctx, "사용법: /stock <종목명>\n예: /stock 삼성전자");
    }

    await ctx.sendChatAction("typing");
    const data = await proxy.searchStocks(query);
    await reply(ctx, fmt.formatStockSearch(data));
  }),
);

bot.command(
  "hanriver",
  safeHandler(async (ctx) => {
    await ctx.sendChatAction("typing");
    const data = await proxy.getHanRiverWaterLevel();
    await reply(ctx, fmt.formatHanRiver(data));
  }),
);

// --- GitHub commands ---

bot.command(
  "issues",
  safeHandler(async (ctx) => {
    await ctx.sendChatAction("typing");
    const issues = await github.getIssues();
    await reply(ctx, fmt.formatGitHubIssues(issues));
  }),
);

bot.command(
  "prs",
  safeHandler(async (ctx) => {
    await ctx.sendChatAction("typing");
    const prs = await github.getPullRequests();
    await reply(ctx, fmt.formatGitHubPRs(prs));
  }),
);

// --- Dynamic skill detail commands (skill_xxx) ---

bot.use(
  safeHandler(async (ctx, next) => {
    const text = ctx.message?.text || "";
    const match = text.match(/^\/skill_(\S+)/);
    if (!match) return next();

    const cmd = match[1];
    const skill = skillsByCmd.get(cmd);
    if (!skill) {
      return reply(ctx, `"${cmd}" 스킬을 찾을 수 없습니다.\n/skills 로 목록을 확인하세요.`);
    }
    await reply(ctx, fmt.formatSkillDetail(skill));
  }),
);

// --- Natural language routing ---

const NL_PATTERNS = [
  { pattern: /미세먼지|공기질|대기/, handler: nlFineDust },
  { pattern: /날씨|기온|기상/, handler: nlWeather },
  { pattern: /지하철|도착|몇\s*분/, handler: nlSubway },
  { pattern: /주식|주가|종목|코스피|코스닥/, handler: nlStock },
  { pattern: /한강|수위/, handler: nlHanRiver },
  { pattern: /이슈|버그|issue/, handler: nlIssues },
];

async function nlFineDust(ctx, text) {
  const region = text
    .replace(/미세먼지|공기질|대기|어때|알려줘|좀|지금|현재|수치|확인/g, "")
    .trim();
  if (!region) {
    return reply(ctx, '지역을 알려주세요.\n예: "강남구 미세먼지"');
  }
  await ctx.sendChatAction("typing");
  const data = await proxy.getFineDust(region);
  await reply(ctx, fmt.formatFineDust(data));
}

async function nlWeather(ctx, text) {
  return reply(
    ctx,
    "날씨 조회는 좌표가 필요합니다.\n/weather <위도> <경도>\n예: /weather 37.5665 126.9780",
  );
}

async function nlSubway(ctx, text) {
  const station = text
    .replace(/지하철|도착|몇\s*분|뒤에?|오나|와|역|실시간|정보|알려줘|보여줘/g, "")
    .trim();
  if (!station) {
    return reply(ctx, '역명을 알려주세요.\n예: "강남역 도착 정보"');
  }
  await ctx.sendChatAction("typing");
  const data = await proxy.getSubwayArrival(station);
  await reply(ctx, fmt.formatSubway(data));
}

async function nlStock(ctx, text) {
  const query = text
    .replace(/주식|주가|종목|코스피|코스닥|검색|찾아줘|알려줘|얼마/g, "")
    .trim();
  if (!query) {
    return reply(ctx, '종목명을 알려주세요.\n예: "삼성전자 주가"');
  }
  await ctx.sendChatAction("typing");
  const data = await proxy.searchStocks(query);
  await reply(ctx, fmt.formatStockSearch(data));
}

async function nlHanRiver(ctx) {
  await ctx.sendChatAction("typing");
  const data = await proxy.getHanRiverWaterLevel();
  await reply(ctx, fmt.formatHanRiver(data));
}

async function nlIssues(ctx) {
  await ctx.sendChatAction("typing");
  const issues = await github.getIssues();
  await reply(ctx, fmt.formatGitHubIssues(issues));
}

bot.on("text",
  safeHandler(async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith("/")) return; // unknown command, ignore

    for (const { pattern, handler } of NL_PATTERNS) {
      if (pattern.test(text)) {
        return handler(ctx, text);
      }
    }

    // No match — suggest help
    await reply(
      ctx,
      [
        '무엇을 도와드릴까요? 아래 예시를 참고하세요.',
        '',
        '• "강남구 미세먼지" - 미세먼지 조회',
        '• "삼성전자 주가" - 주식 검색',
        '• "강남역 지하철" - 도착 정보',
        '• /skills - 전체 스킬 목록',
        '• /help - 도움말',
      ].join("\n"),
    );
  }),
);

bot.command("help", safeHandler(async (ctx) => {
  // Same as start
  await bot.handleUpdate({
    ...ctx.update,
    message: { ...ctx.message, text: "/start" },
  });
}));

// --- Startup ---

async function main() {
  await initSkills();

  bot.launch();
  console.log("🤖 k-skill 텔레그램 봇 시작됨");

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

main().catch((error) => {
  console.error("Bot startup error:", error);
  process.exit(1);
});

export { bot, initSkills };
