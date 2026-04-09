import { createServer } from "node:http";
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
  return async (ctx, next) => {
    try {
      await fn(ctx, next);
    } catch (error) {
      console.error("Handler error:", error);
      await ctx.reply(`앗, 뭔가 잘못됐어 🐝💦 ${error.message}`).catch(() => {});
    }
  };
}

// --- Commands ---

bot.start(
  safeHandler(async (ctx) => {
    await reply(
      ctx,
      [
        "<b>🐝 안녕! 나는 비(Bee)야~</b>",
        "",
        "날씨, 미세먼지, 지하철, 주식 같은 한국 생활 정보를 윙윙 찾아다 줄게!",
        "",
        "<b>📌 이런 거 물어봐</b>",
        "/skills - 내가 할 수 있는 것들",
        "/search &lt;키워드&gt; - 스킬 검색",
        "/dust &lt;지역&gt; - 미세먼지 조회",
        "/weather &lt;위도&gt; &lt;경도&gt; - 날씨 예보",
        "/subway &lt;역명&gt; - 지하철 도착 정보",
        "/stock &lt;종목명&gt; - 주식 검색",
        "/hanriver - 한강 수위",
        "/issues - GitHub 이슈",
        "/prs - GitHub PR",
        "",
        '그냥 편하게 말해도 돼! 🍯',
        '"강남구 미세먼지 어때?" "삼성전자 주가" 이런 식으로~',
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
      return reply(ctx, "뭘 찾아줄까? 키워드를 같이 보내줘!\n예: /search 날씨");
    }

    const results = searchSkills(skills, query);
    if (results.length === 0) {
      return reply(ctx, `음.. "${query}" 관련된 건 아직 없어 🐝`);
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
      return reply(ctx, "어디 미세먼지 볼까? 지역명 같이 보내줘!\n예: /dust 강남구");
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
      return reply(ctx, "좌표를 알려줘! 위도 경도 순서로 ~\n예: /weather 37.5665 126.9780");
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
      return reply(ctx, "어느 역? 역이름 같이 보내줘!\n예: /subway 강남");
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
      return reply(ctx, "어떤 종목 볼까? 이름 같이 보내줘!\n예: /stock 삼성전자");
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
      return reply(ctx, `"${cmd}"은 모르겠어 🐝\n/skills 로 목록 한번 볼래?`);
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
    return reply(ctx, '어디? 지역 이름을 말해줘!\n예: "강남구 미세먼지"');
  }
  await ctx.sendChatAction("typing");
  const data = await proxy.getFineDust(region);
  await reply(ctx, fmt.formatFineDust(data));
}

async function nlWeather(ctx, text) {
  return reply(
    ctx,
    "날씨는 좌표가 필요해!\n/weather <위도> <경도>\n예: /weather 37.5665 126.9780",
  );
}

async function nlSubway(ctx, text) {
  const station = text
    .replace(/지하철|도착|몇\s*분|뒤에?|오나|와|역|실시간|정보|알려줘|보여줘/g, "")
    .trim();
  if (!station) {
    return reply(ctx, '어느 역인지 말해줘!\n예: "강남역 도착 정보"');
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
    return reply(ctx, '어떤 종목? 이름을 말해줘!\n예: "삼성전자 주가"');
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
        '뭐가 궁금해? 이런 거 물어볼 수 있어! 🐝',
        '',
        '• "강남구 미세먼지" - 미세먼지 조회',
        '• "삼성전자 주가" - 주식 검색',
        '• "강남역 지하철" - 도착 정보',
        '• /skills - 내가 할 수 있는 것들',
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

  // Render 등 클라우드 플랫폼용 건강체크 HTTP 서버
  const port = process.env.PORT;
  if (port) {
    const server = createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", skills: skills.size }));
    });
    server.listen(port, () => console.log(`Health check on :${port}`));
  }

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

main().catch((error) => {
  console.error("Bot startup error:", error);
  process.exit(1);
});

export { bot, initSkills };
