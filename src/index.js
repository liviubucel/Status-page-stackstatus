export default {
  async fetch(request, env, ctx) {
    const rssUrl = "https://www.stackstatus.com/history.rss";
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
    const response = await fetch(apiUrl);
    const data = await response.json();

    const latestIncident = data.items?.[0];
    if (latestIncident && /(incident|outage|degraded)/i.test(latestIncident.title)) {
      return new Response(JSON.stringify({ incident: true, details: latestIncident }), {
        headers: { "Content-Type": "application/json" },
      });
    } else {
      return new Response(JSON.stringify({ incident: false }), {
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};
