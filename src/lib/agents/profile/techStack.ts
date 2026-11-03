/**
 * Tech-stack detection from one page fetch (HTML + response headers) and the
 * domain's MX records. The signature list is our own: each entry names the
 * technology and the markers that only that technology emits.
 */

interface Signature {
  name: string;
  category: string;
  html?: RegExp;
  header?: { name: string; value?: RegExp };
}

const SIGNATURES: Signature[] = [
  { name: "WordPress", category: "CMS", html: /\/wp-content\/|\/wp-includes\// },
  { name: "Webflow", category: "CMS", html: /data-wf-(site|page)=|assets\.website-files\.com/ },
  { name: "Wix", category: "CMS", html: /static\.wixstatic\.com|wix-bolt/ },
  { name: "Squarespace", category: "CMS", html: /static1\.squarespace\.com|squarespace-cdn/ },
  { name: "Framer", category: "CMS", html: /framerusercontent\.com|data-framer-/ },
  { name: "Drupal", category: "CMS", html: /\/sites\/default\/files\/|Drupal\.settings/ },
  { name: "Ghost", category: "CMS", html: /content="Ghost \d/ },
  { name: "HubSpot CMS", category: "CMS", html: /hs-sites\.com|hubspotusercontent/ },
  { name: "Contentful", category: "CMS", html: /images\.ctfassets\.net/ },
  { name: "Sanity", category: "CMS", html: /cdn\.sanity\.io/ },
  { name: "Shopify", category: "Ecommerce", html: /cdn\.shopify\.com|Shopify\.theme/ },
  { name: "WooCommerce", category: "Ecommerce", html: /woocommerce/ },
  { name: "Magento", category: "Ecommerce", html: /Mage\.Cookies|\/static\/version\d+\/frontend\// },
  { name: "BigCommerce", category: "Ecommerce", html: /cdn\d*\.bigcommerce\.com/ },
  { name: "Next.js", category: "Framework", html: /\/_next\/static\/|__NEXT_DATA__/ },
  { name: "Nuxt", category: "Framework", html: /\/_nuxt\/|__NUXT__/ },
  { name: "Gatsby", category: "Framework", html: /___gatsby|\/page-data\// },
  { name: "Angular", category: "Framework", html: /ng-version=/ },
  { name: "React", category: "Framework", html: /data-reactroot|react-dom(\.production)?\.min\.js/ },
  { name: "Vue.js", category: "Framework", html: /data-v-[0-9a-f]{8}|vue(\.runtime)?(\.global)?(\.prod)?\.js/ },
  { name: "Svelte", category: "Framework", html: /class="svelte-[a-z0-9]+"/ },
  { name: "Google Analytics", category: "Analytics", html: /googletagmanager\.com\/gtag\/js|google-analytics\.com\/(analytics|ga)\.js/ },
  { name: "Google Tag Manager", category: "Analytics", html: /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]{4,}/ },
  { name: "Segment", category: "Analytics", html: /cdn\.segment\.com\/analytics\.js/ },
  { name: "Mixpanel", category: "Analytics", html: /cdn\.mxpnl\.com|mixpanel\.init/ },
  { name: "Amplitude", category: "Analytics", html: /cdn\.amplitude\.com|amplitude\.getInstance/ },
  { name: "Hotjar", category: "Analytics", html: /static\.hotjar\.com/ },
  { name: "Microsoft Clarity", category: "Analytics", html: /clarity\.ms\/tag/ },
  { name: "Heap", category: "Analytics", html: /cdn\.heapanalytics\.com/ },
  { name: "PostHog", category: "Analytics", html: /posthog\.init|\.posthog\.com/ },
  { name: "Meta Pixel", category: "Advertising", html: /connect\.facebook\.net\/[^"']*\/fbevents\.js/ },
  { name: "LinkedIn Insight Tag", category: "Advertising", html: /snap\.licdn\.com\/li\.lms-analytics/ },
  { name: "Google Ads", category: "Advertising", html: /googleadservices\.com|AW-\d{6,}/ },
  { name: "HubSpot", category: "Marketing automation", html: /js\.hs-scripts\.com|js\.hsforms\.net|js\.hs-analytics\.net/ },
  { name: "Marketo", category: "Marketing automation", html: /munchkin\.marketo\.net|mktoForms2/ },
  { name: "Pardot", category: "Marketing automation", html: /pi\.pardot\.com|piAId/ },
  { name: "Mailchimp", category: "Marketing automation", html: /chimpstatic\.com|list-manage\.com/ },
  { name: "Klaviyo", category: "Marketing automation", html: /static\.klaviyo\.com/ },
  { name: "Salesforce", category: "CRM", html: /force\.com|salesforce\.com\/embeddedservice/ },
  { name: "Intercom", category: "Customer support", html: /widget\.intercom\.io|intercomSettings/ },
  { name: "Drift", category: "Customer support", html: /js\.driftt\.com/ },
  { name: "Zendesk", category: "Customer support", html: /static\.zdassets\.com|zendesk\.com\/embeddable/ },
  { name: "Freshdesk", category: "Customer support", html: /freshdesk\.com|freshchat/ },
  { name: "Crisp", category: "Customer support", html: /client\.crisp\.chat/ },
  { name: "Tawk.to", category: "Customer support", html: /embed\.tawk\.to/ },
  { name: "Calendly", category: "Scheduling", html: /assets\.calendly\.com|calendly\.com\/[a-z0-9-]+/ },
  { name: "Stripe", category: "Payments", html: /js\.stripe\.com/ },
  { name: "Razorpay", category: "Payments", html: /checkout\.razorpay\.com/ },
  { name: "PayPal", category: "Payments", html: /paypal\.com\/sdk\/js|paypalobjects\.com/ },
  { name: "Cloudflare", category: "CDN", header: { name: "cf-ray" } },
  { name: "Cloudflare", category: "CDN", header: { name: "server", value: /cloudflare/i } },
  { name: "Vercel", category: "Hosting", header: { name: "x-vercel-id" } },
  { name: "Netlify", category: "Hosting", header: { name: "x-nf-request-id" } },
  { name: "Amazon CloudFront", category: "CDN", header: { name: "x-amz-cf-id" } },
  { name: "Fastly", category: "CDN", header: { name: "x-served-by", value: /cache-/i } },
  { name: "Akamai", category: "CDN", header: { name: "server", value: /AkamaiGHost/i } },
  { name: "Nginx", category: "Web server", header: { name: "server", value: /nginx/i } },
  { name: "Apache", category: "Web server", header: { name: "server", value: /apache/i } },
  { name: "Microsoft IIS", category: "Web server", header: { name: "server", value: /Microsoft-IIS/i } },
  { name: "PHP", category: "Language", header: { name: "x-powered-by", value: /php/i } },
  { name: "Express", category: "Framework", header: { name: "x-powered-by", value: /express/i } },
  { name: "ASP.NET", category: "Framework", header: { name: "x-powered-by", value: /asp\.net/i } },
  { name: "Cloudflare Turnstile", category: "Security", html: /challenges\.cloudflare\.com\/turnstile/ },
  { name: "reCAPTCHA", category: "Security", html: /google\.com\/recaptcha|grecaptcha/ },
  { name: "Optimizely", category: "Experimentation", html: /cdn\.optimizely\.com/ },
  { name: "VWO", category: "Experimentation", html: /dev\.visualwebsiteoptimizer\.com/ },
  { name: "OneTrust", category: "Consent", html: /cdn\.cookielaw\.org|optanon/i },
  { name: "Cookiebot", category: "Consent", html: /consent\.cookiebot\.com/ },
];

const MX_PROVIDERS: Array<{ name: string; re: RegExp }> = [
  { name: "Google Workspace", re: /(aspmx\.l\.google\.com|googlemail\.com|google\.com)$/i },
  { name: "Microsoft 365", re: /mail\.protection\.outlook\.com$/i },
  { name: "Zoho Mail", re: /zoho\.(com|in|eu)$/i },
  { name: "Proofpoint", re: /pphosted\.com$/i },
  { name: "Mimecast", re: /mimecast\.com$/i },
  { name: "Amazon WorkMail", re: /awsapps\.com$/i },
];

export interface DetectedTech {
  name: string;
  category: string;
}

/** Technologies evidenced by the page's HTML and headers, de-duplicated by name. */
export function detectTech(html: string, headers: Record<string, string>): DetectedTech[] {
  const lowerHeaders = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  const hits = SIGNATURES.filter((s) => {
    if (s.html && s.html.test(html)) return true;
    if (s.header) {
      const v = lowerHeaders[s.header.name];
      return v !== undefined && (!s.header.value || s.header.value.test(v));
    }
    return false;
  });
  const seen = new Set<string>();
  return hits.filter((h) => !seen.has(h.name) && seen.add(h.name)).map(({ name, category }) => ({ name, category }));
}

/** The email platform behind a domain's MX hosts, or null when unrecognised. */
export function emailProviderFromMx(exchanges: string[]): string | null {
  const host = exchanges.map((e) => e.toLowerCase().replace(/\.$/, ""));
  return MX_PROVIDERS.find((p) => host.some((h) => p.re.test(h)))?.name ?? null;
}
