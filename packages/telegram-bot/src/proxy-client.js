const DEFAULT_PROXY_URL = "https://k-skill-proxy.nomadamas.org";

function getProxyBaseUrl() {
  return process.env.KSKILL_PROXY_BASE_URL || DEFAULT_PROXY_URL;
}

async function proxyGet(path, params = {}) {
  const url = new URL(path, getProxyBaseUrl());
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Proxy ${response.status}: ${text.slice(0, 200)}`);
  }

  return response.json();
}

// --- Fine Dust ---

export async function getFineDust(regionHint) {
  const data = await proxyGet("/v1/fine-dust/report", { regionHint });

  if (data.ambiguous_location && data.candidate_stations) {
    return {
      ambiguous: true,
      candidates: data.candidate_stations,
      message: `"${regionHint}" 측정소를 특정할 수 없습니다.\n후보: ${data.candidate_stations.join(", ")}`,
    };
  }

  const s = data.station || {};
  return {
    ambiguous: false,
    station: s.stationName || regionHint,
    time: s.dataTime || "N/A",
    pm10: s.pm10Value ?? "N/A",
    pm10Grade: s.pm10Grade1h ?? "",
    pm25: s.pm25Value ?? "N/A",
    pm25Grade: s.pm25Grade1h ?? "",
    khaiGrade: s.khaiGrade ?? "",
  };
}

// --- Weather ---

export async function getWeather(params) {
  return proxyGet("/v1/korea-weather/forecast", params);
}

// --- Seoul Subway ---

export async function getSubwayArrival(stationName) {
  return proxyGet("/v1/seoul-subway/arrival", { stationName });
}

// --- Han River Water Level ---

export async function getHanRiverWaterLevel() {
  return proxyGet("/v1/han-river/water-level");
}

// --- Korean Stock ---

export async function searchStocks(query) {
  return proxyGet("/v1/korean-stock/search", { query });
}

export async function getStockBaseInfo(isuCd) {
  return proxyGet("/v1/korean-stock/base-info", { isuCd });
}

// --- Gas Station ---

export async function getGasAround(params) {
  return proxyGet("/v1/opinet/around", params);
}

// --- Household Waste ---

export async function getHouseholdWaste(regionHint) {
  return proxyGet("/v1/household-waste/info", { regionHint });
}

export { getProxyBaseUrl };
