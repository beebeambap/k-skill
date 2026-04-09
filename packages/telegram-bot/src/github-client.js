const GITHUB_API = "https://api.github.com";
const REPO = "beebeambap/k-skill";

function headers() {
  const h = {
    Accept: "application/vnd.github+json",
    "User-Agent": "k-skill-telegram-bot",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    h.Authorization = `Bearer ${token}`;
  }
  return h;
}

async function githubGet(path) {
  const url = `${GITHUB_API}${path}`;
  const response = await fetch(url, {
    headers: headers(),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${url}`);
  }

  return response.json();
}

export async function getRepoInfo() {
  return githubGet(`/repos/${REPO}`);
}

export async function getIssues({ state = "open", perPage = 5 } = {}) {
  return githubGet(
    `/repos/${REPO}/issues?state=${state}&per_page=${perPage}&sort=updated`,
  );
}

export async function getPullRequests({ state = "open", perPage = 5 } = {}) {
  return githubGet(
    `/repos/${REPO}/pulls?state=${state}&per_page=${perPage}&sort=updated`,
  );
}

export async function getReleases({ perPage = 3 } = {}) {
  return githubGet(`/repos/${REPO}/releases?per_page=${perPage}`);
}

export { REPO };
