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
const DEFAULT_HIDE_SOURCE_LINKS = true;
const FEED_CURSOR_KEY = "feed_cursor";
const INCIDENT_STATE_PREFIX = "incident_state:";

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
    const translatedIncident = await buildPublicIncident(latestIncident, env);
    const cursor = await readFeedCursor(env);
    const pendingEntries = getPendingFeedEntries(incidents, cursor);

    if (!pendingEntries.length) {
      return buildResult("Nu exista actualizari noi in feed.", translatedIncident, 200);
    }

    if (!context.allowPublish) {
      return buildResult(
        pendingEntries.length === 1
          ? "Exista o actualizare noua in feed. Publicarea in Instatus ruleaza doar prin cron sau printr-un trigger manual autorizat."
          : `Exista ${pendingEntries.length} actualizari noi in feed. Publicarea in Instatus ruleaza doar prin cron sau printr-un trigger manual autorizat.`,
        translatedIncident,
        200,
      );
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

    const syncResult = await syncPendingFeedEntries(env, pendingEntries);
    if (!syncResult.ok) {
      if (syncResult.statusCode === 429) {
        const retryAfterSeconds = syncResult.retryAfterSeconds || DEFAULT_INSTATUS_RETRY_AFTER_SECONDS;
        await writeInstatusBackoff(env, retryAfterSeconds);
      }

      return buildResult(
        syncResult.message ?? "Sincronizarea catre Instatus a esuat.",
        syncResult.incident || translatedIncident,
        syncResult.statusCode === 429 ? 429 : 502,
      );
    }

    await clearInstatusBackoff(env);

    return buildResult(syncResult.message, syncResult.incident || translatedIncident, 200);
  } catch (error) {
    console.error("Eroare procesare:", sanitizeError(error));
    return buildResult("A aparut o eroare la procesarea incidentului.", null, 500);
  }
}

async function syncPendingFeedEntries(env, entries) {
  let latestPublicIncident = null;
  let createdCount = 0;
  let updatedCount = 0;
  let resolvedCount = 0;
  let skippedCount = 0;

  for (const entry of entries) {
    const sourceIncident = await buildSourceIncident(entry, env);
    latestPublicIncident = sourceIncident.publicIncident;

    if (!sourceIncident.status.instatus) {
      await writeFeedCursor(env, sourceIncident);
      skippedCount += 1;
      continue;
    }

    const existingState = await readIncidentState(env, sourceIncident.sourceKey);
    const action = determineInstatusAction(existingState, sourceIncident);

    if (action === "skip") {
      await writeFeedCursor(env, sourceIncident);
      skippedCount += 1;
      continue;
    }

    let syncResult;
    if (action === "create") {
      syncResult = await createInstatusIncident(env, sourceIncident);
    } else {
      syncResult = await updateExistingInstatusIncident(env, existingState, sourceIncident);
    }

    if (!syncResult.ok) {
      return {
        ...syncResult,
        incident: latestPublicIncident,
      };
    }

    await writeIncidentState(env, sourceIncident, syncResult.incidentId);
    await writeFeedCursor(env, sourceIncident);
    await env.STATUS_KV.put("last_incident", sourceIncident.rawTitle);

    if (action === "create") {
      createdCount += 1;
    } else if (sourceIncident.status.instatus === "RESOLVED") {
      resolvedCount += 1;
    } else {
      updatedCount += 1;
    }
  }

  return {
    ok: true,
    incident: latestPublicIncident,
    message: buildSyncSummaryMessage(createdCount, updatedCount, resolvedCount, skippedCount),
  };
}

async function buildSourceIncident(entry, env) {
  const status = mapStatus(entry.title, entry.description);
  const publicIncident = await buildPublicIncident(entry, env, status);

  return {
    entryId: entry.entryId || buildSyntheticEntryId(entry),
    rawTitle: entry.title || "",
    rawDescription: entry.description || "",
    rawPubDate: entry.pubDate || "",
    rawLink: entry.link || "",
    status,
    sourceKey: buildSourceIncidentKey(entry.title, status),
    publicIncident,
  };
}

async function buildPublicIncident(entry, env, statusHint = null) {
  const status = statusHint || mapStatus(entry.title, entry.description);
  const title = await translateTitleToRomanian(entry.title, env, status, {
    maxLength: 250,
    fallback: "Incident fara titlu",
  });
  const description = await translateToRomanian(entry.description, env, {
    stripHtml: true,
    maxLength: getMaxDescriptionLength(env),
    fallback: "Nu exista descriere disponibila.",
    statusHint: status,
  });
  const publicLink = buildPublicIncidentLink(entry, env);

  const incident = {
    title,
    description: sanitizePublicDescription(description, env),
    date: formatDateToRomanian(entry.pubDate, env.TIME_ZONE || DEFAULT_TIME_ZONE),
  };

  if (publicLink) {
    incident.link = publicLink;
  }

  return incident;
}

function determineInstatusAction(existingState, sourceIncident) {
  if (!existingState?.instatusIncidentId) {
    return "create";
  }

  if (existingState.lastFeedEntryId && existingState.lastFeedEntryId === sourceIncident.entryId) {
    return "skip";
  }

  if (existingState.currentStatus === "RESOLVED") {
    return "create";
  }

  return "update";
}

function buildSyncSummaryMessage(createdCount, updatedCount, resolvedCount, skippedCount) {
  const parts = [];

  if (createdCount > 0) {
    parts.push(`${createdCount} incident nou creat`);
  }

  if (updatedCount > 0) {
    parts.push(`${updatedCount} actualizare trimisa`);
  }

  if (resolvedCount > 0) {
    parts.push(`${resolvedCount} incident marcat ca rezolvat`);
  }

  if (skippedCount > 0) {
    parts.push(`${skippedCount} intrare omisa`);
  }

  if (!parts.length) {
    return "Nu a fost necesara nicio modificare in Instatus.";
  }

  return `${parts.join(", ")}.`;
}

async function readFeedCursor(env) {
  try {
    const raw = await env.STATUS_KV.get(FEED_CURSOR_KEY, "json");
    if (!raw || typeof raw !== "object") {
      return null;
    }

    return {
      entryId: raw.entryId || "",
      pubDate: raw.pubDate || "",
    };
  } catch (error) {
    console.error("Eroare cursor feed:", sanitizeError(error));
    return null;
  }
}

async function writeFeedCursor(env, sourceIncident) {
  try {
    await env.STATUS_KV.put(
      FEED_CURSOR_KEY,
      JSON.stringify({
        entryId: sourceIncident.entryId,
        pubDate: sourceIncident.rawPubDate || "",
      }),
    );
  } catch (error) {
    console.error("Eroare salvare cursor feed:", sanitizeError(error));
  }
}

function getPendingFeedEntries(incidents, cursor) {
  const newestFirst = incidents.filter((entry) => entry.entryId || entry.title);
  if (!newestFirst.length) {
    return [];
  }

  const oldestFirst = [...newestFirst].reverse();

  if (!cursor?.entryId) {
    return [oldestFirst[oldestFirst.length - 1]];
  }

  const cursorIndex = oldestFirst.findIndex((entry) => entry.entryId === cursor.entryId);
  if (cursorIndex >= 0) {
    return oldestFirst.slice(cursorIndex + 1);
  }

  const cursorTimestamp = Date.parse(cursor.pubDate || "");
  if (Number.isFinite(cursorTimestamp)) {
    const newerByTime = oldestFirst.filter((entry) => {
      const entryTimestamp = Date.parse(entry.pubDate || "");
      return Number.isFinite(entryTimestamp) && entryTimestamp > cursorTimestamp;
    });

    return newerByTime.length ? newerByTime : [oldestFirst[oldestFirst.length - 1]];
  }

  return [oldestFirst[oldestFirst.length - 1]];
}

async function readIncidentState(env, sourceKey) {
  if (!sourceKey) {
    return null;
  }

  try {
    return await env.STATUS_KV.get(getIncidentStateKey(sourceKey), "json");
  } catch (error) {
    console.error("Eroare citire stare incident:", sanitizeError(error));
    return null;
  }
}

async function writeIncidentState(env, sourceIncident, instatusIncidentId) {
  if (!sourceIncident?.sourceKey || !instatusIncidentId) {
    return;
  }

  const payload = {
    sourceKey: sourceIncident.sourceKey,
    instatusIncidentId,
    currentStatus: sourceIncident.status.instatus,
    lastFeedEntryId: sourceIncident.entryId,
    lastFeedEntryDate: sourceIncident.rawPubDate || "",
    lastTitle: sourceIncident.rawTitle || "",
    updatedAt: new Date().toISOString(),
  };

  try {
    await env.STATUS_KV.put(getIncidentStateKey(sourceIncident.sourceKey), JSON.stringify(payload));
  } catch (error) {
    console.error("Eroare salvare stare incident:", sanitizeError(error));
  }
}

function getIncidentStateKey(sourceKey) {
  return `${INCIDENT_STATE_PREFIX}${sourceKey}`;
}

function buildSourceIncidentKey(title, statusHint) {
  const original = normalizeWhitespace(title || "");
  if (!original) {
    return "incident-necunoscut";
  }

  const keywords = statusHint?.keywords || getStatusKeywords(statusHint);
  const alternation = keywords.length ? keywords.map(escapeRegExp).join("|") : "investigating|identified|monitoring|resolved";
  const normalized = original
    .replace(new RegExp(`^\\s*(?:${alternation})\\s*[-:|]\\s*`, "i"), "")
    .replace(new RegExp(`\\s*[-:|]\\s*(?:${alternation})\\s*$`, "i"), "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  return normalized || original.toLowerCase();
}

function buildSyntheticEntryId(entry) {
  return [
    normalizeWhitespace(entry?.title || ""),
    normalizeWhitespace(entry?.pubDate || ""),
    normalizeWhitespace(entry?.link || ""),
  ].join("|");
}

function buildPublicIncidentLink(entry, env) {
  const publicStatusUrl = normalizeWhitespace(env?.PUBLIC_STATUS_URL || "");
  if (publicStatusUrl) {
    return publicStatusUrl;
  }

  if (readBoolean(env?.HIDE_SOURCE_LINKS, DEFAULT_HIDE_SOURCE_LINKS)) {
    return "";
  }

  return normalizeWhitespace(entry?.link || "");
}

function sanitizePublicDescription(description, env) {
  const normalized = normalizeWhitespace(description || "");
  if (!normalized) {
    return "";
  }

  if (!readBoolean(env?.HIDE_SOURCE_LINKS, DEFAULT_HIDE_SOURCE_LINKS)) {
    return normalized;
  }

  return normalizeWhitespace(
    normalized.replace(/https?:\/\/[^\s)]+/gi, "").replace(/\(\s*\)/g, "").replace(/\[\s*\]/g, ""),
  );
}

function getConfiguredComponentIds(env) {
  const raw = normalizeWhitespace(env?.INSTATUS_COMPONENT_IDS || "");
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean);
}

function mapIncidentToComponentStatus(incidentStatus, env) {
  const defaults = {
    INVESTIGATING: "MAJOROUTAGE",
    IDENTIFIED: "PARTIALOUTAGE",
    MONITORING: "DEGRADEDPERFORMANCE",
    RESOLVED: "OPERATIONAL",
  };

  const overrides = {
    INVESTIGATING: normalizeWhitespace(env?.INSTATUS_COMPONENT_STATUS_INVESTIGATING || ""),
    IDENTIFIED: normalizeWhitespace(env?.INSTATUS_COMPONENT_STATUS_IDENTIFIED || ""),
    MONITORING: normalizeWhitespace(env?.INSTATUS_COMPONENT_STATUS_MONITORING || ""),
    RESOLVED: normalizeWhitespace(env?.INSTATUS_COMPONENT_STATUS_RESOLVED || ""),
  };

  return overrides[incidentStatus?.instatus] || defaults[incidentStatus?.instatus] || "DEGRADEDPERFORMANCE";
}

function applyAffectedComponents(payload, env, incidentStatus) {
  const componentIds = getConfiguredComponentIds(env);
  if (!componentIds.length) {
    return payload;
  }

  const componentStatus = mapIncidentToComponentStatus(incidentStatus, env);
  payload.components = componentIds;
  payload.statuses = componentIds.map(() => componentStatus);
  return payload;
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
    entryId:
      extractTagValue(block, "guid") ||
      extractTagValue(block, "id") ||
      extractTagValue(block, "link"),
    title: extractTagValue(block, "title"),
    description: extractTagValue(block, "description"),
    pubDate: extractTagValue(block, "pubDate"),
    link: extractTagValue(block, "link"),
  };
}

function buildIncidentFromAtomBlock(block) {
  return {
    entryId:
      extractTagValue(block, "id") ||
      extractAtomLink(block) ||
      extractTagValue(block, "link"),
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

async function createInstatusIncident(env, sourceIncident) {
  const apiBase = (env.INSTATUS_API_BASE_URL || "https://api.instatus.com").replace(/\/+$/, "");
  const pageId = String(env.INSTATUS_PAGE_ID || "").trim();
  const url = `${apiBase}/v1/${encodeURIComponent(pageId)}/incidents`;

  const payload = applyAffectedComponents({
    name: sourceIncident.publicIncident.title,
    message: sourceIncident.publicIncident.description,
    status: sourceIncident.status.instatus,
    notify: readBoolean(env.INSTATUS_NOTIFY, false),
    shouldPublish: readBoolean(env.INSTATUS_SHOULD_PUBLISH, true),
  }, env, sourceIncident.status);

  const startedAt = parseDateToIso(sourceIncident.rawPubDate);
  if (startedAt) {
    payload.started = startedAt;
  }

  const response = await performInstatusRequest(env, url, "POST", payload);
  if (!response.ok) {
    return response;
  }

  const incidentId = extractInstatusIncidentId(response.body);
  if (!incidentId) {
    return {
      ok: false,
      message: "Instatus a raspuns fara ID de incident.",
    };
  }

  return {
    ok: true,
    incidentId,
  };
}

async function updateExistingInstatusIncident(env, existingState, sourceIncident) {
  const apiBase = (env.INSTATUS_API_BASE_URL || "https://api.instatus.com").replace(/\/+$/, "");
  const pageId = String(env.INSTATUS_PAGE_ID || "").trim();
  const incidentId = existingState.instatusIncidentId;
  const incidentUrl = `${apiBase}/v1/${encodeURIComponent(pageId)}/incidents/${encodeURIComponent(incidentId)}`;
  const updateUrl = `${incidentUrl}/incident-updates`;

  const startedAt = parseDateToIso(sourceIncident.rawPubDate);
  const updateIncidentPayload = applyAffectedComponents({
    name: sourceIncident.publicIncident.title,
    status: sourceIncident.status.instatus,
    notify: readBoolean(env.INSTATUS_NOTIFY, false),
  }, env, sourceIncident.status);

  if (startedAt) {
    updateIncidentPayload.started = startedAt;
  }

  const incidentResponse = await performInstatusRequest(env, incidentUrl, "PUT", updateIncidentPayload);
  if (!incidentResponse.ok) {
    return incidentResponse;
  }

  const incidentUpdatePayload = applyAffectedComponents({
    message: sourceIncident.publicIncident.description,
    status: sourceIncident.status.instatus,
    notify: readBoolean(env.INSTATUS_NOTIFY, false),
  }, env, sourceIncident.status);

  const updateResponse = await performInstatusRequest(env, updateUrl, "POST", incidentUpdatePayload);
  if (!updateResponse.ok) {
    return updateResponse;
  }

  return {
    ok: true,
    incidentId,
  };
}

async function performInstatusRequest(env, url, method, payload) {
  try {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${env.INSTATUS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = await parseResponseBody(response);
    if (!response.ok) {
      return {
        ok: false,
        statusCode: response.status,
        retryAfterSeconds: getRetryAfterSeconds(response),
        message:
          response.status === 429
            ? "Trimiterea catre Instatus a fost limitata temporar cu codul 429."
            : `Trimiterea catre Instatus a esuat cu codul ${response.status}.`,
        body,
      };
    }

    return {
      ok: true,
      body,
    };
  } catch (error) {
    console.error("Eroare Instatus:", sanitizeError(error));
    return {
      ok: false,
      message: "Trimiterea catre Instatus a esuat.",
    };
  }
}

async function parseResponseBody(response) {
  try {
    return await response.json();
  } catch {
    try {
      return await response.text();
    } catch {
      return null;
    }
  }
}

function extractInstatusIncidentId(body) {
  if (!body) {
    return "";
  }

  if (typeof body === "string") {
    return "";
  }

  if (typeof body.id === "string" && body.id) {
    return body.id;
  }

  if (body.incident && typeof body.incident.id === "string" && body.incident.id) {
    return body.incident.id;
  }

  if (body.data && typeof body.data.id === "string" && body.data.id) {
    return body.data.id;
  }

  return "";
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
