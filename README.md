# StackStatus Cloudflare Worker

Monitorizează automat incidentele de pe Stack Overflow (https://www.stackstatus.com/) folosind un Cloudflare Worker.

## Cum funcționează

- Worker-ul verifică periodic feed-ul RSS StackStatus.
- Returnează JSON cu `incident: true` dacă există un incident nou, altfel `incident: false`.

## Deploy rapid pe Cloudflare Workers

1. Clonează acest repo.
2. Conectează-l la Cloudflare Workers (din dashboard, la Deployments -> GitHub integration).
3. Selectează folderul `src` și fișierul `index.js` ca entrypoint.
4. Publică Worker-ul.
5. Folosește URL-ul generat pentru monitorizare în Instatus sau alte servicii.

## Exemplu răspuns

```json
{
  "incident": false
}
```
sau
```json
{
  "incident": true,
  "details": {
    "title": "...",
    "link": "...",
    ...
  }
}
```
