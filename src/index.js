const DEFAULT_RSS_URL = "https://www.stackstatus.com/rss";
const DEFAULT_RSS_FALLBACK_URL = "";
const DEFAULT_FETCH_TIMEOUT_MS = 15000;
const DEFAULT_MAX_DESCRIPTION_LENGTH = 1800;
const DEFAULT_TIME_ZONE = "Europe/Bucharest";
const DEFAULT_AI_TRANSLATION_MODEL = "@cf/meta/m2m100-1.2b";
const DEFAULT_AI_TRANSLATION_ENABLED = true;
const DEFAULT_AI_SOURCE_LANG = "english";
const DEFAULT_AI_TARGET_LANG = "romanian";
const DEFAULT_AI_MAX_INPUT_LENGTH = 3500;
const DEFAULT_INSTATUS_RETRY_AFTER_SECONDS = 300;

const STATUS_RULES = [
  {
    key: "investigating",
    keywords: ["investigating"],
    translated: "Investigam",
    instatus: "INVESTIGATING",
  },
  {
    key: "identified",
    keywords: ["identified"],
    translated: "Identificat",
    instatus: "IDENTIFIED",
  },
  {
    key: "monitoring",
    keywords: ["monitoring"],
    translated: "Monitorizam",
    instatus: "MONITORING",
  },
  {
    key: "resolved",
    keywords: ["resolved"],
    translated: "Rezolvat",
    instatus: "RESOLVED",
  },
];

const PHRASE_TRANSLATIONS = [
  ["we are actively investigating", "investigam activ"],
  ["we are investigating reports of", "investigam rapoartele privind"],
  ["we are investigating", "investigam"],
  ["we have identified the root cause", "am identificat cauza principala"],
  ["we have identified", "am identificat"],
  ["we identified", "am identificat"],
  ["we are monitoring the results", "monitorizam rezultatele"],
  ["we are monitoring", "monitorizam"],
  ["we continue to monitor", "continuam sa monitorizam"],
  ["this issue has been resolved", "aceasta problema a fost rezolvata"],
  ["the issue has been resolved", "problema a fost rezolvata"],
  ["the incident has been resolved", "incidentul a fost rezolvat"],
  ["a fix has been implemented", "am aplicat o remediere"],
  ["the fix has been implemented", "remedierea a fost aplicata"],
  ["mitigation has been applied", "a fost aplicata o masura de mitigare"],
  ["a mitigation has been applied", "a fost aplicata o masura de mitigare"],
  ["we are working to restore service as quickly as possible", "lucram pentru a restabili serviciul cat mai rapid"],
  ["users may be unable to", "utilizatorii pot sa nu poata"],
  ["some users may be unable to", "unii utilizatori pot sa nu poata"],
  ["users may experience", "utilizatorii pot intampina"],
  ["some users may experience", "unii utilizatori pot intampina"],
  ["thank you for your patience", "va multumim pentru rabdare"],
  ["we apologize for the inconvenience", "ne cerem scuze pentru inconvenient"],
  ["due to an issue", "din cauza unei probleme"],
  ["due to a problem", "din cauza unei probleme"],
  ["for some users", "pentru unii utilizatori"],
  ["for all users", "pentru toti utilizatorii"],
  ["elevated error rates", "rata crescuta de erori"],
  ["increased error rates", "rata crescuta de erori"],
  ["increased latency", "latenta crescuta"],
  ["degraded performance", "performanta degradata"],
  ["major outage", "intrerupere majora"],
  ["partial outage", "intrerupere partiala"],
  ["service is unavailable", "serviciul nu este disponibil"],
  ["service unavailable", "serviciu indisponibil"],
  ["intermittent errors", "erori intermitente"],
  ["intermittent failures", "esecuri intermitente"],
  ["login issues", "probleme de autentificare"],
  ["posting issues", "probleme la publicare"],
  ["connectivity issues", "probleme de conectivitate"],
  ["api issues", "probleme API"],
  ["read-only mode", "mod doar citire"],
  ["under maintenance", "in mentenanta"],
  ["investigating", "investigam"],
  ["identified", "identificat"],
  ["monitoring", "monitorizam"],
  ["resolved", "rezolvat"],
];

const WORD_TRANSLATIONS = {
  issue: "problema",
  issues: "probleme",
  incident: "incident",
  incidents: "incidente",
  service: "serviciu",
  services: "servicii",
  users: "utilizatori",
  user: "utilizator",
  report: "raport",
  reports: "rapoarte",
  error: "eroare",
  errors: "erori",
  failure: "esec",
  failures: "esecuri",
  unavailable: "indisponibil",
  availability: "disponibilitate",
  latency: "latenta",
  degraded: "degradata",
  outage: "intrerupere",
  partial: "partiala",
  major: "majora",
  monitoring: "monitorizare",
  maintenance: "mentenanta",
  update: "actualizare",
  updates: "actualizari",
  restore: "restabilire",
  restored: "restabilit",
  resolved: "rezolvat",
  identified: "identificat",
  investigating: "investigam",
  login: "autentificare",
  access: "acces",
  network: "retea",
  database: "baza de date",
  performance: "performanta",
  delay: "intarziere",
  delays: "intarzieri",
};

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      console.error("Eroare fetch:", sanitizeError(error));
      return jsonResponse(
        {
          status: "A aparut o eroare interna neasteptata.",
          incident: null,
        },
        500,
      );
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduled(env, event));
  },
};

async function runScheduled(env, event) {
  try {
    const result = await processLatestIncident(env, {
      source: "cron",
      allowPublish: true,
      cron: event?.cron ?? null,
    });

    console.log(JSON.stringify(result));
  } catch (error) {
    console.error("Eroare cron:", sanitizeError(error));
  }
}

async function handleRequest(_request, env) {
  const requestUrl = new URL(_request.url);
  const isManualSync = requestUrl.searchParams.get("sync") === "1";
  const providedToken = requestUrl.searchParams.get("token") || "";
  const allowManualSync = Boolean(
    isManualSync &&
      env.MANUAL_SYNC_TOKEN &&
      providedToken &&
      providedToken === env.MANUAL_SYNC_TOKEN,
  );

  const result = await processLatestIncident(env, {
    source: "http",
    allowPublish: allowManualSync,
  });
  return jsonResponse(
    {
      status: result.status,
      incident: result.incident,
    },
    result.httpStatus,
  );
}

async function processLatestIncident(env, context = {}) {
  try {
    if (!env || !env.STATUS_KV || typeof env.STATUS_KV.get !== "function" || typeof env.STATUS_KV.put !== "function") {
      return buildResult("Binding-ul STATUS_KV nu este configurat.", null, 500);
    }

    const rssResult = await fetchRSS(env);
    if (!rssResult.ok) {
      return buildResult(rssResult.message ?? "Preluarea RSS a esuat.", null, 502);
    }

    const incidents = parseRSS(rssResult.xml);
    if (!incidents.length) {
      return buildResult("Nu au fost gasite elemente RSS valide.", null, 200);
    }

    const latestIncident = incidents[0];
    const incidentStatus = mapStatus(latestIncident.title, latestIncident.description);
    const translatedIncident = {
      title: await translateTitleToRomanian(latestIncident.title, env, incidentStatus, {
        maxLength: 250,
        fallback: "Incident fara titlu",
      }),
      description: await translateToRomanian(latestIncident.description, env, {
        stripHtml: true,
        maxLength: getMaxDescriptionLength(env),
        fallback: "Nu exista descriere disponibila.",
        statusHint: incidentStatus,
      }),
      date: formatDateToRomanian(latestIncident.pubDate, env.TIME_ZONE || DEFAULT_TIME_ZONE),
      link: latestIncident.link || "",
    };

    const lastIncidentTitle = await env.STATUS_KV.get("last_incident");
    if (lastIncidentTitle && lastIncidentTitle === latestIncident.title) {
      return buildResult("Nu exista incident nou.", translatedIncident, 200);
    }

    if (!context.allowPublish) {
      return buildResult(
        "Incident nou detectat. Publicarea in Instatus ruleaza doar prin cron sau printr-un trigger manual autorizat.",
        translatedIncident,
        200,
      );
    }

    if (!incidentStatus.instatus) {
      await env.STATUS_KV.put("last_incident", latestIncident.title);
      return buildResult("Incident nou detectat, dar starea nu a putut fi mapata pentru Instatus.", translatedIncident, 200);
    }

    if (!env.INSTATUS_API_KEY || !env.INSTATUS_PAGE_ID) {
      return buildResult("Configuratia Instatus lipseste. Seteaza INSTATUS_API_KEY si INSTATUS_PAGE_ID.", translatedIncident, 500);
    }

    const backoffCheck = await readInstatusBackoff(env);
    if (backoffCheck.active) {
      return buildResult(
        `Instatus limiteaza temporar cererile. Urmatoarea incercare dupa ${backoffCheck.untilFormatted}.`,
        translatedIncident,
        200,
      );
    }

    const sendResult = await sendToInstatus(
      env,
      {
        title: translatedIncident.title,
        description: translatedIncident.description,
        rawPubDate: latestIncident.pubDate,
      },
      incidentStatus,
    );

    if (!sendResult.ok) {
      if (sendResult.statusCode === 429) {
        const retryAfterSeconds = sendResult.retryAfterSeconds || DEFAULT_INSTATUS_RETRY_AFTER_SECONDS;
        await writeInstatusBackoff(env, retryAfterSeconds);
      }

      return buildResult(
        sendResult.message ?? "Trimiterea catre Instatus a esuat.",
        translatedIncident,
        sendResult.statusCode === 429 ? 429 : 502,
      );
    }

    await clearInstatusBackoff(env);
    await env.STATUS_KV.put("last_incident", latestIncident.title);

    const statusMessage = context.source === "cron" ? "Incident procesat prin cron." : "Incident procesat.";
    return buildResult(statusMessage, translatedIncident, 200);
  } catch (error) {
    console.error("Eroare procesare:", sanitizeError(error));
    return buildResult("A aparut o eroare la procesarea incidentului.", null, 500);
  }
}

async function fetchRSS(env) {
  const urls = uniqueValues([
    env?.RSS_URL || DEFAULT_RSS_URL,
    env?.RSS_FALLBACK_URL || DEFAULT_RSS_FALLBACK_URL,
  ]);

  let lastMessage = "Preluarea RSS a esuat.";

  for (const url of urls) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort("timeout"), getFetchTimeout(env));

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8",
        },
        redirect: "follow",
        signal: controller.signal,
      });

      if (!response.ok) {
        lastMessage = `Preluarea RSS a esuat cu codul ${response.status}.`;
        continue;
      }

      const xml = await response.text();
      if (!xml || (!xml.includes("<item") && !xml.includes("<entry"))) {
        lastMessage = "RSS-ul primit este gol sau invalid.";
        continue;
      }

      return { ok: true, xml, sourceUrl: url };
    } catch (error) {
      lastMessage = isAbortError(error)
        ? "Preluarea RSS a expirat."
        : "Preluarea RSS a esuat.";
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return { ok: false, message: lastMessage };
}

function parseRSS(xml) {
  if (!xml || typeof xml !== "string") {
    return [];
  }

  try {
    const rssItems = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((match) =>
      buildIncidentFromRssBlock(match[1] || ""),
    );

    const atomItems = [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map((match) =>
      buildIncidentFromAtomBlock(match[1] || ""),
    );

    const items = [...rssItems, ...atomItems].filter((item) => item.title || item.description || item.link);

    items.sort((left, right) => {
      const leftTime = Date.parse(left.pubDate || "") || 0;
      const rightTime = Date.parse(right.pubDate || "") || 0;
      return rightTime - leftTime;
    });

    return items;
  } catch {
    return [];
  }
}

function buildIncidentFromRssBlock(block) {
  return {
    title: extractTagValue(block, "title"),
    description: extractTagValue(block, "description"),
    pubDate: extractTagValue(block, "pubDate"),
    link: extractTagValue(block, "link"),
  };
}

function buildIncidentFromAtomBlock(block) {
  return {
    title: extractTagValue(block, "title"),
    description:
      extractTagValue(block, "summary") ||
      extractTagValue(block, "content") ||
      extractTagValue(block, "description"),
    pubDate:
      extractTagValue(block, "updated") ||
      extractTagValue(block, "published") ||
      extractTagValue(block, "pubDate"),
    link: extractAtomLink(block) || extractTagValue(block, "link"),
  };
}

async function translateTitleToRomanian(input, env, statusHint, options = {}) {
  const fallbackTitle = buildFallbackTranslatedTitle(input, statusHint, options);
  const titleStructure = extractStatusFromTitle(input, statusHint);

  if (!titleStructure) {
    return translateToRomanian(input, env, {
      ...options,
      statusHint,
      fallback: fallbackTitle,
    });
  }

  const translatedRemainder = await translateToRomanian(titleStructure.remainder, env, {
    ...options,
    fallback: titleStructure.remainder
      ? fallbackTranslateToRomanian(titleStructure.remainder, options)
      : "",
  });

  return rebuildTranslatedTitle(titleStructure, translatedRemainder, statusHint, options) || fallbackTitle;
}

async function translateToRomanian(input, env, options = {}) {
  const fallback = fallbackTranslateToRomanian(input, options);
  const prepared = prepareTextForTranslation(input, options);

  if (!prepared) {
    return fallback;
  }

  if (!shouldUseAiTranslation(env)) {
    return fallback;
  }

  try {
    const aiResponse = await env.AI.run(getAiTranslationModel(env), {
      text: limitLength(prepared, getAiMaxInputLength(env)),
      source_lang: env.AI_SOURCE_LANG || DEFAULT_AI_SOURCE_LANG,
      target_lang: env.AI_TARGET_LANG || DEFAULT_AI_TARGET_LANG,
    });

    const translated = extractAiTranslatedText(aiResponse);
    if (!translated) {
      return fallback;
    }

    let normalized = options.stripHtml ? stripHtml(translated) : normalizeWhitespace(translated);
    normalized = normalizeTranslatedStatusPhrases(normalized, options.statusHint);
    normalized = normalizeSentenceSpacing(normalized);
    normalized = capitalizeRomanianText(normalized);

    const maxLength = Number.parseInt(options.maxLength, 10);
    if (Number.isFinite(maxLength) && maxLength > 0) {
      normalized = limitLength(normalized, maxLength);
    }

    return normalized || fallback;
  } catch (error) {
    console.error("Eroare traducere AI:", sanitizeError(error));
    return fallback;
  }
}

function fallbackTranslateToRomanian(input, options = {}) {
  const fallback = options.fallback ?? "";
  if (!input || typeof input !== "string") {
    return fallback;
  }

  let text = prepareTextForTranslation(input, options);
  if (!text) {
    return fallback;
  }

  let translated = text;

  for (const [search, replacement] of PHRASE_TRANSLATIONS) {
    translated = replaceCaseInsensitive(translated, search, replacement);
  }

  translated = translateWords(translated);
  translated = normalizeSentenceSpacing(translated);
  translated = capitalizeRomanianText(translated);

  const maxLength = Number.parseInt(options.maxLength, 10);
  if (Number.isFinite(maxLength) && maxLength > 0) {
    translated = limitLength(translated, maxLength);
  }

  return translated || fallback;
}

function mapStatus(title, description) {
  const titleStatus = findStatusInText(title);
  if (titleStatus) {
    return titleStatus;
  }

  const descriptionStatus = findStatusInText(description);
  if (descriptionStatus) {
    return descriptionStatus;
  }

  return {
    key: "necunoscut",
    translated: "Actualizare incident",
    instatus: null,
  };
}

function prepareTextForTranslation(input, options = {}) {
  if (!input || typeof input !== "string") {
    return options.fallback ?? "";
  }

  let text = removeCdata(input);
  text = decodeXmlEntities(text);
  text = options.stripHtml ? stripHtml(text) : normalizeWhitespace(text);
  return text;
}

async function readInstatusBackoff(env) {
  try {
    const value = await env.STATUS_KV.get("instatus_rate_limited_until");
    if (!value) {
      return { active: false, until: null, untilFormatted: "" };
    }

    const until = Number.parseInt(value, 10);
    if (!Number.isFinite(until) || until <= Date.now()) {
      await env.STATUS_KV.delete("instatus_rate_limited_until");
      return { active: false, until: null, untilFormatted: "" };
    }

    return {
      active: true,
      until,
      untilFormatted: formatTimestampToRomanian(until, env.TIME_ZONE || DEFAULT_TIME_ZONE),
    };
  } catch (error) {
    console.error("Eroare backoff Instatus:", sanitizeError(error));
    return { active: false, until: null, untilFormatted: "" };
  }
}

async function writeInstatusBackoff(env, retryAfterSeconds) {
  const safeSeconds =
    Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? retryAfterSeconds
      : DEFAULT_INSTATUS_RETRY_AFTER_SECONDS;
  const until = Date.now() + safeSeconds * 1000;

  try {
    await env.STATUS_KV.put("instatus_rate_limited_until", String(until), {
      expirationTtl: safeSeconds,
    });
  } catch (error) {
    console.error("Eroare salvare backoff Instatus:", sanitizeError(error));
  }
}

async function clearInstatusBackoff(env) {
  try {
    await env.STATUS_KV.delete("instatus_rate_limited_until");
  } catch (error) {
    console.error("Eroare stergere backoff Instatus:", sanitizeError(error));
  }
}

function getRetryAfterSeconds(response) {
  const header = response.headers.get("Retry-After");
  if (!header) {
    return DEFAULT_INSTATUS_RETRY_AFTER_SECONDS;
  }

  const seconds = Number.parseInt(header, 10);
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds;
  }

  const dateValue = Date.parse(header);
  if (Number.isFinite(dateValue)) {
    const deltaSeconds = Math.ceil((dateValue - Date.now()) / 1000);
    return deltaSeconds > 0 ? deltaSeconds : DEFAULT_INSTATUS_RETRY_AFTER_SECONDS;
  }

  return DEFAULT_INSTATUS_RETRY_AFTER_SECONDS;
}

function shouldUseAiTranslation(env) {
  return Boolean(env?.AI && typeof env.AI.run === "function" && readBoolean(env.AI_TRANSLATION_ENABLED, DEFAULT_AI_TRANSLATION_ENABLED));
}

function getAiTranslationModel(env) {
  return env?.AI_TRANSLATION_MODEL || DEFAULT_AI_TRANSLATION_MODEL;
}

function getAiMaxInputLength(env) {
  const parsed = Number.parseInt(env?.AI_MAX_INPUT_LENGTH, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_AI_MAX_INPUT_LENGTH;
}

function extractAiTranslatedText(aiResponse) {
  if (!aiResponse) {
    return "";
  }

  if (typeof aiResponse === "string") {
    return normalizeWhitespace(aiResponse);
  }

  if (Array.isArray(aiResponse)) {
    for (const item of aiResponse) {
      const extracted = extractAiTranslatedText(item);
      if (extracted) {
        return extracted;
      }
    }
  }

  const candidateKeys = [
    "translated_text",
    "translation",
    "text",
    "output",
    "response",
    "result",
  ];

  for (const key of candidateKeys) {
    const value = aiResponse[key];
    if (typeof value === "string" && normalizeWhitespace(value)) {
      return normalizeWhitespace(value);
    }
  }

  if (Array.isArray(aiResponse.translations) && aiResponse.translations.length) {
    return extractAiTranslatedText(aiResponse.translations[0]);
  }

  if (Array.isArray(aiResponse.results) && aiResponse.results.length) {
    return extractAiTranslatedText(aiResponse.results[0]);
  }

  return "";
}

function extractStatusFromTitle(title, statusHint) {
  if (!title || !statusHint?.translated) {
    return null;
  }

  const keywords = getStatusKeywords(statusHint);
  if (!keywords.length) {
    return null;
  }

  const alternation = keywords.map(escapeRegExp).join("|");
  const prefixPattern = new RegExp(`^\\s*(${alternation})\\s*[-:|]\\s*(.+?)\\s*$`, "i");
  const suffixPattern = new RegExp(`^\\s*(.+?)\\s*[-:|]\\s*(${alternation})\\s*$`, "i");
  const exactPattern = new RegExp(`^\\s*(${alternation})\\s*$`, "i");

  const prefixMatch = title.match(prefixPattern);
  if (prefixMatch) {
    return {
      position: "prefix",
      remainder: normalizeWhitespace(prefixMatch[2] || ""),
    };
  }

  const suffixMatch = title.match(suffixPattern);
  if (suffixMatch) {
    return {
      position: "suffix",
      remainder: normalizeWhitespace(suffixMatch[1] || ""),
    };
  }

  if (title.match(exactPattern)) {
    return {
      position: "exact",
      remainder: "",
    };
  }

  return null;
}

function getStatusKeywords(statusHint) {
  if (!statusHint?.key) {
    return [];
  }

  const matchingRule = STATUS_RULES.find((rule) => rule.key === statusHint.key);
  return matchingRule?.keywords || [];
}

function buildFallbackTranslatedTitle(title, statusHint, options = {}) {
  const structure = extractStatusFromTitle(title, statusHint);
  if (!structure) {
    return fallbackTranslateToRomanian(title, options);
  }

  return rebuildTranslatedTitle(
    structure,
    fallbackTranslateToRomanian(structure.remainder, options),
    statusHint,
    options,
  );
}

function rebuildTranslatedTitle(structure, translatedRemainder, statusHint, options = {}) {
  const statusLabel = statusHint?.translated || options.fallback || "Actualizare incident";
  const cleanRemainder = capitalizeRomanianText(normalizeWhitespace(translatedRemainder));

  if (structure?.position === "prefix") {
    return cleanRemainder ? `${statusLabel} - ${cleanRemainder}` : statusLabel;
  }

  if (structure?.position === "suffix") {
    return cleanRemainder ? `${cleanRemainder} - ${statusLabel}` : statusLabel;
  }

  if (structure?.position === "exact") {
    return statusLabel;
  }

  return cleanRemainder || statusLabel;
}

function normalizeTranslatedStatusPhrases(text, statusHint) {
  let normalized = String(text || "");

  normalized = normalized
    .replace(/\b(?:investigating|investigating issue|under investigation)\b/gi, "Investigam")
    .replace(/\b(?:identified|issue identified|cause identified)\b/gi, "Identificat")
    .replace(/\b(?:monitoring|closely monitoring)\b/gi, "Monitorizam")
    .replace(/\b(?:resolved|issue resolved|incident resolved)\b/gi, "Rezolvat");

  if (statusHint?.translated) {
    normalized = replaceCaseInsensitive(normalized, statusHint.translated, statusHint.translated);
  }

  return normalized;
}

async function sendToInstatus(env, incident, mappedStatus) {
  const apiBase = (env.INSTATUS_API_BASE_URL || "https://api.instatus.com").replace(/\/+$/, "");
  const pageId = String(env.INSTATUS_PAGE_ID || "").trim();
  const url = `${apiBase}/v1/${encodeURIComponent(pageId)}/incidents`;

  const payload = {
    name: incident.title,
    message: incident.description,
    status: mappedStatus.instatus,
    notify: readBoolean(env.INSTATUS_NOTIFY, false),
    shouldPublish: readBoolean(env.INSTATUS_SHOULD_PUBLISH, true),
  };

  const startedAt = parseDateToIso(incident.rawPubDate);
  if (startedAt) {
    payload.started = startedAt;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.INSTATUS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return {
        ok: false,
        statusCode: response.status,
        retryAfterSeconds: getRetryAfterSeconds(response),
        message:
          response.status === 429
            ? "Trimiterea catre Instatus a fost limitata temporar cu codul 429."
            : `Trimiterea catre Instatus a esuat cu codul ${response.status}.`,
      };
    }

    return { ok: true };
  } catch (error) {
    console.error("Eroare Instatus:", sanitizeError(error));
    return {
      ok: false,
      message: "Trimiterea catre Instatus a esuat.",
    };
  }
}

function extractTagValue(block, tagName) {
  const pattern = new RegExp(
    `<(?:\\w+:)?${tagName}\\b[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${tagName}>`,
    "i",
  );
  const match = block.match(pattern);
  if (!match) {
    return "";
  }

  return normalizeWhitespace(decodeXmlEntities(removeCdata(match[1] || "")));
}

function extractAtomLink(block) {
  if (!block) {
    return "";
  }

  const alternateMatch = block.match(/<link\b[^>]*\brel=["']alternate["'][^>]*\bhref=["']([^"']+)["'][^>]*\/?>/i);
  if (alternateMatch?.[1]) {
    return normalizeWhitespace(decodeXmlEntities(alternateMatch[1]));
  }

  const hrefMatch = block.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\/?>/i);
  if (hrefMatch?.[1]) {
    return normalizeWhitespace(decodeXmlEntities(hrefMatch[1]));
  }

  return "";
}

function findStatusInText(text) {
  if (!text) {
    return null;
  }

  const normalized = String(text).toLowerCase();
  let bestMatch = null;

  for (const rule of STATUS_RULES) {
    for (const keyword of rule.keywords) {
      const index = normalized.indexOf(keyword);
      if (index === -1) {
        continue;
      }

      if (!bestMatch || index < bestMatch.index) {
        bestMatch = { index, rule };
      }
    }
  }

  return bestMatch ? bestMatch.rule : null;
}

function stripHtml(input) {
  const value = String(input || "")
    .replace(/<\s*br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");

  return normalizeWhitespace(value);
}

function decodeXmlEntities(input) {
  if (!input || typeof input !== "string") {
    return "";
  }

  const namedEntities = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": "\"",
    "&apos;": "'",
    "&#39;": "'",
    "&nbsp;": " ",
  };

  return input
    .replace(/&(amp|lt|gt|quot|apos|nbsp);|&#39;/g, (entity) => namedEntities[entity] || entity)
    .replace(/&#(\d+);/g, (_, code) => safeCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => safeCodePoint(Number.parseInt(code, 16)));
}

function safeCodePoint(code) {
  if (!Number.isFinite(code)) {
    return "";
  }

  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

function removeCdata(value) {
  return String(value || "")
    .replace(/^<!\[CDATA\[/, "")
    .replace(/\]\]>$/, "");
}

function replaceCaseInsensitive(text, search, replacement) {
  const escaped = escapeRegExp(search);
  return text.replace(new RegExp(escaped, "gi"), replacement);
}

function translateWords(text) {
  let translated = text;

  for (const [word, replacement] of Object.entries(WORD_TRANSLATIONS)) {
    translated = translated.replace(new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi"), replacement);
  }

  return translated;
}

function normalizeSentenceSpacing(text) {
  return normalizeWhitespace(
    String(text || "")
      .replace(/\s+([,.;:!?])/g, "$1")
      .replace(/([,.;:!?])([^\s])/g, "$1 $2"),
  );
}

function capitalizeRomanianText(text) {
  const value = String(text || "").trim();
  if (!value) {
    return "";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function limitLength(text, maxLength) {
  const value = String(text || "");
  if (!maxLength || value.length <= maxLength) {
    return value;
  }

  const shortened = value.slice(0, Math.max(0, maxLength - 1)).trimEnd();
  return `${shortened}...`;
}

function formatDateToRomanian(pubDate, timeZone) {
  if (!pubDate) {
    return "";
  }

  const parsed = new Date(pubDate);
  if (Number.isNaN(parsed.getTime())) {
    return normalizeWhitespace(pubDate);
  }

  try {
    return new Intl.DateTimeFormat("ro-RO", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone,
    }).format(parsed);
  } catch {
    return parsed.toISOString();
  }
}

function formatTimestampToRomanian(timestamp, timeZone) {
  if (!timestamp) {
    return "";
  }

  return formatDateToRomanian(new Date(timestamp).toISOString(), timeZone);
}

function parseDateToIso(pubDate) {
  if (!pubDate) {
    return null;
  }

  const parsed = new Date(pubDate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function getFetchTimeout(env) {
  const parsed = Number.parseInt(env?.FETCH_TIMEOUT_MS, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_FETCH_TIMEOUT_MS;
}

function getMaxDescriptionLength(env) {
  const parsed = Number.parseInt(env?.MAX_DESCRIPTION_LENGTH, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_DESCRIPTION_LENGTH;
}

function readBoolean(value, defaultValue) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "da", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "nu", "off"].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function isAbortError(error) {
  return error?.name === "AbortError" || String(error).toLowerCase().includes("abort");
}

function sanitizeError(error) {
  if (!error) {
    return "Eroare necunoscuta.";
  }

  if (typeof error === "string") {
    return normalizeWhitespace(error).slice(0, 300);
  }

  if (error instanceof Error) {
    return normalizeWhitespace(error.message || error.toString()).slice(0, 300);
  }

  return normalizeWhitespace(String(error)).slice(0, 300);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildResult(status, incident, httpStatus) {
  return { status, incident, httpStatus };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-store",
    },
  });
}
