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
const DEFAULT_AI_INCIDENT_CLASSIFICATION_ENABLED = true;
const DEFAULT_AI_INCIDENT_CLASSIFICATION_MODEL = "@cf/meta/llama-3.1-8b-instruct-awq";
const DEFAULT_AI_INCIDENT_CLASSIFICATION_MAX_INPUT_LENGTH = 2200;
const DEFAULT_STATUSPAGE_RETRY_AFTER_SECONDS = 300;
const DEFAULT_STATUSPAGE_API_BASE_URL = "https://api.statuspage.io";
const DEFAULT_HIDE_SOURCE_LINKS = true;
const DEFAULT_COMPONENT_STATUS_UPDATES_ENABLED = false;
const DEFAULT_ONEUPTIME_API_BASE_URL = "https://oneuptime.com";
const FEED_CURSOR_KEY = "feed_cursor";
const INCIDENT_STATE_PREFIX = "incident_state:";
const SOURCE_CURRENT_INCIDENT_PREFIX = "source_current_incident:";
const STATUSPAGE_RATE_LIMIT_KEY = "statuspage_rate_limited_until";
let lastStatuspageRequestAt = 0;

const STATUS_RULES = [
  {
    key: "completed",
    keywords: [
      "scheduled maintenance completed",
      "maintenance completed",
      "completed maintenance",
      "maintenance complete",
    ],
    translated: "Mentenanta finalizata",
    statuspage: "completed",
  },
  {
    key: "in_progress",
    keywords: [
      "maintenance in progress",
      "scheduled maintenance in progress",
      "under maintenance",
      "maintenance underway",
      "maintenance ongoing",
      "in progress maintenance",
    ],
    translated: "Mentenanta in curs",
    statuspage: "in_progress",
  },
  {
    key: "scheduled",
    keywords: [
      "planned maintenance",
      "scheduled maintenance",
      "maintenance scheduled",
      "maintenance window",
    ],
    translated: "Mentenanta programata",
    statuspage: "scheduled",
  },
  {
    key: "investigating",
    keywords: ["investigating"],
    translated: "Investigam",
    statuspage: "investigating",
  },
  {
    key: "identified",
    keywords: ["identified"],
    translated: "Identificat",
    statuspage: "identified",
  },
  {
    key: "monitoring",
    keywords: ["monitoring"],
    translated: "Monitorizam",
    statuspage: "monitoring",
  },
  {
    key: "resolved",
    keywords: ["resolved"],
    translated: "Rezolvat",
    statuspage: "resolved",
  },
];

const IMPACT_RULES = [
  {
    key: "major_outage",
    keywords: [
      "major outage",
      "service unavailable",
      "site unavailable",
      "full outage",
      "down",
      "offline",
      "unavailable",
      "cannot access",
      "can't access",
      "failed",
      "failure",
      "outage",
      "critical",
    ],
    impactOverride: "critical",
    componentStatus: "major_outage",
  },
  {
    key: "partial_outage",
    keywords: [
      "partial outage",
      "partial disruption",
      "partial service disruption",
      "some users",
      "subset of users",
      "certain users",
      "limited availability",
      "reduced availability",
      "experiencing issues",
    ],
    impactOverride: "major",
    componentStatus: "partial_outage",
  },
  {
    key: "degraded_performance",
    keywords: [
      "degraded performance",
      "degraded",
      "latency",
      "high latency",
      "increased latency",
      "intermittent",
      "slow",
      "slowness",
      "warning",
      "connectivity issues",
      "error rates",
      "maintenance",
      "scheduled maintenance",
      "under maintenance",
      "maintenance window",
      "flapping",
    ],
    impactOverride: "minor",
    componentStatus: "degraded_performance",
  },
  {
    key: "operational",
    keywords: [
      "resolved",
      "restored",
      "stable",
      "operational",
      "completed",
      "maintenance completed",
      "issue resolved",
      "all systems operational",
    ],
    impactOverride: "none",
    componentStatus: "operational",
  },
];

const PHRASE_TRANSLATIONS = [
  ["scheduled maintenance completed", "mentenanta programata a fost finalizata"],
  ["maintenance completed", "mentenanta a fost finalizata"],
  ["maintenance in progress", "mentenanta este in curs"],
  ["scheduled maintenance", "mentenanta programata"],
  ["planned maintenance", "mentenanta programata"],
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
  ["in progress", "in curs"],
  ["scheduled", "programat"],
  ["completed", "finalizat"],
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
  scheduled: "programata",
  planned: "planificata",
  completed: "finalizata",
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

function getConfiguredSources(env) {
  const sources = [];

  if (readBoolean(env?.ENABLE_20I_SOURCE, true)) {
    sources.push({
      id: "20i",
      name: normalizeWhitespace(env?.SOURCE_20I_NAME || "20i"),
      type: "rss",
      rssUrl: normalizeWhitespace(env?.RSS_URL || DEFAULT_RSS_URL),
      rssFallbackUrl: normalizeWhitespace(env?.RSS_FALLBACK_URL || DEFAULT_RSS_FALLBACK_URL),
      sourceUrl: "https://www.stackstatus.com",
      publicStatusUrl: normalizeWhitespace(env?.PUBLIC_STATUS_URL || ""),
      hideSourceLinks: readBoolean(env?.HIDE_SOURCE_LINKS, DEFAULT_HIDE_SOURCE_LINKS),
      componentIdsRaw: normalizeWhitespace(env?.STATUSPAGE_COMPONENT_IDS || env?.INSTATUS_COMPONENT_IDS || ""),
      componentStatusUpdatesEnabled: readBoolean(
        typeof env?.STATUSPAGE_COMPONENT_UPDATES_ENABLED === "string"
          ? env.STATUSPAGE_COMPONENT_UPDATES_ENABLED
          : env?.INSTATUS_COMPONENT_UPDATES_ENABLED,
        DEFAULT_COMPONENT_STATUS_UPDATES_ENABLED,
      ),
    });
  }

  if (normalizeWhitespace(env?.UPMIND_STATUS_PAGE_ID || "")) {
    sources.push({
      id: "upmind",
      name: normalizeWhitespace(env?.UPMIND_SOURCE_NAME || "Upmind"),
      type: "oneuptime",
      statusPageId: normalizeWhitespace(env?.UPMIND_STATUS_PAGE_ID || ""),
      apiBaseUrl: normalizeWhitespace(env?.UPMIND_API_BASE_URL || DEFAULT_ONEUPTIME_API_BASE_URL),
      sourceUrl: normalizeWhitespace(env?.UPMIND_SOURCE_URL || "https://status.upmind.com"),
      publicStatusUrl: normalizeWhitespace(env?.UPMIND_PUBLIC_STATUS_URL || env?.PUBLIC_STATUS_URL || ""),
      hideSourceLinks: readBoolean(
        typeof env?.UPMIND_HIDE_SOURCE_LINKS === "string" ? env.UPMIND_HIDE_SOURCE_LINKS : env?.HIDE_SOURCE_LINKS,
        DEFAULT_HIDE_SOURCE_LINKS,
      ),
      componentIdsRaw: normalizeWhitespace(env?.UPMIND_COMPONENT_IDS || ""),
      componentStatusUpdatesEnabled: readBoolean(
        env?.UPMIND_COMPONENT_UPDATES_ENABLED,
        DEFAULT_COMPONENT_STATUS_UPDATES_ENABLED,
      ),
    });
  }

  return sources.filter((source) => {
    if (source.type === "rss") {
      return Boolean(source.rssUrl);
    }

    if (source.type === "oneuptime") {
      return Boolean(source.statusPageId);
    }

    return false;
  });
}

function getStatuspageConfig(env) {
  return {
    apiBaseUrl: normalizeWhitespace(
      env?.STATUSPAGE_API_BASE_URL || env?.INSTATUS_API_BASE_URL || DEFAULT_STATUSPAGE_API_BASE_URL,
    ).replace(/\/+$/, ""),
    apiKey: normalizeWhitespace(env?.STATUSPAGE_API_KEY || env?.INSTATUS_API_KEY || ""),
    pageId: normalizeWhitespace(env?.STATUSPAGE_PAGE_ID || env?.INSTATUS_PAGE_ID || ""),
    deliverNotifications: readBoolean(
      typeof env?.STATUSPAGE_DELIVER_NOTIFICATIONS === "string"
        ? env.STATUSPAGE_DELIVER_NOTIFICATIONS
        : env?.INSTATUS_NOTIFY,
      false,
    ),
  };
}

function hasStatuspageCredentials(env) {
  const config = getStatuspageConfig(env);
  return Boolean(config.apiKey && config.pageId);
}

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
  const isDiagnosticRequest = requestUrl.searchParams.get("diagnostic") === "1";
  const isClassificationRequest = requestUrl.searchParams.get("classify") === "1";
  const allowManualSync = Boolean(
    isManualSync &&
      env.MANUAL_SYNC_TOKEN &&
      providedToken &&
      providedToken === env.MANUAL_SYNC_TOKEN,
  );

  if (allowManualSync && isClassificationRequest) {
    const result = await processClassificationPreview(env, {
      requestedStatus: requestUrl.searchParams.get("status") || requestUrl.searchParams.get("status_hint") || "",
      title: requestUrl.searchParams.get("title") || "",
      description: requestUrl.searchParams.get("message") || requestUrl.searchParams.get("description") || "",
      sourceName: requestUrl.searchParams.get("source") || requestUrl.searchParams.get("source_name") || "",
      sectionType: requestUrl.searchParams.get("section") || requestUrl.searchParams.get("section_type") || "",
      sectionDateLabel: requestUrl.searchParams.get("section_date") || "",
      pubDate: requestUrl.searchParams.get("pub_date") || "",
    });

    return jsonResponse(result.payload, result.httpStatus);
  }

  if (allowManualSync && isDiagnosticRequest) {
    const result = await processDiagnosticIncident(env, {
      requestedStatus: requestUrl.searchParams.get("status") || "",
      title: requestUrl.searchParams.get("title") || "",
      description: requestUrl.searchParams.get("message") || requestUrl.searchParams.get("description") || "",
    });

    return jsonResponse(
      {
        status: result.status,
        incident: result.incident,
      },
      result.httpStatus,
    );
  }

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

async function processClassificationPreview(env, options = {}) {
  const rawTitle = normalizeWhitespace(options.title || "");
  const rawDescription = normalizeWhitespace(options.description || "");
  if (!rawTitle && !rawDescription) {
    return {
      httpStatus: 400,
      payload: {
        status: "Trimite macar title sau description pentru clasificare.",
        incident: null,
        classification: null,
      },
    };
  }

  const statusHint = parseDiagnosticStatus(options.requestedStatus);
  const source = {
    id: "classification-preview",
    name: normalizeWhitespace(options.sourceName || "Classification Preview"),
    type: "manual",
    sourceUrl: normalizeWhitespace(env?.PUBLIC_STATUS_URL || ""),
    publicStatusUrl: normalizeWhitespace(env?.PUBLIC_STATUS_URL || ""),
    hideSourceLinks: true,
    componentIdsRaw: "",
    componentStatusUpdatesEnabled: false,
  };
  const entry = {
    sourceKey: "",
    entryId: `classification-preview:${Date.now()}`,
    title: rawTitle || "Untitled classification preview",
    description: rawDescription || rawTitle,
    pubDate: normalizeWhitespace(options.pubDate || "") || new Date().toISOString(),
    link: normalizeWhitespace(env?.PUBLIC_STATUS_URL || ""),
    sectionType: normalizeWhitespace(options.sectionType || ""),
    sectionDateLabel: normalizeWhitespace(options.sectionDateLabel || ""),
  };
  const sourceIncident = await buildSourceIncident(entry, env, source);

  if (statusHint?.statuspage && !sourceIncident.status?.statuspage) {
    sourceIncident.status = statusHint;
  }

  return {
    httpStatus: 200,
    payload: {
      status: "Clasificare generata.",
      incident: sourceIncident.publicIncident,
      classification: {
        lifecycle_status: normalizeWhitespace(sourceIncident?.status?.statuspage || "") || null,
        lifecycle_label: normalizeWhitespace(sourceIncident?.status?.translated || "") || null,
        impact: normalizeWhitespace(sourceIncident?.impact?.key || "") || "unknown",
        impact_override: normalizeWhitespace(sourceIncident?.impact?.impactOverride || "") || null,
        component_status: normalizeWhitespace(sourceIncident?.impact?.componentStatus || "") || null,
        reason: normalizeWhitespace(sourceIncident?.impact?.reason || sourceIncident?.maintenance?.reason || "") || null,
        confidence:
          Number.isFinite(Number.parseFloat(sourceIncident?.impact?.confidence))
            ? Number(Number.parseFloat(sourceIncident.impact.confidence).toFixed(3))
            : null,
        is_maintenance: Boolean(sourceIncident?.maintenance?.isMaintenance),
        maintenance_status: normalizeWhitespace(sourceIncident?.maintenance?.statuspageStatus || "") || null,
        scheduled_for: normalizeIsoDateTime(sourceIncident?.maintenance?.scheduledFor || "") || null,
        scheduled_until: normalizeIsoDateTime(sourceIncident?.maintenance?.scheduledUntil || "") || null,
      },
      raw: {
        title: rawTitle || null,
        description: rawDescription || null,
        source: source.name,
        section_type: entry.sectionType || null,
      },
    },
  };
}

async function processDiagnosticIncident(env, options = {}) {
  if (!env || !env.STATUS_KV || typeof env.STATUS_KV.get !== "function" || typeof env.STATUS_KV.put !== "function") {
    return buildResult("Binding-ul STATUS_KV nu este configurat.", null, 500);
  }

  if (!hasStatuspageCredentials(env)) {
    return buildResult(
      "Configuratia Statuspage lipseste. Seteaza STATUSPAGE_API_KEY si STATUSPAGE_PAGE_ID.",
      null,
      500,
    );
  }

  const diagnosticStatus = parseDiagnosticStatus(options.requestedStatus);
  if (!diagnosticStatus) {
    return buildResult(
      "Statusul de diagnostic este invalid. Foloseste: investigating, identified, monitoring sau resolved.",
      null,
      400,
    );
  }

  const source = {
    id: "diagnostic",
    name: "Diagnostic",
    type: "manual",
    sourceUrl: normalizeWhitespace(env?.PUBLIC_STATUS_URL || ""),
    publicStatusUrl: normalizeWhitespace(env?.PUBLIC_STATUS_URL || ""),
    hideSourceLinks: true,
    componentIdsRaw: normalizeWhitespace(env?.STATUSPAGE_COMPONENT_IDS || env?.INSTATUS_COMPONENT_IDS || ""),
    componentStatusUpdatesEnabled: readBoolean(
      typeof env?.STATUSPAGE_COMPONENT_UPDATES_ENABLED === "string"
        ? env.STATUSPAGE_COMPONENT_UPDATES_ENABLED
        : env?.INSTATUS_COMPONENT_UPDATES_ENABLED,
      DEFAULT_COMPONENT_STATUS_UPDATES_ENABLED,
    ),
  };
  const rawTitle = normalizeWhitespace(options.title || "") || "Diagnostic banner test";
  const entry = {
    sourceKey: "diagnostic-banner-test",
    entryId: `diagnostic:${diagnosticStatus.statuspage}:${Date.now()}`,
    title: formatStatusPrefixedTitle(diagnosticStatus, rawTitle),
    description:
      normalizeWhitespace(options.description || "") ||
      buildDiagnosticDescription(diagnosticStatus),
    pubDate: new Date().toISOString(),
    link: normalizeWhitespace(env?.PUBLIC_STATUS_URL || ""),
  };
  const sourceIncident = await buildSourceIncident(entry, env, source);
  const existingState = await readIncidentState(env, source, sourceIncident.sourceKey);

  if (diagnosticStatus.key === "resolved" && !getStoredIncidentId(existingState)) {
    return buildResult(
      "Nu exista un incident de diagnostic activ. Ruleaza mai intai un test cu investigating, identified sau monitoring.",
      sourceIncident.publicIncident,
      409,
    );
  }

  const action =
    getStoredIncidentId(existingState) && !isResolvedIncidentStatus(existingState.currentStatus) ? "update" : "create";
  const syncResult =
    action === "create"
      ? await createStatuspageIncident(env, sourceIncident)
      : await updateExistingStatuspageIncident(env, existingState, sourceIncident);

  if (!syncResult.ok) {
    return buildResult(syncResult.message || "Testul de diagnostic a esuat.", sourceIncident.publicIncident, 502);
  }

  await writeIncidentState(env, source, sourceIncident, syncResult.incidentId);
  await writeFeedCursor(env, source, sourceIncident);
  await writeLastIncident(env, source, sourceIncident);

  return buildResult(
    diagnosticStatus.key === "resolved"
      ? "Incidentul de diagnostic a fost marcat ca rezolvat."
      : `Incidentul de diagnostic a fost ${action === "create" ? "creat" : "actualizat"} cu statusul ${diagnosticStatus.translated}.`,
    sourceIncident.publicIncident,
    200,
  );
}

async function processLatestIncident(env, context = {}) {
  try {
    if (!env || !env.STATUS_KV || typeof env.STATUS_KV.get !== "function" || typeof env.STATUS_KV.put !== "function") {
      return buildResult("Binding-ul STATUS_KV nu este configurat.", null, 500);
    }
    const sources = getConfiguredSources(env);
    if (!sources.length) {
      return buildResult("Nu exista surse externe configurate.", null, 500);
    }

    let primaryIncident = null;
    let primaryIncidentPriority = -1;
    let primaryIncidentTimestamp = -1;
    const sourceMessages = [];
    let successfulSourceCount = 0;
    let firstFailure = null;

    for (const source of sources) {
      const sourceResult = await processSource(source, env, context);

      const shouldPromoteIncident =
        sourceResult.incident &&
        (
          sourceResult.priority > primaryIncidentPriority ||
          (
            sourceResult.priority === primaryIncidentPriority &&
            sourceResult.incidentTimestamp > primaryIncidentTimestamp
          )
        );

      if (shouldPromoteIncident) {
        primaryIncident = sourceResult.incident;
        primaryIncidentPriority = sourceResult.priority;
        primaryIncidentTimestamp = sourceResult.incidentTimestamp;
      }

      sourceMessages.push(prefixSourceStatus(source, sourceResult.status));

      if (sourceResult.ok) {
        successfulSourceCount += 1;
      } else if (!firstFailure) {
        firstFailure = sourceResult;
      }
    }

    const summary = buildPublicStatusSummary(sourceMessages);
    if (firstFailure && !successfulSourceCount) {
      return buildResult(summary, firstFailure.incident || primaryIncident, firstFailure.httpStatus);
    }

    return buildResult(summary, primaryIncident || firstFailure?.incident || null, 200);
  } catch (error) {
    console.error("Eroare procesare:", sanitizeError(error));
    return buildResult("A aparut o eroare la procesarea incidentului.", null, 500);
  }
}

function prefixSourceStatus(source, message) {
  const sourceName = normalizeWhitespace(source?.name || "");
  const normalizedMessage = normalizeWhitespace(message || "");
  if (!sourceName) {
    return normalizedMessage;
  }

  if (!normalizedMessage) {
    return `${sourceName}: status indisponibil.`;
  }

  const normalizedPrefix = `${sourceName.toLowerCase()}:`;
  if (normalizedMessage.toLowerCase().startsWith(normalizedPrefix)) {
    return normalizedMessage;
  }

  return `${sourceName}: ${normalizedMessage}`;
}

function buildPublicStatusSummary(messages) {
  const normalized = messages
    .map((message) => normalizeWhitespace(message))
    .filter(Boolean);

  if (!normalized.length) {
    return "Nu exista actualizari noi.";
  }

  const uniqueMessages = [...new Set(normalized)];
  const meaningfulMessages = uniqueMessages.filter((message) => message !== "Nu exista actualizari noi.");

  if (meaningfulMessages.length === 1) {
    return meaningfulMessages[0];
  }

  if (meaningfulMessages.length > 1) {
    return meaningfulMessages.join(" | ");
  }

  return uniqueMessages[0];
}

async function processSource(source, env, context = {}) {
  const sourceResult = await fetchSourceEntries(source, env);
  if (!sourceResult.ok) {
    return {
      ok: false,
      status: sourceResult.message ?? `Preluarea sursei ${source.name} a esuat.`,
      incident: null,
      httpStatus: 502,
      priority: 0,
      incidentTimestamp: -1,
    };
  }

  let incidents = sourceResult.incidents;
  if (!incidents.length && source.type === "oneuptime") {
    const syntheticResolvedIncidents = await buildSyntheticResolvedIncidentsForSource(source, env);
    if (syntheticResolvedIncidents.length) {
      incidents = syntheticResolvedIncidents;
    }
  }

  if (!incidents.length) {
    return {
      ok: true,
      status: "Nu exista actualizari noi.",
      incident: null,
      httpStatus: 200,
      priority: 0,
      incidentTimestamp: -1,
    };
  }

  const latestIncident = incidents[0];
  const translatedIncident = await buildPublicIncident(latestIncident, env, source);
  const latestIncidentTimestamp = getIncidentTimestamp(latestIncident.pubDate);
  const cursor = await readFeedCursor(env, source);
  const pendingEntries = getPendingFeedEntries(incidents, cursor);

  if (!pendingEntries.length) {
    return {
      ok: true,
      status: "Nu exista actualizari noi.",
      incident: translatedIncident,
      httpStatus: 200,
      priority: 1,
      incidentTimestamp: latestIncidentTimestamp,
    };
  }

  if (!context.allowPublish) {
    return {
      ok: true,
      status:
        pendingEntries.length === 1
          ? "Exista o actualizare noua, dar publicarea ruleaza doar prin cron sau trigger manual autorizat."
          : `Exista ${pendingEntries.length} actualizari noi, dar publicarea ruleaza doar prin cron sau trigger manual autorizat.`,
      incident: translatedIncident,
      httpStatus: 200,
      priority: 2,
      incidentTimestamp: latestIncidentTimestamp,
    };
  }

  if (!hasStatuspageCredentials(env)) {
    return {
      ok: false,
      status: "Configuratia Statuspage lipseste. Seteaza STATUSPAGE_API_KEY si STATUSPAGE_PAGE_ID.",
      incident: translatedIncident,
      httpStatus: 500,
      priority: 2,
      incidentTimestamp: latestIncidentTimestamp,
    };
  }

  const backoffCheck = await readStatuspageBackoff(env);
  if (backoffCheck.active) {
    return {
      ok: true,
      status: `Statuspage limiteaza temporar cererile. Urmatoarea incercare dupa ${backoffCheck.untilFormatted}.`,
      incident: translatedIncident,
      httpStatus: 200,
      priority: 2,
      incidentTimestamp: latestIncidentTimestamp,
    };
  }

  const syncResult = await syncPendingFeedEntries(env, source, pendingEntries);
  if (!syncResult.ok) {
    if (isStatuspageRateLimitedStatus(syncResult.statusCode)) {
      const retryAfterSeconds = syncResult.retryAfterSeconds || DEFAULT_STATUSPAGE_RETRY_AFTER_SECONDS;
      await writeStatuspageBackoff(env, retryAfterSeconds);
    }

    return {
      ok: false,
      status: syncResult.message ?? "Sincronizarea catre Statuspage a esuat.",
      incident: syncResult.incident || translatedIncident,
      httpStatus: isStatuspageRateLimitedStatus(syncResult.statusCode) ? 429 : 502,
      priority: 2,
      incidentTimestamp: latestIncidentTimestamp,
    };
  }

  await clearStatuspageBackoff(env);

  return {
    ok: true,
    status: syncResult.message,
    incident: syncResult.incident || translatedIncident,
    httpStatus: 200,
    priority: 2,
    incidentTimestamp: latestIncidentTimestamp,
  };
}

async function fetchSourceEntries(source, env) {
  if (source.type === "rss") {
    const rssResult = await fetchRSS(env, source);
    if (!rssResult.ok) {
      return {
        ok: false,
        message: rssResult.message,
        incidents: [],
      };
    }

    let incidents = parseRSS(rssResult.xml);
    if (is20iRssSource(source)) {
      const pageResult = await fetchStackStatusPage(env, source);
      if (pageResult.ok) {
        incidents = mergeSourceEntries(incidents, parseStackStatusPage(pageResult.html));
      }
    }

    return {
      ok: true,
      incidents,
    };
  }

  if (source.type === "oneuptime") {
    return fetchOneUptimeEntries(source, env);
  }

  return {
    ok: false,
    message: `Tipul de sursa ${source.type || "necunoscut"} nu este suportat.`,
    incidents: [],
  };
}

async function fetchOneUptimeEntries(source, env) {
  const apiBaseUrl = normalizeWhitespace(source?.apiBaseUrl || DEFAULT_ONEUPTIME_API_BASE_URL).replace(/\/+$/, "");
  const statusPageId = normalizeWhitespace(source?.statusPageId || "");
  if (!apiBaseUrl || !statusPageId) {
    return {
      ok: false,
      message: `Configuratia OneUptime lipseste pentru sursa ${source?.name || "necunoscuta"}.`,
      incidents: [],
    };
  }

  const url = `${apiBaseUrl}/status-page-api/overview/${encodeURIComponent(statusPageId)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("timeout"), getFetchTimeout(env));

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        message: `Preluarea OneUptime a esuat cu codul ${response.status}.`,
        incidents: [],
      };
    }

    const payload = await response.json();
    return {
      ok: true,
      incidents: parseOneUptimeOverview(payload, source),
    };
  } catch (error) {
    return {
      ok: false,
      message: isAbortError(error)
        ? `Preluarea OneUptime pentru ${source?.name || "sursa necunoscuta"} a expirat.`
        : `Preluarea OneUptime pentru ${source?.name || "sursa necunoscuta"} a esuat.`,
      incidents: [],
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseOneUptimeOverview(payload, source) {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const overview =
    (payload.data && typeof payload.data === "object" ? payload.data : null) ||
    (payload.statusPage && typeof payload.statusPage === "object" ? payload.statusPage : null) ||
    payload;
  const activeIncidents = pickFirstArray(
    overview.activeIncidents,
    payload.activeIncidents,
    overview.incidents,
    payload.incidents,
  );
  const incidentNotes = pickFirstArray(
    overview.incidentPublicNotes,
    payload.incidentPublicNotes,
    overview.publicNotes,
    payload.publicNotes,
  );
  const incidentIndex = new Map();
  const noteCountByIncidentId = new Map();
  const entries = [];

  for (const note of incidentNotes) {
    const incidentId = extractOneUptimeIncidentId(note);
    if (incidentId) {
      noteCountByIncidentId.set(incidentId, (noteCountByIncidentId.get(incidentId) || 0) + 1);
    }
  }

  for (const incident of activeIncidents) {
    const incidentId = extractOneUptimeEntityId(incident);
    if (incidentId) {
      incidentIndex.set(incidentId, incident);
    }

    if (!incidentId || !noteCountByIncidentId.get(incidentId)) {
      entries.push(buildOneUptimeIncidentEntry(incident, source));
    }
  }

  for (const note of incidentNotes) {
    entries.push(buildOneUptimeNoteEntry(note, incidentIndex.get(extractOneUptimeIncidentId(note)), source));
  }

  if (!entries.length) {
    entries.push(...extractOneUptimeDegradedResourceEntries(overview, payload, source));
  }

  return entries
    .filter((entry) => entry && (entry.entryId || entry.title || entry.description))
    .sort((left, right) => {
      const leftTime = Date.parse(left.pubDate || "") || 0;
      const rightTime = Date.parse(right.pubDate || "") || 0;
      return rightTime - leftTime;
    });
}

function buildOneUptimeIncidentEntry(incident, source) {
  const incidentId = extractOneUptimeEntityId(incident);
  const incidentDate = extractOneUptimeDate(incident, ["updatedAt", "createdAt", "declaredAt", "startsAt"]);
  const titleBase =
    extractOneUptimeText(incident, [
      "title",
      "name",
      "incidentNumber",
      "slug",
      "description",
    ]) || `Incident ${source?.name || "extern"}`;
  const stateText = extractOneUptimeText(incident, [
    "currentIncidentState.name",
    "currentIncidentState.slug",
    "currentIncidentState.title",
  ]);
  const description =
    extractOneUptimeText(incident, ["description", "message", "title"]) ||
    `Sursa ${source?.name || "externa"} raporteaza un incident activ.`;
  const status = inferOneUptimeStatus(
    titleBase,
    `${stateText} ${description}`.trim(),
    true,
  );

  return {
    sourceKey: incidentId || buildSourceIncidentKey(titleBase, status),
    entryId: incidentId ? `${incidentId}:${incidentDate || "current"}` : buildSyntheticEntryId({
      title: titleBase,
      pubDate: incidentDate,
      link: source?.sourceUrl || "",
    }),
    title: formatStatusPrefixedTitle(status, titleBase),
    description,
    pubDate: incidentDate || new Date().toISOString(),
    link: normalizeWhitespace(source?.sourceUrl || ""),
  };
}

function buildOneUptimeNoteEntry(note, parentIncident, source) {
  const titleBase =
    extractOneUptimeText(parentIncident, ["title", "name", "incidentNumber", "slug"]) ||
    extractMarkdownHeading(extractOneUptimeText(note, ["note"])) ||
    `Incident ${source?.name || "extern"}`;
  const noteBody =
    extractOneUptimeText(note, ["note", "message", "description"]) ||
    extractOneUptimeText(parentIncident, ["description", "message"]) ||
    `Sursa ${source?.name || "externa"} a publicat o actualizare.`;
  const stateText = [
    extractOneUptimeText(note, ["state.name", "state.slug", "status", "status.name"]),
    extractOneUptimeText(parentIncident, ["currentIncidentState.name", "currentIncidentState.slug"]),
  ]
    .filter(Boolean)
    .join(" ");
  const status = inferOneUptimeStatus(titleBase, `${stateText} ${noteBody}`.trim(), Boolean(parentIncident));
  const incidentSourceKey =
    extractOneUptimeIncidentId(note) ||
    extractOneUptimeEntityId(parentIncident) ||
    buildSourceIncidentKey(titleBase, status);

  return {
    sourceKey: incidentSourceKey,
    entryId: extractOneUptimeEntityId(note) || buildSyntheticEntryId({
      title: titleBase,
      pubDate: extractOneUptimeDate(note, ["postedAt", "updatedAt", "createdAt"]),
      link: source?.sourceUrl || "",
    }),
    title: formatStatusPrefixedTitle(status, titleBase),
    description: noteBody,
    pubDate: extractOneUptimeDate(note, ["postedAt", "updatedAt", "createdAt"]) || new Date().toISOString(),
    link: normalizeWhitespace(source?.sourceUrl || ""),
  };
}

function extractOneUptimeDegradedResourceEntries(overview, payload, source) {
  const resources = [];
  const directCollections = [
    overview?.statusPageResources,
    payload?.statusPageResources,
    overview?.resources,
    payload?.resources,
    overview?.monitors,
    payload?.monitors,
    overview?.services,
    payload?.services,
    overview?.components,
    payload?.components,
  ];

  for (const collection of directCollections) {
    if (Array.isArray(collection)) {
      resources.push(...collection);
    }
  }

  const groupedCollections = [
    overview?.statusPageGroups,
    payload?.statusPageGroups,
    overview?.groups,
    payload?.groups,
    overview?.resourceGroups,
    payload?.resourceGroups,
    overview?.monitorGroups,
    payload?.monitorGroups,
  ];

  for (const groups of groupedCollections) {
    if (!Array.isArray(groups)) {
      continue;
    }

    for (const group of groups) {
      resources.push(...extractOneUptimeResourcesFromGroup(group));
    }
  }

  const deduped = [];
  const seenKeys = new Set();

  for (const resource of resources) {
    if (!resource || typeof resource !== "object") {
      continue;
    }

    const identity =
      extractOneUptimeEntityId(resource) ||
      extractOneUptimeText(resource, ["monitorId", "resourceId", "componentId", "serviceId"]) ||
      extractOneUptimeText(resource, ["name", "title", "displayName", "label"]);
    const normalizedIdentity = normalizeWhitespace(identity || "").toLowerCase();
    if (normalizedIdentity && seenKeys.has(normalizedIdentity)) {
      continue;
    }

    const entry = buildOneUptimeResourceEntry(resource, source);
    if (!entry) {
      continue;
    }

    if (normalizedIdentity) {
      seenKeys.add(normalizedIdentity);
    }

    deduped.push(entry);
  }

  return deduped;
}

function extractOneUptimeResourcesFromGroup(group) {
  if (!group || typeof group !== "object") {
    return [];
  }

  const resources = [];
  const collections = [
    group.statusPageResources,
    group.resources,
    group.monitors,
    group.services,
    group.components,
    group.children,
    group.items,
  ];

  for (const collection of collections) {
    if (Array.isArray(collection)) {
      resources.push(...collection);
    }
  }

  return resources;
}

function buildOneUptimeResourceEntry(resource, source) {
  const statusText = [
    extractOneUptimeText(resource, [
      "currentStatus.name",
      "currentStatus.slug",
      "currentStatus.title",
      "status.name",
      "status.slug",
      "status.title",
      "status",
      "currentMonitorStatus.name",
      "currentMonitorStatus.slug",
      "currentMonitorStatus.title",
      "state.name",
      "state.slug",
      "state.title",
    ]),
    extractOneUptimeText(resource, ["description", "message"]),
  ]
    .filter(Boolean)
    .join(" ");
  const status = inferOneUptimeResourceStatus(statusText);
  if (!status?.statuspage) {
    return null;
  }

  const titleBase =
    extractOneUptimeText(resource, [
      "name",
      "title",
      "displayName",
      "label",
      "monitor.name",
      "resource.name",
      "service.name",
      "component.name",
      "description",
    ]) || `Componenta ${source?.name || "externa"}`;
  const rawStatusLabel =
    extractOneUptimeText(resource, [
      "currentStatus.name",
      "currentStatus.slug",
      "currentStatus.title",
      "status.name",
      "status.slug",
      "status.title",
      "status",
      "currentMonitorStatus.name",
      "currentMonitorStatus.slug",
      "currentMonitorStatus.title",
      "state.name",
      "state.slug",
      "state.title",
    ]) || getEnglishStatusLabel(status);
  const description =
    extractOneUptimeText(resource, ["description", "message"]) ||
    `${titleBase} raporteaza statusul ${rawStatusLabel}.`;
  const entityId =
    extractOneUptimeEntityId(resource) ||
    extractOneUptimeText(resource, ["monitorId", "resourceId", "componentId", "serviceId"]);
  const resourceDate = extractOneUptimeDate(resource, [
    "updatedAt",
    "lastCheckedAt",
    "lastCheckAt",
    "checkedAt",
    "createdAt",
  ]);

  return {
    sourceKey: entityId || buildSourceIncidentKey(titleBase, status),
    entryId: `${entityId || buildSourceIncidentKey(titleBase, status)}:${status.statuspage}:${resourceDate || "current"}`,
    title: formatStatusPrefixedTitle(status, titleBase),
    description,
    pubDate: resourceDate || new Date().toISOString(),
    link: normalizeWhitespace(source?.sourceUrl || ""),
  };
}

function inferOneUptimeResourceStatus(text) {
  const normalized = normalizeWhitespace(text || "").toLowerCase();
  if (!normalized) {
    return null;
  }

  if (/\b(operational|online|healthy|up|available|running|ok)\b/.test(normalized)) {
    return null;
  }

  if (/\b(major outage|outage|down|offline|unavailable|critical|failed|failure)\b/.test(normalized)) {
    return getStatusRule("investigating");
  }

  if (/\b(identified|mitigated|acknowledged)\b/.test(normalized)) {
    return getStatusRule("identified");
  }

  if (/\b(monitoring|degraded|degradation|partial outage|partial|warning|maintenance|slow|latency|performance)\b/.test(normalized)) {
    return getStatusRule("monitoring");
  }

  return null;
}

async function buildSyntheticResolvedIncidentsForSource(source, env) {
  const currentIncidents = await readCurrentIncidentsForSource(env, source);
  if (!currentIncidents.length) {
    return [];
  }

  return currentIncidents
    .filter((item) => item?.sourceKey && item.currentStatus && !isResolvedIncidentStatus(item.currentStatus))
    .map((item) => {
      const baseTitle = buildResolvedBaseTitle(item.lastTitle, item.sourceKey);
      return {
        sourceKey: item.sourceKey || buildSourceIncidentKey(baseTitle, getStatusRule("resolved")),
        entryId: `resolved:${source.id}:${item.sourceKey}:${item.lastFeedEntryId || item.updatedAt || Date.now()}`,
        title: `Resolved - ${baseTitle}`,
        description: `${source.name} nu mai raporteaza incidente active. Incidentul anterior este tratat ca rezolvat automat.`,
        pubDate: new Date().toISOString(),
        link: normalizeWhitespace(source.publicStatusUrl || source.sourceUrl || ""),
      };
    });
}

async function syncPendingFeedEntries(env, source, entries) {
  let latestPublicIncident = null;
  let createdCount = 0;
  let updatedCount = 0;
  let resolvedCount = 0;
  let skippedCount = 0;

  for (const entry of entries) {
    const sourceIncident = await buildSourceIncident(entry, env, source);
    latestPublicIncident = sourceIncident.publicIncident;
    const existingState = await readIncidentState(env, source, sourceIncident.sourceKey);
    const normalizedTitle = normalizeWhitespace(sourceIncident.rawTitle || "").toLowerCase();

    if (!sourceIncident.status.statuspage && is20iRssSource(source) && isGenericRssUpdateTitle(normalizedTitle)) {
      const inheritedStatus = getStatusRuleByStatuspageValue(existingState?.currentStatus);
      if (inheritedStatus) {
        sourceIncident.status = inheritedStatus;
      }
    }

    sourceIncident.maintenance = mergeMaintenanceState(sourceIncident.maintenance, getStoredMaintenance(existingState));
    if (hasMaintenanceLifecycle(sourceIncident.maintenance)) {
      sourceIncident.status =
        getStatusRuleByStatuspageValue(sourceIncident.maintenance.statuspageStatus) || sourceIncident.status;
    }

    if (!hasKnownImpact(sourceIncident.impact)) {
      const inheritedImpact = getStoredImpact(existingState);
      if (hasKnownImpact(inheritedImpact)) {
        sourceIncident.impact = inheritedImpact;
      }
    }

    if (!sourceIncident.status.statuspage) {
      await writeFeedCursor(env, source, sourceIncident);
      skippedCount += 1;
      continue;
    }
    const action = determineStatuspageAction(existingState, sourceIncident);

    if (action === "skip") {
      await writeFeedCursor(env, source, sourceIncident);
      skippedCount += 1;
      continue;
    }

    let syncResult;
    if (action === "create") {
      syncResult = await createStatuspageIncident(env, sourceIncident);
    } else {
      syncResult = await updateExistingStatuspageIncident(env, existingState, sourceIncident);
    }

    if (!syncResult.ok) {
      return {
        ...syncResult,
        incident: latestPublicIncident,
      };
    }

    await writeIncidentState(env, source, sourceIncident, syncResult.incidentId);
    await writeFeedCursor(env, source, sourceIncident);
    await writeLastIncident(env, source, sourceIncident);

    if (action === "create") {
      createdCount += 1;
    } else if (isResolvedIncidentStatus(sourceIncident.maintenance?.statuspageStatus || sourceIncident.status.statuspage)) {
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

async function buildSourceIncident(entry, env, source) {
  const initialStatus = mapSourceStatus(entry, source);
  const sourceKey = buildEntrySourceKey(entry, source, initialStatus);
  const semantics = await classifyIncidentSemantics(entry, env, source, initialStatus);
  const status = semantics.status || initialStatus;
  const publicIncident = await buildPublicIncident(entry, env, source, status);

  return {
    source,
    entryId: entry.entryId || buildSyntheticEntryId(entry),
    rawTitle: entry.title || "",
    rawDescription: entry.description || "",
    rawPubDate: entry.pubDate || "",
    rawLink: entry.link || "",
    status,
    sourceKey,
    impact: semantics.impact,
    maintenance: semantics.maintenance,
    publicIncident,
  };
}

function mapSourceStatus(entry, source) {
  const mapped = mapStatus(entry?.title, entry?.description);
  if (mapped?.statuspage) {
    return mapped;
  }

  if (is20iRssSource(source)) {
    return inferRssStatus(entry?.title);
  }

  return mapped;
}

function inferRssStatus(title) {
  const normalized = normalizeWhitespace(title || "").toLowerCase();
  if (!normalized) {
    return getStatusRule("investigating");
  }

  if (isGenericRssUpdateTitle(normalized)) {
    return {
      key: "necunoscut",
      translated: "Actualizare incident",
      statuspage: null,
    };
  }

  if (/\bresolved\b/.test(normalized)) {
    return getStatusRule("resolved");
  }

  // 20i exposes an incident-only RSS feed, so a plain new title means an active incident.
  return getStatusRule("investigating");
}

function isGenericRssUpdateTitle(title) {
  const normalized = normalizeWhitespace(title || "").toLowerCase();
  return /(?:^|[\s\-:|])update\s*$/.test(normalized) && !/\b(resolved|monitoring|identified|investigating)\b/.test(normalized);
}

function is20iRssSource(source) {
  const sourceId = normalizeWhitespace(source?.id || "").toLowerCase();
  const rssUrl = normalizeWhitespace(source?.rssUrl || "").toLowerCase();
  return sourceId === "20i" || rssUrl.includes("stackstatus.com");
}

function buildEntrySourceKey(entry, source, statusHint) {
  const explicit = normalizeWhitespace(entry?.sourceKey || "");
  if (explicit) {
    return explicit;
  }

  const rawTitle = is20iRssSource(source)
    ? normalize20iIncidentKeyTitle(entry?.title)
    : normalizeWhitespace(entry?.title || "");

  return buildSourceIncidentKey(rawTitle, statusHint);
}

function normalize20iIncidentKeyTitle(title) {
  return normalizeWhitespace(title || "")
    .replace(/^\s*(?:resolved|update)\s*[-:|]\s*/i, "")
    .replace(/\s*[-:|]\s*(?:resolved|update)\s*$/i, "")
    .trim();
}

async function buildPublicIncident(entry, env, source, statusHint = null) {
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
  const publicLink = buildPublicIncidentLink(entry, source);

  const incident = {
    title,
    description: sanitizePublicDescription(description, source),
    date: formatDateToRomanian(entry.pubDate, env.TIME_ZONE || DEFAULT_TIME_ZONE),
  };

  if (publicLink) {
    incident.link = publicLink;
  }

  return incident;
}

function getStoredIncidentId(existingState) {
  return normalizeWhitespace(existingState?.statuspageIncidentId || existingState?.instatusIncidentId || "");
}

function normalizeIncidentStatusValue(status) {
  return normalizeWhitespace(String(status || "")).toLowerCase();
}

function isResolvedIncidentStatus(status) {
  return ["resolved", "completed"].includes(normalizeIncidentStatusValue(status));
}

function determineStatuspageAction(existingState, sourceIncident) {
  if (!getStoredIncidentId(existingState)) {
    return "create";
  }

  if (existingState.lastFeedEntryId && existingState.lastFeedEntryId === sourceIncident.entryId) {
    return "skip";
  }

  if (isResolvedIncidentStatus(existingState.currentStatus)) {
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
    return "Nu a fost necesara nicio modificare in Statuspage.";
  }

  return `${parts.join(", ")}.`;
}

async function readFeedCursor(env, source) {
  try {
    const raw = await env.STATUS_KV.get(getFeedCursorKey(source), "json");
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

async function writeFeedCursor(env, source, sourceIncident) {
  try {
    await env.STATUS_KV.put(
      getFeedCursorKey(source),
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

async function readIncidentState(env, source, sourceKey) {
  if (!sourceKey) {
    return null;
  }

  try {
    return await env.STATUS_KV.get(getIncidentStateKey(source, sourceKey), "json");
  } catch (error) {
    console.error("Eroare citire stare incident:", sanitizeError(error));
    return null;
  }
}

async function writeIncidentState(env, source, sourceIncident, statuspageIncidentId) {
  if (!sourceIncident?.sourceKey || !statuspageIncidentId) {
    return;
  }

  const impactConfidence = Number.parseFloat(sourceIncident?.impact?.confidence);
  const storedMaintenance = sourceIncident?.publishedMaintenance || sourceIncident?.maintenance;
  const effectiveStatus =
    normalizeMaintenanceStatus(storedMaintenance?.statuspageStatus) ||
    normalizeIncidentStatusValue(sourceIncident?.publishedStatus || "") ||
    sourceIncident?.status?.statuspage ||
    "";

  const payload = {
    sourceId: source.id,
    sourceName: source.name,
    sourceKey: sourceIncident.sourceKey,
    statuspageIncidentId,
    currentStatus: effectiveStatus,
    lastFeedEntryId: sourceIncident.entryId,
    lastFeedEntryDate: sourceIncident.rawPubDate || "",
    lastTitle: sourceIncident.rawTitle || "",
    currentImpactKey: normalizeImpactKey(sourceIncident?.impact?.key || ""),
    currentImpactOverride: normalizeWhitespace(sourceIncident?.impact?.impactOverride || ""),
    currentComponentStatus: normalizeWhitespace(sourceIncident?.impact?.componentStatus || ""),
    impactMethod: normalizeWhitespace(sourceIncident?.impact?.method || ""),
    impactReason: normalizeWhitespace(sourceIncident?.impact?.reason || ""),
    impactConfidence: Number.isFinite(impactConfidence) ? Number(impactConfidence.toFixed(3)) : null,
    isMaintenance: Boolean(storedMaintenance?.isMaintenance),
    maintenanceStatus: normalizeMaintenanceStatus(storedMaintenance?.statuspageStatus || ""),
    scheduledFor: normalizeIsoDateTime(storedMaintenance?.scheduledFor || ""),
    scheduledUntil: normalizeIsoDateTime(storedMaintenance?.scheduledUntil || ""),
    maintenanceMethod: normalizeWhitespace(storedMaintenance?.method || ""),
    maintenanceReason: normalizeWhitespace(storedMaintenance?.reason || ""),
    updatedAt: new Date().toISOString(),
  };

  try {
    await env.STATUS_KV.put(getIncidentStateKey(source, sourceIncident.sourceKey), JSON.stringify(payload));
    await updateCurrentIncidentsForSource(env, source, payload);
  } catch (error) {
    console.error("Eroare salvare stare incident:", sanitizeError(error));
  }
}

function getFeedCursorKey(source) {
  return `${FEED_CURSOR_KEY}:${source?.id || "default"}`;
}

function getIncidentStateKey(source, sourceKey) {
  return `${INCIDENT_STATE_PREFIX}${source?.id || "default"}:${sourceKey}`;
}

function getSourceCurrentIncidentKey(source) {
  return `${SOURCE_CURRENT_INCIDENT_PREFIX}${source?.id || "default"}`;
}

async function readCurrentIncidentsForSource(env, source) {
  try {
    const raw = await env.STATUS_KV.get(getSourceCurrentIncidentKey(source), "json");
    if (!raw) {
      return [];
    }

    if (Array.isArray(raw)) {
      return raw.filter(Boolean);
    }

    if (typeof raw === "object") {
      return Object.values(raw).filter(Boolean);
    }

    return [];
  } catch (error) {
    console.error("Eroare citire incidente curente pe sursa:", sanitizeError(error));
    return [];
  }
}

async function updateCurrentIncidentsForSource(env, source, incidentState) {
  const index = await readCurrentIncidentIndexForSource(env, source);

  if (isResolvedIncidentStatus(incidentState.currentStatus)) {
    delete index[incidentState.sourceKey];
  } else {
    index[incidentState.sourceKey] = incidentState;
  }

  const values = Object.values(index).filter(Boolean);

  try {
    if (!values.length) {
      if (typeof env.STATUS_KV.delete === "function") {
        await env.STATUS_KV.delete(getSourceCurrentIncidentKey(source));
      }
      return;
    }

    await env.STATUS_KV.put(getSourceCurrentIncidentKey(source), JSON.stringify(index));
  } catch (error) {
    console.error("Eroare actualizare incidente curente pe sursa:", sanitizeError(error));
  }
}

async function readCurrentIncidentIndexForSource(env, source) {
  try {
    const raw = await env.STATUS_KV.get(getSourceCurrentIncidentKey(source), "json");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return {};
    }

    return raw;
  } catch (error) {
    console.error("Eroare citire index incidente curente:", sanitizeError(error));
    return {};
  }
}

async function writeLastIncident(env, source, sourceIncident) {
  if (!sourceIncident?.rawTitle) {
    return;
  }

  const writes = [
    env.STATUS_KV.put(`last_incident:${source?.id || "default"}`, sourceIncident.rawTitle),
  ];

  if (!source?.id || source.id === "20i") {
    writes.push(env.STATUS_KV.put("last_incident", sourceIncident.rawTitle));
  }

  try {
    await Promise.all(writes);
  } catch (error) {
    console.error("Eroare salvare ultim incident:", sanitizeError(error));
  }
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

function buildResolvedBaseTitle(lastTitle, sourceKey) {
  const status = mapStatus(lastTitle, "");
  const derived = buildSourceIncidentKey(lastTitle, status);
  const base = normalizeWhitespace(derived || sourceKey || lastTitle || "Incident");
  return capitalizeRomanianText(base);
}

function getImpactRule(key) {
  const normalized = normalizeImpactKey(key);
  return IMPACT_RULES.find((rule) => rule.key === normalized) || null;
}

function normalizeImpactKey(value) {
  const normalized = normalizeWhitespace(String(value || "")).toLowerCase().replace(/[\s-]+/g, "_");
  if (!normalized) {
    return "";
  }

  const aliasMap = {
    major: "major_outage",
    critical: "major_outage",
    major_outage: "major_outage",
    partial: "partial_outage",
    partial_outage: "partial_outage",
    degraded: "degraded_performance",
    minor: "degraded_performance",
    degraded_performance: "degraded_performance",
    maintenance: "degraded_performance",
    operational: "operational",
    none: "operational",
    resolved: "operational",
    unknown: "unknown",
  };

  return aliasMap[normalized] || "";
}

function buildUnknownImpact(extra = {}) {
  return {
    key: "unknown",
    impactOverride: "",
    componentStatus: "",
    ...extra,
  };
}

function hasKnownImpact(impact) {
  return Boolean(getImpactRule(impact?.key));
}

function buildUnknownMaintenance(extra = {}) {
  return {
    isMaintenance: false,
    statuspageStatus: "",
    scheduledFor: "",
    scheduledUntil: "",
    ...extra,
  };
}

function normalizeMaintenanceStatus(value) {
  const normalized = normalizeWhitespace(String(value || "")).toLowerCase().replace(/[\s-]+/g, "_");
  const aliasMap = {
    scheduled: "scheduled",
    planned: "scheduled",
    planned_maintenance: "scheduled",
    scheduled_maintenance: "scheduled",
    in_progress: "in_progress",
    inprogress: "in_progress",
    underway: "in_progress",
    under_maintenance: "in_progress",
    completed: "completed",
    complete: "completed",
    finished: "completed",
    resolved: "completed",
  };

  return aliasMap[normalized] || "";
}

function hasMaintenanceLifecycle(maintenance) {
  return Boolean(maintenance?.isMaintenance && normalizeMaintenanceStatus(maintenance?.statuspageStatus));
}

function getStoredMaintenance(existingState) {
  const statuspageStatus = normalizeMaintenanceStatus(existingState?.maintenanceStatus || existingState?.currentStatus || "");
  if (!readBoolean(existingState?.isMaintenance, false) && !["scheduled", "in_progress", "completed"].includes(statuspageStatus)) {
    return buildUnknownMaintenance();
  }

  return {
    isMaintenance: true,
    statuspageStatus,
    scheduledFor: normalizeIsoDateTime(existingState?.scheduledFor),
    scheduledUntil: normalizeIsoDateTime(existingState?.scheduledUntil),
    method: normalizeWhitespace(existingState?.maintenanceMethod || "") || "stored",
    reason: normalizeWhitespace(existingState?.maintenanceReason || ""),
  };
}

function mergeMaintenanceState(currentMaintenance, fallbackMaintenance) {
  if (!hasMaintenanceLifecycle(currentMaintenance) && !hasMaintenanceLifecycle(fallbackMaintenance)) {
    return buildUnknownMaintenance();
  }

  const base = hasMaintenanceLifecycle(currentMaintenance) ? currentMaintenance : fallbackMaintenance;
  const fallback = hasMaintenanceLifecycle(fallbackMaintenance) ? fallbackMaintenance : buildUnknownMaintenance();

  return {
    ...base,
    isMaintenance: true,
    statuspageStatus: normalizeMaintenanceStatus(base.statuspageStatus || fallback.statuspageStatus),
    scheduledFor: normalizeIsoDateTime(base.scheduledFor || fallback.scheduledFor),
    scheduledUntil: normalizeIsoDateTime(base.scheduledUntil || fallback.scheduledUntil),
    reason: normalizeWhitespace(base.reason || fallback.reason || ""),
    method: normalizeWhitespace(base.method || fallback.method || ""),
  };
}

function getStoredImpact(existingState) {
  const storedRule = getImpactRule(existingState?.currentImpactKey);
  if (!storedRule) {
    return buildUnknownImpact();
  }

  const confidence = Number.parseFloat(existingState?.impactConfidence);
  return {
    ...storedRule,
    method: normalizeWhitespace(existingState?.impactMethod || "") || "stored",
    reason: normalizeWhitespace(existingState?.impactReason || ""),
    confidence: Number.isFinite(confidence) ? confidence : undefined,
  };
}

function classifyImpactWithRules(title, description, statusHint) {
  if (["resolved", "completed"].includes(normalizeIncidentStatusValue(statusHint?.statuspage))) {
    return {
      ...getImpactRule("operational"),
      method: "status",
      reason: "Statusul incidentului este inchis.",
    };
  }

  const normalized = `${normalizeWhitespace(title || "")} ${prepareTextForTranslation(description, {
    stripHtml: true,
    fallback: "",
  })}`
    .trim()
    .toLowerCase();
  if (!normalized) {
    return null;
  }

  let bestMatch = null;

  for (const rule of IMPACT_RULES) {
    for (const keyword of rule.keywords) {
      const index = normalized.indexOf(keyword);
      if (index === -1) {
        continue;
      }

      const score = keyword.length;
      if (
        !bestMatch ||
        score > bestMatch.score ||
        (score === bestMatch.score && index < bestMatch.index)
      ) {
        bestMatch = { rule, keyword, index, score };
      }
    }
  }

  if (!bestMatch) {
    return null;
  }

  return {
    ...bestMatch.rule,
    method: "rules",
    reason: `Potrivire text: ${bestMatch.keyword}.`,
  };
}

function classifyMaintenanceWithRules(entry, statusHint) {
  const title = normalizeWhitespace(entry?.title || "");
  const description = prepareTextForTranslation(entry?.description, {
    stripHtml: true,
    fallback: "",
  });
  const combined = `${title} ${description}`.trim().toLowerCase();
  const sectionType = normalizeWhitespace(entry?.sectionType || "").toLowerCase();
  const hasMaintenanceSignal =
    sectionType === "planned_maintenance" ||
    /\b(planned maintenance|scheduled maintenance|maintenance window|under maintenance|maintenance)\b/.test(combined);

  if (!hasMaintenanceSignal) {
    return buildUnknownMaintenance();
  }

  let statuspageStatus = "scheduled";
  let reason = "Sectiunea sau textul indica mentenanta programata.";
  if (
    /\b(maintenance completed|maintenance complete|completed maintenance|maintenance finished|maintenance ended)\b/.test(combined) ||
    normalizeIncidentStatusValue(statusHint?.statuspage) === "completed"
  ) {
    statuspageStatus = "completed";
    reason = "Textul indica finalizarea mentenantei.";
  } else if (
    /\b(maintenance in progress|under maintenance|maintenance underway|maintenance ongoing|in progress)\b/.test(combined) ||
    normalizeIncidentStatusValue(statusHint?.statuspage) === "in_progress"
  ) {
    statuspageStatus = "in_progress";
    reason = "Textul indica mentenanta in curs.";
  }

  const scheduleWindow = extractScheduledWindow(entry);

  return {
    isMaintenance: true,
    statuspageStatus,
    scheduledFor: scheduleWindow.scheduledFor,
    scheduledUntil: scheduleWindow.scheduledUntil,
    method: "rules",
    reason,
  };
}

function formatStatusPrefixedTitle(status, titleBase) {
  const cleanBase = normalizeWhitespace(titleBase || "");
  const prefix = getEnglishStatusLabel(status);
  if (!prefix) {
    return cleanBase || "Incident";
  }

  return cleanBase ? `${prefix} - ${cleanBase}` : prefix;
}

function getEnglishStatusLabel(status) {
  switch (status?.key) {
    case "scheduled":
      return "Scheduled";
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
    case "investigating":
      return "Investigating";
    case "identified":
      return "Identified";
    case "monitoring":
      return "Monitoring";
    case "resolved":
      return "Resolved";
    default:
      return "";
  }
}

function inferOneUptimeStatus(title, description, isActiveIncident = false) {
  const mapped = mapStatus(title, description);
  if (mapped?.statuspage) {
    return mapped;
  }

  const normalized = `${title || ""} ${description || ""}`.toLowerCase();
  if (/\b(resolved|closed|completed|fixed|restored)\b/.test(normalized)) {
    return getStatusRule("resolved");
  }

  if (/\b(monitoring|observing|watching)\b/.test(normalized)) {
    return getStatusRule("monitoring");
  }

  if (/\b(identified|mitigated|acknowledged)\b/.test(normalized)) {
    return getStatusRule("identified");
  }

  if (isActiveIncident || /\b(investigating|investigate|ongoing|active|open)\b/.test(normalized)) {
    return getStatusRule("investigating");
  }

  return {
    key: "necunoscut",
    translated: "Actualizare incident",
    statuspage: null,
  };
}

function getStatusRule(key) {
  return STATUS_RULES.find((rule) => rule.key === key) || null;
}

function getStatusRuleByStatuspageValue(status) {
  const normalized = normalizeIncidentStatusValue(status);
  return STATUS_RULES.find((rule) => rule.statuspage === normalized) || null;
}

function parseDiagnosticStatus(value) {
  const normalized = normalizeWhitespace(value || "").toLowerCase();
  if (!normalized) {
    return getStatusRule("investigating");
  }

  const aliasMap = {
    investigating: "investigating",
    investigate: "investigating",
    identified: "identified",
    identify: "identified",
    monitoring: "monitoring",
    monitor: "monitoring",
    resolved: "resolved",
    resolve: "resolved",
  };

  const key = aliasMap[normalized] || "";
  return key ? getStatusRule(key) : null;
}

function buildDiagnosticDescription(status) {
  switch (status?.key) {
    case "identified":
      return "Test manual pentru verificarea bannerului general din Statuspage. Problema a fost identificata.";
    case "monitoring":
      return "Test manual pentru verificarea bannerului general din Statuspage. Sistemul este monitorizat dupa remediere.";
    case "resolved":
      return "Test manual pentru verificarea bannerului general din Statuspage. Incidentul de diagnostic este rezolvat.";
    case "investigating":
    default:
      return "Test manual pentru verificarea bannerului general din Statuspage. Investigam o problema simulata.";
  }
}

function extractMarkdownHeading(text) {
  const value = String(text || "");
  const match = value.match(/^\s*#{1,6}\s+(.+)$/m);
  return normalizeWhitespace(match?.[1] || "");
}

function extractOneUptimeIncidentId(entity) {
  return extractOneUptimeText(entity, ["incidentId", "incident._id", "incident.id", "incident.value"]);
}

function extractOneUptimeEntityId(entity) {
  return extractOneUptimeText(entity, ["_id", "id", "value"]);
}

function extractOneUptimeDate(entity, paths) {
  return extractOneUptimeText(entity, paths);
}

function extractOneUptimeText(entity, paths) {
  if (!entity || !Array.isArray(paths)) {
    return "";
  }

  for (const path of paths) {
    const value = readNestedValue(entity, path);
    const normalized = normalizeApiScalar(value);
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function readNestedValue(entity, path) {
  if (!entity || !path) {
    return undefined;
  }

  return String(path)
    .split(".")
    .reduce((current, key) => {
      if (current === null || current === undefined) {
        return undefined;
      }

      return current[key];
    }, entity);
}

function normalizeApiScalar(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return normalizeWhitespace(String(value));
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = normalizeApiScalar(item);
      if (normalized) {
        return normalized;
      }
    }

    return "";
  }

  if (typeof value === "object") {
    if ("value" in value) {
      const normalizedValue = normalizeApiScalar(value.value);
      if (normalizedValue) {
        return normalizedValue;
      }
    }

    for (const key of ["_id", "id", "name", "slug", "title", "note", "text", "message", "description"]) {
      if (key in value) {
        const normalizedValue = normalizeApiScalar(value[key]);
        if (normalizedValue) {
          return normalizedValue;
        }
      }
    }
  }

  return "";
}

function pickFirstArray(...values) {
  for (const value of values) {
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function buildPublicIncidentLink(entry, source) {
  const publicStatusUrl = normalizeWhitespace(source?.publicStatusUrl || "");
  if (publicStatusUrl) {
    return publicStatusUrl;
  }

  if (readBoolean(source?.hideSourceLinks, DEFAULT_HIDE_SOURCE_LINKS)) {
    return "";
  }

  return normalizeWhitespace(entry?.link || "");
}

function sanitizePublicDescription(description, source) {
  const normalized = normalizeWhitespace(description || "");
  if (!normalized) {
    return "";
  }

  if (!readBoolean(source?.hideSourceLinks, DEFAULT_HIDE_SOURCE_LINKS)) {
    return normalized;
  }

  return normalizeWhitespace(
    normalized.replace(/https?:\/\/[^\s)]+/gi, "").replace(/\(\s*\)/g, "").replace(/\[\s*\]/g, ""),
  );
}

function getConfiguredComponentIds(source) {
  const raw = normalizeWhitespace(source?.componentIdsRaw || "");
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean);
}

function mapIncidentToComponentStatus(incidentStatus, env, incidentImpact = null) {
  if (hasKnownImpact(incidentImpact) && incidentImpact.componentStatus) {
    return incidentImpact.componentStatus;
  }

  const defaults = {
    scheduled: "degraded_performance",
    in_progress: "degraded_performance",
    completed: "operational",
    investigating: "major_outage",
    identified: "partial_outage",
    monitoring: "degraded_performance",
    resolved: "operational",
  };

  const overrides = {
    scheduled: normalizeWhitespace(env?.STATUSPAGE_COMPONENT_STATUS_SCHEDULED || ""),
    in_progress: normalizeWhitespace(env?.STATUSPAGE_COMPONENT_STATUS_IN_PROGRESS || ""),
    completed: normalizeWhitespace(env?.STATUSPAGE_COMPONENT_STATUS_COMPLETED || ""),
    investigating: normalizeWhitespace(
      env?.STATUSPAGE_COMPONENT_STATUS_INVESTIGATING || env?.INSTATUS_COMPONENT_STATUS_INVESTIGATING || "",
    ),
    identified: normalizeWhitespace(
      env?.STATUSPAGE_COMPONENT_STATUS_IDENTIFIED || env?.INSTATUS_COMPONENT_STATUS_IDENTIFIED || "",
    ),
    monitoring: normalizeWhitespace(
      env?.STATUSPAGE_COMPONENT_STATUS_MONITORING || env?.INSTATUS_COMPONENT_STATUS_MONITORING || "",
    ),
    resolved: normalizeWhitespace(
      env?.STATUSPAGE_COMPONENT_STATUS_RESOLVED || env?.INSTATUS_COMPONENT_STATUS_RESOLVED || "",
    ),
  };

  return (
    overrides[incidentStatus?.statuspage] ||
    defaults[incidentStatus?.statuspage] ||
    "degraded_performance"
  );
}

function applyAffectedComponents(payload, env, sourceIncident) {
  if (!sourceIncident?.source?.componentStatusUpdatesEnabled) {
    return payload;
  }

  const componentIds = getConfiguredComponentIds(sourceIncident.source);
  if (!componentIds.length) {
    return payload;
  }

  const componentStatus = mapIncidentToComponentStatus(sourceIncident.status, env, sourceIncident.impact);
  payload.component_ids = componentIds;
  payload.components = Object.fromEntries(componentIds.map((componentId) => [componentId, componentStatus]));
  return payload;
}

async function fetchRSS(env, source) {
  const urls = uniqueValues([
    source?.rssUrl || env?.RSS_URL || DEFAULT_RSS_URL,
    source?.rssFallbackUrl || env?.RSS_FALLBACK_URL || DEFAULT_RSS_FALLBACK_URL,
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
      const hasFeedItems = /<(item|entry)\b/i.test(xml || "");
      const looksLikeFeedDocument = /<(rss|feed|rdf:RDF)\b/i.test(xml || "");
      if (!xml || (!hasFeedItems && !looksLikeFeedDocument)) {
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

async function fetchStackStatusPage(env, source) {
  const url = normalizeWhitespace(source?.sourceUrl || source?.publicStatusUrl || "");
  if (!url) {
    return { ok: false, message: "URL-ul paginii de status lipseste." };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("timeout"), getFetchTimeout(env));

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        message: `Preluarea paginii StackStatus a esuat cu codul ${response.status}.`,
      };
    }

    return {
      ok: true,
      html: await response.text(),
    };
  } catch (error) {
    return {
      ok: false,
      message: isAbortError(error)
        ? "Preluarea paginii StackStatus a expirat."
        : "Preluarea paginii StackStatus a esuat.",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseStackStatusPage(html) {
  if (!html || typeof html !== "string") {
    return [];
  }

  const incidentsSection = extractStackStatusSection(html, "Incidents", "Planned Maintenance");
  const maintenanceSection = extractStackStatusSection(html, "Planned Maintenance", null);

  return [
    ...parseStackStatusSectionCards(incidentsSection, "incidents"),
    ...parseStackStatusSectionCards(maintenanceSection, "planned_maintenance"),
  ]
    .filter(Boolean)
    .sort((left, right) => {
      const leftTime = Date.parse(left.pubDate || "") || 0;
      const rightTime = Date.parse(right.pubDate || "") || 0;
      return rightTime - leftTime;
    });
}

function extractStackStatusSection(html, heading, nextHeading) {
  const headingPattern = new RegExp(`<h3>\\s*${escapeRegExp(heading)}\\s*<\\/h3>([\\s\\S]*?)${nextHeading ? `<h3>\\s*${escapeRegExp(nextHeading)}\\s*<\\/h3>` : "$"}`, "i");
  const match = html.match(headingPattern);
  return match?.[1] || "";
}

function parseStackStatusSectionCards(sectionHtml, sectionType) {
  if (!sectionHtml) {
    return [];
  }

  const chunks = sectionHtml.split(/<div class="card mb-3">/i).slice(1);
  const entries = [];

  for (const chunk of chunks) {
    const dateLabel = normalizeWhitespace(decodeXmlEntities(stripHtml(extractFirstMatch(chunk, /<h4\b[^>]*>([\s\S]*?)<\/h4>/i))));
    const bodyHtml = extractFirstMatch(chunk, /<div class="card-body">([\s\S]*?)<\/div>/i);
    const description = normalizeWhitespace(decodeXmlEntities(stripHtml(bodyHtml)));
    if (!description || /^there are no service messages\.?$/i.test(description)) {
      continue;
    }

    const title =
      normalizeWhitespace(
        decodeXmlEntities(
          stripHtml(
            extractFirstMatch(bodyHtml, /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i) ||
            extractFirstMatch(bodyHtml, /<strong\b[^>]*>([\s\S]*?)<\/strong>/i),
          ),
        ),
      ) ||
      (sectionType === "planned_maintenance"
        ? `Planned Maintenance - ${dateLabel || "StackStatus"}`
        : `Incident - ${dateLabel || "StackStatus"}`);

    const pubDate = parseStackStatusDateLabel(dateLabel) || new Date().toISOString();
    const signature = normalizeWhitespace(`${sectionType}|${dateLabel}|${title}|${description}`).toLowerCase();

    entries.push({
      entryId: `stackstatus:${sectionType}:${simpleStableId(signature)}`,
      title,
      description,
      pubDate,
      link: "https://www.stackstatus.com/",
      sectionType,
      sectionDateLabel: dateLabel,
      sourceKey:
        sectionType === "planned_maintenance"
          ? `maintenance:${buildSourceIncidentKey(title, getStatusRule("scheduled"))}`
          : "",
    });
  }

  return entries;
}

function parseStackStatusDateLabel(value) {
  const normalized = normalizeWhitespace(value || "");
  const match = normalized.match(/(\d{1,2})-([A-Za-z]{3})-(\d{2,4})/);
  if (!match) {
    return "";
  }

  const monthMap = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };
  const day = Number.parseInt(match[1], 10);
  const month = monthMap[match[2].toLowerCase()];
  let year = Number.parseInt(match[3], 10);
  if (!Number.isFinite(day) || month === undefined || !Number.isFinite(year)) {
    return "";
  }

  if (year < 100) {
    year += year >= 70 ? 1900 : 2000;
  }

  return new Date(Date.UTC(year, month, day, 12, 0, 0)).toISOString();
}

function mergeSourceEntries(...collections) {
  const merged = [];
  const seen = new Set();

  for (const collection of collections) {
    if (!Array.isArray(collection)) {
      continue;
    }

    for (const entry of collection) {
      if (!entry) {
        continue;
      }

      const key = normalizeWhitespace(
        entry.entryId ||
        `${entry.title || ""}|${entry.description || ""}|${entry.pubDate || ""}|${entry.link || ""}`,
      ).toLowerCase();
      if (!key || seen.has(key)) {
        continue;
      }

      seen.add(key);
      merged.push(entry);
    }
  }

  return merged.sort((left, right) => {
    const leftTime = Date.parse(left.pubDate || "") || 0;
    const rightTime = Date.parse(right.pubDate || "") || 0;
    return rightTime - leftTime;
  });
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

function extractScheduledWindow(entry) {
  const text = `${normalizeWhitespace(entry?.title || "")} ${prepareTextForTranslation(entry?.description, {
    stripHtml: true,
    fallback: "",
  })}`.trim();
  if (!text) {
    return { scheduledFor: "", scheduledUntil: "" };
  }

  const isoMatches = [...text.matchAll(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z\b/g)].map((match) =>
    normalizeIsoDateTime(match[0]),
  ).filter(Boolean);
  if (isoMatches.length >= 2) {
    return {
      scheduledFor: isoMatches[0],
      scheduledUntil: isoMatches[1],
    };
  }

  const dateSource =
    parseStackStatusDateLabel(entry?.sectionDateLabel || "") ||
    normalizeIsoDateTime(entry?.pubDate || "");
  if (!dateSource) {
    return { scheduledFor: "", scheduledUntil: "" };
  }

  const parsedBase = new Date(dateSource);
  if (!Number.isFinite(parsedBase.getTime())) {
    return { scheduledFor: "", scheduledUntil: "" };
  }

  const timeRangeMatch = text.match(
    /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(UTC|GMT|BST)?\s*(?:to|\-|–|—)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(UTC|GMT|BST)?\b/i,
  );
  if (!timeRangeMatch) {
    return { scheduledFor: "", scheduledUntil: "" };
  }

  const firstDate = buildScheduledDateTimeFromParts(parsedBase, {
    hour: timeRangeMatch[1],
    minute: timeRangeMatch[2],
    meridiem: timeRangeMatch[3],
    zone: timeRangeMatch[4],
  });
  const secondDate = buildScheduledDateTimeFromParts(parsedBase, {
    hour: timeRangeMatch[5],
    minute: timeRangeMatch[6],
    meridiem: timeRangeMatch[7],
    zone: timeRangeMatch[8] || timeRangeMatch[4],
  });

  if (!firstDate || !secondDate) {
    return { scheduledFor: "", scheduledUntil: "" };
  }

  let scheduledFor = firstDate.toISOString();
  let scheduledUntil = secondDate.toISOString();
  if (secondDate.getTime() <= firstDate.getTime()) {
    scheduledUntil = new Date(secondDate.getTime() + 24 * 60 * 60 * 1000).toISOString();
  }

  return { scheduledFor, scheduledUntil };
}

function buildScheduledDateTimeFromParts(baseDate, parts) {
  const parsedHour = Number.parseInt(parts?.hour, 10);
  if (!Number.isFinite(parsedHour)) {
    return null;
  }

  let hour = parsedHour;
  const minute = Number.parseInt(parts?.minute || "0", 10) || 0;
  const meridiem = normalizeWhitespace(parts?.meridiem || "").toLowerCase();
  if (meridiem === "pm" && hour < 12) {
    hour += 12;
  } else if (meridiem === "am" && hour === 12) {
    hour = 0;
  }

  const zone = normalizeWhitespace(parts?.zone || "UTC").toUpperCase();
  const zoneOffsets = {
    UTC: 0,
    GMT: 0,
    BST: 60,
  };
  const offsetMinutes = zoneOffsets[zone];
  if (offsetMinutes === undefined) {
    return null;
  }

  return new Date(Date.UTC(
    baseDate.getUTCFullYear(),
    baseDate.getUTCMonth(),
    baseDate.getUTCDate(),
    hour,
    minute,
    0,
  ) - offsetMinutes * 60 * 1000);
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
    statuspage: null,
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

async function readStatuspageBackoff(env) {
  try {
    const value =
      (await env.STATUS_KV.get(STATUSPAGE_RATE_LIMIT_KEY)) ||
      (await env.STATUS_KV.get("instatus_rate_limited_until"));
    if (!value) {
      return { active: false, until: null, untilFormatted: "" };
    }

    const until = Number.parseInt(value, 10);
    if (!Number.isFinite(until) || until <= Date.now()) {
      await env.STATUS_KV.delete(STATUSPAGE_RATE_LIMIT_KEY);
      if (typeof env.STATUS_KV.delete === "function") {
        await env.STATUS_KV.delete("instatus_rate_limited_until");
      }
      return { active: false, until: null, untilFormatted: "" };
    }

    return {
      active: true,
      until,
      untilFormatted: formatTimestampToRomanian(until, env.TIME_ZONE || DEFAULT_TIME_ZONE),
    };
  } catch (error) {
    console.error("Eroare backoff Statuspage:", sanitizeError(error));
    return { active: false, until: null, untilFormatted: "" };
  }
}

async function writeStatuspageBackoff(env, retryAfterSeconds) {
  const safeSeconds =
    Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? retryAfterSeconds
      : DEFAULT_STATUSPAGE_RETRY_AFTER_SECONDS;
  const until = Date.now() + safeSeconds * 1000;

  try {
    await env.STATUS_KV.put(STATUSPAGE_RATE_LIMIT_KEY, String(until), {
      expirationTtl: safeSeconds,
    });
  } catch (error) {
    console.error("Eroare salvare backoff Statuspage:", sanitizeError(error));
  }
}

async function clearStatuspageBackoff(env) {
  try {
    await env.STATUS_KV.delete(STATUSPAGE_RATE_LIMIT_KEY);
    if (typeof env.STATUS_KV.delete === "function") {
      await env.STATUS_KV.delete("instatus_rate_limited_until");
    }
  } catch (error) {
    console.error("Eroare stergere backoff Statuspage:", sanitizeError(error));
  }
}

function getRetryAfterSeconds(response) {
  const header = response.headers.get("Retry-After");
  if (!header) {
    return DEFAULT_STATUSPAGE_RETRY_AFTER_SECONDS;
  }

  const seconds = Number.parseInt(header, 10);
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds;
  }

  const dateValue = Date.parse(header);
  if (Number.isFinite(dateValue)) {
    const deltaSeconds = Math.ceil((dateValue - Date.now()) / 1000);
    return deltaSeconds > 0 ? deltaSeconds : DEFAULT_STATUSPAGE_RETRY_AFTER_SECONDS;
  }

  return DEFAULT_STATUSPAGE_RETRY_AFTER_SECONDS;
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

function shouldUseAiIncidentClassification(env) {
  return Boolean(
    env?.AI &&
      typeof env.AI.run === "function" &&
      readBoolean(env.AI_INCIDENT_CLASSIFICATION_ENABLED, DEFAULT_AI_INCIDENT_CLASSIFICATION_ENABLED),
  );
}

function getAiIncidentClassificationModel(env) {
  return env?.AI_INCIDENT_CLASSIFICATION_MODEL || DEFAULT_AI_INCIDENT_CLASSIFICATION_MODEL;
}

function getAiIncidentClassificationMaxInputLength(env) {
  const parsed = Number.parseInt(env?.AI_INCIDENT_CLASSIFICATION_MAX_INPUT_LENGTH, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_AI_INCIDENT_CLASSIFICATION_MAX_INPUT_LENGTH;
}

function buildIncidentClassificationPrompt(entry, source, statusHint, env) {
  const title = prepareTextForTranslation(entry?.title, {
    stripHtml: true,
    maxLength: 300,
    fallback: "",
  });
  const description = prepareTextForTranslation(entry?.description, {
    stripHtml: true,
    maxLength: getAiIncidentClassificationMaxInputLength(env),
    fallback: "",
  });
  const payload = [
    `Source: ${normalizeWhitespace(source?.name || "unknown") || "unknown"}`,
    `Lifecycle status hint: ${normalizeIncidentStatusValue(statusHint?.statuspage || "unknown") || "unknown"}`,
    `Section hint: ${normalizeWhitespace(entry?.sectionType || "unknown") || "unknown"}`,
    `Published at: ${normalizeWhitespace(entry?.pubDate || "") || "unknown"}`,
    `Title: ${title || "(empty)"}`,
    `Description: ${description || "(empty)"}`,
  ].join("\n");

  return limitLength(payload, getAiIncidentClassificationMaxInputLength(env));
}

function extractAiJsonObject(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    return null;
  }

  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1] || raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeIsoDateTime(value) {
  const normalized = normalizeWhitespace(value || "");
  if (!normalized || /^null$/i.test(normalized)) {
    return "";
  }

  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) {
    return "";
  }

  return new Date(parsed).toISOString();
}

function normalizeAiIncidentClassification(aiPayload) {
  const reason = normalizeWhitespace(aiPayload?.reason || aiPayload?.explanation || "");
  const impactKey = normalizeImpactKey(
    aiPayload?.impact ||
    aiPayload?.classification ||
    aiPayload?.severity ||
    aiPayload?.category ||
    "",
  );

  const confidence = Number.parseFloat(aiPayload?.confidence);
  const impact =
    impactKey === "unknown"
      ? buildUnknownImpact({
        method: "ai",
        reason,
      })
      : getImpactRule(impactKey)
        ? {
          ...getImpactRule(impactKey),
          method: "ai",
          reason,
          confidence: Number.isFinite(confidence) ? confidence : undefined,
        }
        : buildUnknownImpact();

  const eventType = normalizeWhitespace(aiPayload?.event_type || aiPayload?.type || "").toLowerCase();
  const eventStatus = normalizeWhitespace(aiPayload?.event_status || aiPayload?.status || "").toLowerCase();
  const maintenanceStatus = normalizeMaintenanceStatus(eventStatus);
  const maintenance =
    eventType === "scheduled_maintenance" || maintenanceStatus
      ? {
        isMaintenance: true,
        statuspageStatus: maintenanceStatus || "scheduled",
        scheduledFor: normalizeIsoDateTime(aiPayload?.scheduled_for || aiPayload?.start_at || ""),
        scheduledUntil: normalizeIsoDateTime(aiPayload?.scheduled_until || aiPayload?.end_at || ""),
        method: "ai",
        reason,
      }
      : buildUnknownMaintenance();

  const status =
    getStatusRuleByStatuspageValue(maintenance.statuspageStatus) ||
    getStatusRuleByStatuspageValue(eventStatus) ||
    null;

  return {
    impact,
    maintenance,
    status,
  };
}

function classifyIncidentWithRules(entry, statusHint) {
  const maintenance = classifyMaintenanceWithRules(entry, statusHint);
  const status = hasMaintenanceLifecycle(maintenance)
    ? getStatusRuleByStatuspageValue(maintenance.statuspageStatus) || statusHint
    : statusHint;
  return {
    impact: classifyImpactWithRules(entry?.title, entry?.description, status) || buildUnknownImpact(),
    maintenance,
    status,
  };
}

function buildForcedSemanticsFromStatus(statusHint) {
  const impactKeyByStatus = {
    scheduled: "degraded_performance",
    in_progress: "degraded_performance",
    completed: "operational",
    investigating: "major_outage",
    identified: "partial_outage",
    monitoring: "degraded_performance",
    resolved: "operational",
  };
  const impactRule = getImpactRule(impactKeyByStatus[statusHint?.statuspage] || "");

  return {
    impact: impactRule
      ? {
        ...impactRule,
        method: "forced",
        reason: `Impact fortat dupa statusul manual ${statusHint?.statuspage || "necunoscut"}.`,
      }
      : buildUnknownImpact({
        method: "forced",
        reason: "Nu a fost gasita o mapare fortata pentru statusul manual.",
      }),
    maintenance: buildUnknownMaintenance({
      method: "forced",
      reason: "Fluxul de diagnostic manual nu foloseste mentenanta programata.",
    }),
    status: statusHint,
  };
}

async function classifyIncidentSemantics(entry, env, source, statusHint) {
  if (normalizeWhitespace(source?.id || "").toLowerCase() === "diagnostic") {
    return buildForcedSemanticsFromStatus(statusHint);
  }

  const rules = classifyIncidentWithRules(entry, statusHint);

  if (shouldUseAiIncidentClassification(env)) {
    try {
      const messages = [
        {
          role: "system",
          content:
            "You classify source status text only. Return strict minified JSON with keys impact, event_type, event_status, scheduled_for, scheduled_until, confidence, reason. impact must be exactly one of: major_outage, partial_outage, degraded_performance, operational, unknown. event_type must be exactly one of: realtime_incident, scheduled_maintenance, unknown. event_status must be exactly one of: investigating, identified, monitoring, resolved, scheduled, in_progress, completed, unknown. scheduled_for and scheduled_until must be RFC3339 UTC timestamps or null, and only when the timing is explicit in the provided text. Do not invent facts. If ambiguous, use unknown or null. Scheduled or planned maintenance without total unavailability maps to degraded_performance. Resolved, restored, completed, or operational maps to operational.",
        },
        {
          role: "user",
          content: buildIncidentClassificationPrompt(entry, source, statusHint, env),
        },
      ];
      const aiResponse = await env.AI.run(getAiIncidentClassificationModel(env), { messages });
      const aiText = extractAiTranslatedText(aiResponse);
      const aiPayload = extractAiJsonObject(aiText);
      const normalized = normalizeAiIncidentClassification(aiPayload || {});
      return {
        impact: hasKnownImpact(normalized.impact) ? normalized.impact : rules.impact,
        maintenance: mergeMaintenanceState(normalized.maintenance, rules.maintenance),
        status: normalized.status || rules.status || statusHint,
      };
    } catch (error) {
      console.error("Eroare clasificare AI impact:", sanitizeError(error));
    }
  }

  return rules;
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
    .replace(/\b(?:scheduled maintenance|planned maintenance|scheduled)\b/gi, "Mentenanta programata")
    .replace(/\b(?:maintenance in progress|under maintenance|in progress)\b/gi, "Mentenanta in curs")
    .replace(/\b(?:maintenance completed|maintenance complete|completed)\b/gi, "Mentenanta finalizata")
    .replace(/\b(?:investigating|investigating issue|under investigation)\b/gi, "Investigam")
    .replace(/\b(?:identified|issue identified|cause identified)\b/gi, "Identificat")
    .replace(/\b(?:monitoring|closely monitoring)\b/gi, "Monitorizam")
    .replace(/\b(?:resolved|issue resolved|incident resolved)\b/gi, "Rezolvat");

  if (statusHint?.translated) {
    normalized = replaceCaseInsensitive(normalized, statusHint.translated, statusHint.translated);
  }

  return normalized;
}

async function createStatuspageIncident(env, sourceIncident) {
  const config = getStatuspageConfig(env);
  const url = `${config.apiBaseUrl}/v1/pages/${encodeURIComponent(config.pageId)}/incidents`;
  const { incident, publishedMaintenance } = buildStatuspageIncidentPayload(env, config, sourceIncident);
  sourceIncident.publishedMaintenance = publishedMaintenance;
  sourceIncident.publishedStatus = incident.status;

  const response = await performStatuspageRequest(env, url, "POST", { incident });
  if (!response.ok) {
    return response;
  }

  const incidentId = extractStatuspageIncidentId(response.body);
  if (!incidentId) {
    return {
      ok: false,
      message: "Statuspage a raspuns fara ID de incident.",
    };
  }

  return {
    ok: true,
    incidentId,
  };
}

async function updateExistingStatuspageIncident(env, existingState, sourceIncident) {
  const config = getStatuspageConfig(env);
  const incidentId = getStoredIncidentId(existingState);
  const incidentUrl = `${config.apiBaseUrl}/v1/pages/${encodeURIComponent(config.pageId)}/incidents/${encodeURIComponent(incidentId)}`;
  const { incident, publishedMaintenance } = buildStatuspageIncidentPayload(env, config, sourceIncident, existingState);
  sourceIncident.publishedMaintenance = publishedMaintenance;
  sourceIncident.publishedStatus = incident.status;

  const response = await performStatuspageRequest(env, incidentUrl, "PATCH", { incident });
  if (!response.ok) {
    return response;
  }

  return {
    ok: true,
    incidentId,
  };
}

function buildStatuspageIncidentPayload(env, config, sourceIncident, existingState = null) {
  const publishedMaintenance = resolvePublishedMaintenance(sourceIncident, existingState);
  const maintenanceStatus = normalizeMaintenanceStatus(publishedMaintenance.statuspageStatus);
  const effectiveStatus =
    maintenanceStatus ||
    getFallbackStatuspageStatusForSourceIncident(sourceIncident);
  const incident = applyAffectedComponents(
    {
      name: sourceIncident.publicIncident.title,
      body: sourceIncident.publicIncident.description,
      status: effectiveStatus,
      deliver_notifications: config.deliverNotifications,
    },
    env,
    sourceIncident,
  );

  if (hasKnownImpact(sourceIncident?.impact) && sourceIncident.impact.impactOverride) {
    incident.impact_override = sourceIncident.impact.impactOverride;
  }

  if (hasMaintenanceLifecycle(publishedMaintenance) && publishedMaintenance.scheduledFor) {
    incident.scheduled_for = publishedMaintenance.scheduledFor;
    incident.scheduled_until = publishedMaintenance.scheduledUntil || publishedMaintenance.scheduledFor;
    incident.scheduled_remind_prior = true;
    incident.auto_transition_to_maintenance_state = true;
    incident.auto_transition_to_operational_state = true;
    incident.scheduled_auto_in_progress = true;
    incident.scheduled_auto_completed = true;
    incident.auto_transition_deliver_notifications_at_start = config.deliverNotifications;
    incident.auto_transition_deliver_notifications_at_end = config.deliverNotifications;
  }

  return { incident, publishedMaintenance };
}

function resolvePublishedMaintenance(sourceIncident, existingState = null) {
  const maintenance = mergeMaintenanceState(sourceIncident?.maintenance, getStoredMaintenance(existingState));
  if (!hasMaintenanceLifecycle(maintenance) || !maintenance.scheduledFor) {
    return buildUnknownMaintenance();
  }

  return maintenance;
}

function getFallbackStatuspageStatusForSourceIncident(sourceIncident) {
  const maintenanceStatus = normalizeMaintenanceStatus(sourceIncident?.maintenance?.statuspageStatus || "");
  if (maintenanceStatus === "completed") {
    return "resolved";
  }

  if (maintenanceStatus === "scheduled" || maintenanceStatus === "in_progress") {
    return "monitoring";
  }

  return sourceIncident?.status?.statuspage || "investigating";
}

function isStatuspageRateLimitedStatus(statusCode) {
  return statusCode === 420 || statusCode === 429;
}

async function waitForStatuspageRateLimitWindow() {
  const minimumGapMs = 1100;
  const elapsed = Date.now() - lastStatuspageRequestAt;
  const waitMs = minimumGapMs - elapsed;
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  lastStatuspageRequestAt = Date.now();
}

async function performStatuspageRequest(env, url, method, payload) {
  try {
    const config = getStatuspageConfig(env);
    await waitForStatuspageRateLimitWindow();
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `OAuth ${config.apiKey}`,
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
          isStatuspageRateLimitedStatus(response.status)
            ? `Trimiterea catre Statuspage a fost limitata temporar cu codul ${response.status}.`
            : `Trimiterea catre Statuspage a esuat cu codul ${response.status}.`,
        body,
      };
    }

    return {
      ok: true,
      body,
    };
  } catch (error) {
    console.error("Eroare Statuspage:", sanitizeError(error));
    return {
      ok: false,
      message: "Trimiterea catre Statuspage a esuat.",
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

function extractStatuspageIncidentId(body) {
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

function extractFirstMatch(text, pattern) {
  const match = String(text || "").match(pattern);
  return match?.[1] || "";
}

function simpleStableId(input) {
  const value = String(input || "");
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
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

function getIncidentTimestamp(pubDate) {
  const parsed = Date.parse(pubDate || "");
  return Number.isFinite(parsed) ? parsed : -1;
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
