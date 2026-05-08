// Redirects all bjorkvang.org traffic to bjørkvang.no (xn--bjrkvang-y1a.no).
// Deployed as a Cloudflare Worker — see wrangler.toml for the route binding.
export default {
  fetch(request) {
    const url = new URL(request.url);
    const location = 'https://xn--bjrkvang-y1a.no' + url.pathname + url.search;
    return new Response(null, {
      status: 301,
      headers: {
        'Location': location,
        'Cache-Control': 'max-age=3600',
      },
    });
  },
};
