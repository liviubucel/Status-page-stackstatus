# StackStatus RSS -> Atlassian Statuspage Worker

Worker Cloudflare care:

- preia incidente din surse externe de status
- parseaza RSS/Atom fara librarii externe
- traduce continutul in romana cu Workers AI
- clasifica impactul din textul original cu Workers AI
- detecteaza doar intrarile noi cu KV, separat pe sursa
- creeaza si actualizeaza incidente in Atlassian Statuspage
- poate marca automat incidentele ca rezolvate daca sursa nu mai raporteaza probleme active

## Fisiere

- `src/index.js` - Worker-ul complet
- `wrangler.toml` - configurare Worker, variabile si cron

## Ce s-a schimbat

Proiectul nu mai scrie in Instatus. Integrarea de iesire este acum pentru Atlassian Statuspage.

Important:

- URL-ul public `https://zbt.statuspage.io/api` este API-ul public al paginii si este util pentru citire.
- Pentru creare si actualizare de incidente, Worker-ul foloseste API-ul de management Atlassian:
  - `POST https://api.statuspage.io/v1/pages/{page_id}/incidents`
  - `PATCH https://api.statuspage.io/v1/pages/{page_id}/incidents/{incident_id}`
- Autentificarea se face cu header-ul `Authorization: OAuth <api_key>`.

Ai nevoie de doua valori reale din contul Statuspage:

- `STATUSPAGE_API_KEY`
- `STATUSPAGE_PAGE_ID`

Le gasesti in interfata de management Statuspage, la `API info`.

## Ce face Worker-ul

1. Monitorizeaza implicit feed-ul `20i` din `https://www.stackstatus.com/rss`.
2. Poate monitoriza optional si o a doua sursa OneUptime, de exemplu Upmind.
3. Normalizeaza toate sursele intr-un format comun.
4. Traduce titlul si descrierea in romana.
5. Clasifica impactul textului in `major_outage / partial_outage / degraded_performance / operational`.
6. Tine stare in KV pentru fiecare sursa, ca sa nu dubleze incidentele.
7. Leaga update-urile `investigating / identified / monitoring / resolved` de acelasi incident Statuspage.
8. Poate colora automat componentele din Statuspage daca setezi `component_ids`.

## Deploy si configurare

### 1. Creeaza KV Namespace

Din Cloudflare Dashboard:

1. Intra la `Workers & Pages`.
2. Deschide `KV`.
3. Creeaza un namespace, de exemplu `stackstatus-cache`.
4. Copiaza `Namespace ID`.

Sau cu Wrangler:

```powershell
npx wrangler kv namespace create STATUS_KV
npx wrangler kv namespace create STATUS_KV --preview
```

### 2. Leaga KV de Worker

Binding-ul trebuie sa fie:

```toml
[[kv_namespaces]]
binding = "STATUS_KV"
id = "ID_REAL_KV"
preview_id = "ID_REAL_KV_PREVIEW"
```

Cheile folosite de Worker sunt:

- `feed_cursor:20i`
- `incident_state:20i:*`
- `source_current_incident:20i`
- `last_incident`
- `last_incident:20i`
- aceleasi forme pentru surse suplimentare, de exemplu `upmind`
- `statuspage_rate_limited_until`

### 3. Seteaza secretele

```powershell
npx wrangler secret put STATUSPAGE_API_KEY
npx wrangler secret put STATUSPAGE_PAGE_ID
npx wrangler secret put MANUAL_SYNC_TOKEN
```

`STATUSPAGE_PAGE_ID` poate fi si variabila normala, dar este mai curat sa ramana secret.

### 4. Activeaza Workers AI

In acest proiect binding-ul AI este deja definit:

```toml
[ai]
binding = "AI"
```

Worker-ul functioneaza si fara AI, dar traducerea cade pe fallback local.

### 5. Ajusteaza variabilele optionale

In [`wrangler.toml`](/D:/Apps/Status-page-stackstatus/wrangler.toml) poti modifica:

- `ENABLE_20I_SOURCE`
- `RSS_URL`
- `RSS_FALLBACK_URL`
- `TIME_ZONE`
- `MAX_DESCRIPTION_LENGTH`
- `FETCH_TIMEOUT_MS`
- `PUBLIC_STATUS_URL`
- `HIDE_SOURCE_LINKS`
- `STATUSPAGE_API_BASE_URL`
- `STATUSPAGE_DELIVER_NOTIFICATIONS`
- `STATUSPAGE_COMPONENT_IDS`
- `STATUSPAGE_COMPONENT_UPDATES_ENABLED`
- `STATUSPAGE_COMPONENT_STATUS_INVESTIGATING`
- `STATUSPAGE_COMPONENT_STATUS_IDENTIFIED`
- `STATUSPAGE_COMPONENT_STATUS_MONITORING`
- `STATUSPAGE_COMPONENT_STATUS_RESOLVED`
- `UPMIND_STATUS_PAGE_ID`
- `UPMIND_API_BASE_URL`
- `UPMIND_SOURCE_NAME`
- `UPMIND_SOURCE_URL`
- `UPMIND_PUBLIC_STATUS_URL`
- `UPMIND_HIDE_SOURCE_LINKS`
- `UPMIND_COMPONENT_IDS`
- `UPMIND_COMPONENT_UPDATES_ENABLED`
- `AI_TRANSLATION_ENABLED`
- `AI_TRANSLATION_MODEL`
- `AI_SOURCE_LANG`
- `AI_TARGET_LANG`
- `AI_MAX_INPUT_LENGTH`
- `AI_INCIDENT_CLASSIFICATION_ENABLED`
- `AI_INCIDENT_CLASSIFICATION_MODEL`
- `AI_INCIDENT_CLASSIFICATION_MAX_INPUT_LENGTH`
- `MANUAL_SYNC_TOKEN`

### 6. Cron

Cron-ul este deja definit:

```toml
[triggers]
crons = ["*/5 * * * *"]
```

### 7. Ruleaza local

```powershell
npx wrangler dev --test-scheduled
```

Test cron local:

```powershell
curl "http://127.0.0.1:8787/cdn-cgi/handler/scheduled?cron=*/5+*+*+*+*"
```

### 8. Deploy

```powershell
npx wrangler deploy
```

## Trigger manual securizat

URL-ul normal al Worker-ului este read-only. Publicarea se face doar prin cron sau prin trigger manual autorizat.

Exemplu:

```text
https://worker-ul-tau.workers.dev/?sync=1&token=TOKENUL_TAU
```

Fara `token` corect, Worker-ul doar afiseaza incidentul curent si nu publica nimic in Statuspage.

## Test diagnostic

Poti crea sau actualiza un incident de test:

```text
https://worker-ul-tau.workers.dev/?sync=1&token=TOKENUL_TAU&diagnostic=1&status=investigating&title=Test%20banner
```

Statusuri acceptate:

- `investigating`
- `identified`
- `monitoring`
- `resolved`

Exemple:

```text
https://worker-ul-tau.workers.dev/?sync=1&token=TOKENUL_TAU&diagnostic=1&status=investigating&title=Test%20banner
https://worker-ul-tau.workers.dev/?sync=1&token=TOKENUL_TAU&diagnostic=1&status=monitoring&title=Test%20banner
https://worker-ul-tau.workers.dev/?sync=1&token=TOKENUL_TAU&diagnostic=1&status=resolved&title=Test%20banner
```

## Variabile folosite

- `STATUS_KV` - binding KV obligatoriu
- `STATUSPAGE_API_KEY` - secret obligatoriu
- `STATUSPAGE_PAGE_ID` - obligatoriu
- `ENABLE_20I_SOURCE` - optional, implicit activ
- `RSS_URL` - optional
- `RSS_FALLBACK_URL` - optional
- `TIME_ZONE` - optional
- `MAX_DESCRIPTION_LENGTH` - optional
- `FETCH_TIMEOUT_MS` - optional
- `PUBLIC_STATUS_URL` - optional, URL-ul public afisat in raspuns
- `HIDE_SOURCE_LINKS` - optional
- `STATUSPAGE_API_BASE_URL` - optional, implicit `https://api.statuspage.io`
- `STATUSPAGE_DELIVER_NOTIFICATIONS` - optional
- `STATUSPAGE_COMPONENT_IDS` - optional, lista de componente afectate de sursa 20i
- `STATUSPAGE_COMPONENT_UPDATES_ENABLED` - optional, implicit `false`
- `STATUSPAGE_COMPONENT_STATUS_INVESTIGATING` - optional
- `STATUSPAGE_COMPONENT_STATUS_IDENTIFIED` - optional
- `STATUSPAGE_COMPONENT_STATUS_MONITORING` - optional
- `STATUSPAGE_COMPONENT_STATUS_RESOLVED` - optional
- `UPMIND_STATUS_PAGE_ID` - optional, activeaza sursa Upmind
- `UPMIND_API_BASE_URL` - optional, implicit `https://oneuptime.com`
- `UPMIND_SOURCE_NAME` - optional
- `UPMIND_SOURCE_URL` - optional
- `UPMIND_PUBLIC_STATUS_URL` - optional
- `UPMIND_HIDE_SOURCE_LINKS` - optional
- `UPMIND_COMPONENT_IDS` - optional
- `UPMIND_COMPONENT_UPDATES_ENABLED` - optional
- `AI` - binding Workers AI recomandat
- `AI_TRANSLATION_ENABLED` - optional
- `AI_TRANSLATION_MODEL` - optional
- `AI_SOURCE_LANG` - optional
- `AI_TARGET_LANG` - optional
- `AI_MAX_INPUT_LENGTH` - optional
- `AI_INCIDENT_CLASSIFICATION_ENABLED` - optional, implicit `true`
- `AI_INCIDENT_CLASSIFICATION_MODEL` - optional
- `AI_INCIDENT_CLASSIFICATION_MAX_INPUT_LENGTH` - optional
- `MANUAL_SYNC_TOKEN` - optional, recomandat ca secret

## Componente in Statuspage

Daca vrei ca incidentul sa afecteze si componentele din pagina, seteaza:

```toml
STATUSPAGE_COMPONENT_IDS = "component_id_1,component_id_2"
STATUSPAGE_COMPONENT_UPDATES_ENABLED = "true"
```

Maparea implicita este:

- `investigating` -> `major_outage`
- `identified` -> `partial_outage`
- `monitoring` -> `degraded_performance`
- `resolved` -> `operational`

Daca AI sau regulile gasesc un impact explicit in text, componentele si `impact_override` din Statuspage folosesc acel impact in locul maparii implicite de mai sus.

Poti suprascrie cu:

- `STATUSPAGE_COMPONENT_STATUS_INVESTIGATING`
- `STATUSPAGE_COMPONENT_STATUS_IDENTIFIED`
- `STATUSPAGE_COMPONENT_STATUS_MONITORING`
- `STATUSPAGE_COMPONENT_STATUS_RESOLVED`

Pentru sursa Upmind folosesti separat:

```toml
UPMIND_COMPONENT_IDS = "component_id_upmind"
UPMIND_COMPONENT_UPDATES_ENABLED = "true"
```

## Exemple de raspuns

### Incident procesat

```json
{
  "status": "20i: 1 incident nou creat.",
  "incident": {
    "title": "Investigam rata crescuta de erori",
    "description": "Investigam rapoartele privind erori intermitente. Utilizatorii pot intampina probleme temporare.",
    "date": "22 martie 2026 la 20:14",
    "link": "https://zbt.statuspage.io"
  }
}
```

### Fara actualizari noi

```json
{
  "status": "20i: Nu exista actualizari noi.",
  "incident": {
    "title": "Rezolvat - problema anterioara",
    "description": "Problema a fost rezolvata.",
    "date": "22 martie 2026 la 19:40",
    "link": "https://zbt.statuspage.io"
  }
}
```

### Configuratie lipsa

```json
{
  "status": "20i: Configuratia Statuspage lipseste. Seteaza STATUSPAGE_API_KEY si STATUSPAGE_PAGE_ID.",
  "incident": null
}
```

## Observatii

- Atlassian Statuspage are rate limit strict pe API-ul de management; Worker-ul aplica throttling si backoff automat.
- Cererile HTTP normale nu publica, ceea ce reduce riscul de spam sau `429`.
- Worker-ul nu reconciliaza incidente create manual direct in Statuspage.
- Fiecare sursa isi pastreaza propriul cursor si propria stare in KV.
- Codul accepta in continuare variabilele vechi `INSTATUS_*` ca fallback, ca sa poti migra treptat secretele fara downtime.
