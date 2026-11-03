// Turns the raw scan into 17 scored checks, an overall score and a "fix these first" list.
import { parseDocument, visibleText } from './parse'

const PENALTY = { critical: 45, high: 25, medium: 12, low: 6 }
export const SEVERITIES = ['critical', 'high', 'medium', 'low']

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)))
// A score from the findings: each one takes points off.
const scoreFrom = (findings, start = 100) => clamp(findings.reduce((s, f) => s - PENALTY[f.severity], start))
const yesNo = (v) => (v ? 'Yes' : 'No')
const find = (severity, issue, fix) => ({ severity, issue, fix })
const when = (list, cond, text) => {
  if (cond) list.push(text)
}
const roastLine = (score, lines) => (score == null ? 'Not checked on this scan.' : score < 60 ? lines[0] : score < 80 ? lines[1] : lines[2])
const ms = (v) => (v == null ? '–' : v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`)
const failing = (psi, category) => (psi?.failing ?? []).filter((f) => f.category === category)
const matching = (html, table) => table.filter(([, re]) => re.test(html))

const PLATFORMS = [
  ['WordPress', /\/wp-content\/|\/wp-includes\//i],
  ['Elementor', /elementor-(?:widget|element|section|kit|frontend)|\/plugins\/elementor\//i],
  ['Divi', /et_pb_|\/Divi\//i],
  ['Wix', /static\.wixstatic\.com|wix\.com\/|_wixCIDX/i],
  ['Squarespace', /squarespace\.com|static1\.squarespace/i],
  ['Shopify', /cdn\.shopify\.com/i],
  ['Webflow', /data-wf-page|webflow\.js|website-files\.com/i],
  ['GoHighLevel', /stcdn\.leadconnectorhq\.com|assets\.cdn\.filesafe\.space|images\.leadconnectorhq\.com/i],
  ['Next.js', /\/_next\/static/i],
  ['Framer', /framerusercontent\.com|framer\.com\/m\//i],
  ['Duda', /irp\.cdn-website\.com|dudaone/i],
  ['Joomla', /\/media\/jui\/|\/media\/system\/js\/|content="Joomla/i],
  ['Drupal', /drupal-settings-json|\/sites\/default\/files/i],
  ['Nuxt', /__NUXT__|\/_nuxt\//i],
  ['Gatsby', /___gatsby/i],
  ['Ghost', /ghost-(?:url|portal)|content\/images\/size/i],
  ['GoDaddy Builder', /img1\.wsimg\.com/i],
  ['HubSpot CMS', /hs-sites\.com|hubspotusercontent/i],
]

// [name, pattern, where the leads go]
const FORM_TOOLS = [
  ['GoHighLevel form', /leadconnectorhq\.com\/widget\/(?:form|survey|booking)|msgsndr\.com\/widget|form_embed\.js/i, 'GoHighLevel CRM'],
  ['HubSpot form', /js\.hsforms\.net|hbspt\.forms/i, 'HubSpot CRM'],
  ['Gravity Forms', /gform_wrapper|gform_fields/i, 'email to the owner (CRM only with an add-on)'],
  ['Contact Form 7', /wpcf7/i, 'email to the owner (no CRM)'],
  ['WPForms', /wpforms-form/i, 'email to the owner (CRM only with an add-on)'],
  ['Elementor form', /elementor-form/i, 'email to the owner (CRM only via webhook)'],
  ['Ninja Forms', /nf-form-cont/i, 'email to the owner'],
  ['Jotform', /jotform\.(?:com|net)/i, 'Jotform inbox'],
  ['Typeform', /typeform\.com\/to\/|embed\.typeform/i, 'Typeform'],
  ['Formspree', /formspree\.io/i, 'email via Formspree'],
  ['Netlify form', /data-netlify="true"/i, 'Netlify inbox'],
  ['Mailchimp signup', /list-manage\.com/i, 'Mailchimp list'],
  ['Squarespace form', /sqs-block-form|form-block/i, 'Squarespace inbox'],
  ['Wix form', /wixforms|wix-forms/i, 'Wix inbox'],
  ['Calendly', /calendly\.com/i, 'Calendly bookings'],
  ['Jobber request', /jobber\.com|getjobber/i, 'Jobber'],
  ['Housecall Pro', /housecallpro/i, 'Housecall Pro'],
  ['ServiceTitan', /servicetitan/i, 'ServiceTitan'],
]

const CRM_SCRIPTS = [
  ['HubSpot tracking', /js\.hs-scripts\.com|js\.hs-analytics\.net/i],
  ['Zoho', /zohopublic|salesiq\.zoho/i],
  ['Salesforce Pardot', /pardot\.com|pi\.pardot/i],
  ['ActiveCampaign', /trackcmp\.net|activehosted\.com/i],
  ['Keap', /infusionsoft|keap-/i],
  ['Pipedrive', /leadbooster|pipedrive/i],
  ['Klaviyo', /klaviyo/i],
]

// [name, pattern, can answer with AI]
const CHAT_TOOLS = [
  ['GoHighLevel webchat', /widgets\.leadconnectorhq\.com|chat-widget|lc_text-widget|msgsndr\.com\/.*chat/i, true],
  ['Intercom', /widget\.intercom\.io|intercomSettings/i, true],
  ['Drift', /js\.driftt\.com|drift\.load/i, true],
  ['Tidio', /code\.tidio\.co/i, true],
  ['Crisp', /client\.crisp\.chat/i, false],
  ['Tawk.to', /embed\.tawk\.to/i, false],
  ['LiveChat', /cdn\.livechatinc\.com/i, false],
  ['Zendesk', /static\.zdassets\.com|zopim/i, true],
  ['HubSpot chat', /js\.usemessages\.com/i, true],
  ['Facebook Messenger', /customerchat/i, false],
  ['Olark', /static\.olark\.com/i, false],
  ['Freshchat', /wchat\.freshchat\.com/i, true],
  ['Podium', /connect\.podium\.com/i, true],
  ['Birdeye', /birdeye\.com\/embed|widgets\.birdeye/i, true],
  ['Chatbase', /chatbase\.co/i, true],
  ['Voiceflow', /voiceflow\.com/i, true],
  ['Botpress', /botpress\.cloud|cdn\.botpress/i, true],
  ['Landbot', /landbot\.io/i, true],
  ['Smith.ai', /smith\.ai/i, false],
  ['Userlike', /userlike/i, false],
  ['Chatra', /call\.chatra\.io/i, false],
  ['JivoChat', /jivosite|jivo\.chat/i, false],
  ['Gorgias', /gorgias/i, true],
  ['Wix chat', /wix-chat|chat\.wix/i, false],
]

const PIXELS = [
  ['Meta Pixel', /connect\.facebook\.net\/[^"']*fbevents\.js|fbq\(\s*['"]init/i],
  ['LinkedIn Insight', /snap\.licdn\.com/i],
  ['TikTok Pixel', /analytics\.tiktok\.com/i],
  ['Pinterest Tag', /pintrk|s\.pinimg\.com\/ct/i],
  ['Microsoft Ads (UET)', /bat\.bing\.com/i],
  ['X / Twitter Pixel', /static\.ads-twitter\.com/i],
  ['Snap Pixel', /sc-static\.net\/scevent/i],
  ['Reddit Pixel', /redditstatic\.com\/ads/i],
  ['Microsoft Clarity', /clarity\.ms/i],
  ['Hotjar', /static\.hotjar\.com/i],
  ['CallRail', /cdn\.callrail\.com/i],
  ['WhatConverts', /whatconverts/i],
]

const AI_CRAWLERS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended', 'CCBot', 'Applebot-Extended']

// robots.txt -> Map(user-agent -> disallowed paths)
function parseRobots(text) {
  const rules = new Map()
  let agents = []
  let inAgentBlock = false
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim()
    const m = /^(user-agent|disallow|allow)\s*:\s*(.*)$/i.exec(line)
    if (!m) continue
    if (/user-agent/i.test(m[1])) {
      agents = inAgentBlock ? [...agents, m[2].toLowerCase()] : [m[2].toLowerCase()]
      inAgentBlock = true
      agents.forEach((a) => rules.set(a, rules.get(a) ?? []))
      continue
    }
    inAgentBlock = false
    if (/disallow/i.test(m[1]) && m[2]) agents.forEach((a) => rules.get(a).push(m[2]))
  }
  return rules
}
const blocksAll = (rules, agent) => (rules.get(agent.toLowerCase()) ?? (agent === '*' ? [] : rules.get('*')) ?? []).includes('/')

function schemaTypes(html) {
  const types = new Set()
  for (const block of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi))
    for (const t of block[1].matchAll(/"@type"\s*:\s*(?:"([^"]+)"|\[([^\]]+)\])/g)) (t[1] ?? t[2]).split(',').forEach((x) => types.add(x.replace(/["\s]/g, '')))
  return [...types]
}

const CTA_WORDS = /\b(get|book|request|call|contact|quote|start|schedule|free|estimate|consult|enquire|inquire|apply|talk|buy|shop|order|sign ?up|join|download|claim|reserve)\b/i

// ---------------------------------------------------------------- the checks
export function analyze(data) {
  const home = data.pages[0]
  const html = data.html
  const all = data.allHtml
  const doc = data.doc ?? parseDocument(html)
  const text = visibleText(doc)
  const psiM = data.psi?.mobile
  const psiD = data.psi?.desktop
  const https = data.origin.startsWith('https:')
  const header = (name) => data.home.headers[name.toLowerCase()]
  const ai = data.ai
  // A page that only exists after JavaScript runs, and couldn't be rendered: judge nothing from the code.
  const unreadable = !!data.js && !data.js.rendered
  const unreadableNote =
    "Couldn't judge from the code: this page is built by JavaScript in the browser, so its HTML is empty, and it couldn't be rendered in a browser this time."

  const platforms = matching(all, PLATFORMS).map(([n]) => n)
  const server = header('server')
  if (/cloudflare/i.test(server ?? '')) platforms.push('Cloudflare')
  if (header('x-vercel-id')) platforms.push('Vercel')
  if (/netlify/i.test(server ?? '')) platforms.push('Netlify')

  const clickables = [...doc.querySelectorAll('a, button')].map((el) => ({ text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(), href: el.getAttribute('href') ?? '' }))
  const phones = clickables.filter((c) => /^tel:/i.test(c.href))
  const emails = clickables.filter((c) => /^mailto:/i.test(c.href))
  const ctas = clickables.filter((c) => c.text.length > 1 && c.text.length < 40 && CTA_WORDS.test(c.text))
  const schema = schemaTypes(all)
  const broken = data.links.filter((l) => l.status >= 400)
  const unverified = data.links.filter((l) => l.status === 0)
  const imgs = [...doc.querySelectorAll('img')]
  const h2s = doc.querySelectorAll('h2').length
  const checks = []

  // Combines the AI's verdict on a check with the rule-based one when the AI review ran.
  const withAi = (id, title, group, aiPart, rules) => {
    const own = unreadable ? { ...rules, score: null, findings: [], strengths: [] } : rules
    const missingNote = unreadable && !aiPart ? unreadableNote : data.aiNote
    if (aiPart) {
      return {
        id,
        title,
        group,
        score: own.score == null ? aiPart.score : clamp(0.65 * aiPart.score + 0.35 * own.score),
        roast: aiPart.roast,
        analysis: aiPart.analysis,
        examples: aiPart.examples,
        findings: [...aiPart.findings, ...own.findings],
        strengths: [...aiPart.strengths, ...own.strengths],
        facts: own.facts,
      }
    }
    return {
      id,
      title,
      group,
      score: own.score,
      roast: roastLine(own.score, own.lines),
      findings: own.findings,
      strengths: own.strengths,
      facts: own.facts,
      note: own.score == null ? (missingNote ?? "Needs the AI review, which isn't configured.") : missingNote ? "Rule-based only: the AI review didn't run." : undefined,
    }
  }

  // 1. First impression
  {
    const f = []
    const h1 = home.h1s[0] ?? ''
    const h1Words = h1.split(/\s+/).length
    if (!home.h1s.length) f.push(find('high', 'The homepage has no H1 headline.', 'Lead with one clear headline that says what you do and for whom.'))
    else if (/^(welcome|home|hello|hi there)\b/i.test(h1) || h1.split(' ').length < 3)
      f.push(find('medium', `The main headline "${h1.slice(0, 60)}" doesn't say what you do.`, 'Rewrite it as outcome + service + location, e.g. "Custom homes built on time in Brisbane".'))
    else if (h1Words > 10) f.push(find('low', `The main headline runs ${h1Words} words. Visitors scan, they don't read.`, 'Cut the headline to 8 words or fewer and move the detail into the subheading.'))
    if (!home.description) f.push(find('low', 'No meta description, so Google writes your search snippet for you.', 'Write a 140-160 character description with the offer and a reason to click.'))
    const good = []
    when(good, home.h1s.length === 1 && h1Words >= 3 && h1Words <= 10, `A single, scannable headline: "${h1.slice(0, 70)}".`)
    when(good, home.title && home.title.length <= 65, 'The page title fits in a Google result without being cut off.')
    when(good, home.description, 'Has a meta description, so you control the search snippet.')
    checks.push(
      withAi('first-impression', 'First impression', 'Impression', ai?.firstImpression, {
        score: scoreFrom(f, 85),
        findings: f,
        strengths: good,
        facts: [
          ['Headline', h1 || 'None'],
          ['Page title', home.title || 'None'],
        ],
        lines: ["A visitor lands, squints, and still can't tell what you sell.", "The message is there, but it's making visitors work for it.", 'Clear offer, clear audience. Good start.'],
      }),
    )
  }

  // 2. Design & style
  {
    const fonts = new Set([...html.matchAll(/fonts\.googleapis\.com\/css2?\?family=([^"'&]+)/gi)].flatMap((m) => decodeURIComponent(m[1]).split('|').map((x) => x.split(':')[0].replace(/\+/g, ' '))))
    const f = []
    if (fonts.size > 3) f.push(find('low', `${fonts.size} different web fonts are loaded.`, 'Stick to two families (one for headings, one for text): faster and more consistent.'))
    const heavy = imgs.filter((i) => /\.(jpe?g|png)(\?|$)/i.test(i.getAttribute('src') ?? '')).length
    if (heavy > 5) f.push(find('low', `${heavy} homepage images are heavy JPG/PNG files.`, 'Serve WebP or AVIF: same look, a fraction of the weight.'))
    const good = []
    when(good, fonts.size > 0 && fonts.size <= 2, `A tight type system: ${[...fonts].join(' + ')}.`)
    when(good, imgs.length && !heavy, 'Images use modern formats or a CDN.')
    checks.push(
      withAi('design', 'Design & style', 'Impression', ai?.design, {
        score: null,
        findings: f,
        strengths: good,
        facts: [
          ['Web fonts', fonts.size ? [...fonts].join(', ') : 'System / self-hosted'],
          ['Built with', platforms.join(', ') || 'Unknown'],
        ],
        lines: ['', '', ''],
      }),
    )
  }

  // 3. Content & copy
  {
    const f = []
    if (home.words < 150)
      f.push(find('high', `The homepage has only ~${home.words} words of readable text in its HTML.`, 'Add real content: what you do, who for, proof, and the next step. If the site builds content with JavaScript, search engines and AI may see even less.'))
    else if (home.words > 2500) f.push(find('low', `The homepage runs ~${home.words} words.`, 'Trim to the essentials and move detail to service pages.'))
    const thin = data.pages.slice(1).filter((p) => p.words < 200)
    if (thin.length >= 3) f.push(find('medium', `${thin.length} of ${data.pages.length - 1} inner pages are thin (under 200 words).`, 'Give each service and location page enough unique content to rank and convince.'))
    if (/lorem ipsum|sample page|just another wordpress site|your (company|business) name/i.test(text)) f.push(find('critical', 'Template placeholder text is live on the site.', 'Find and replace every placeholder before sending traffic.'))
    if (home.words >= 150 && h2s < 2) f.push(find('low', 'The homepage has almost no section headings (H2s), so it reads as one long block.', 'Break the page into clear sections with descriptive H2 headings.'))
    const vague = clickables.filter((c) => /^(learn more|read more|click here|more|submit|go)$/i.test(c.text)).length
    if (vague > 2) f.push(find('low', `${vague} buttons or links say things like "Learn more" or "Click here".`, 'Say what happens next: "See our kitchen renovations", "Get my free quote".'))
    const good = []
    when(good, home.words >= 300 && home.words <= 2500, `Enough homepage content to rank and persuade (~${home.words} words).`)
    when(good, h2s >= 3, `Clearly sectioned with ${h2s} H2 headings.`)
    when(good, data.pages.length > 1 && thin.length === 0, 'Every inner page scanned has real content.')
    checks.push(
      withAi('copy', 'Content & copy', 'Impression', ai?.copy, {
        score: scoreFrom(f, 85),
        findings: f,
        strengths: good,
        facts: [
          ['Homepage words', String(home.words)],
          ['Pages crawled', String(data.pages.length)],
        ],
        lines: ["The words on this site aren't doing any selling.", 'Decent copy that could be sharper and more specific.', 'The copy is clear and does its job.'],
      }),
    )
  }

  // 4. Conversion & CTAs
  {
    const f = []
    if (!ctas.length) f.push(find('critical', 'No clear call-to-action button or link on the homepage.', 'Add one primary action (Get a quote / Book a call) at the top and repeat it down the page.'))
    else if (ctas.length > 12) f.push(find('low', `${ctas.length} action links compete for attention on the homepage.`, 'Pick one primary action and make everything else secondary.'))
    if (!phones.length) f.push(find('high', 'No tap-to-call phone link on the homepage.', 'Add a tel: link in the header so phone visitors can call in one tap.'))
    const hasForm = data.pages.some((p) => p.forms > 0)
    if (!hasForm && !matching(all, FORM_TOOLS).length) f.push(find('high', 'No enquiry form found on any page scanned.', 'Add a short form (name, phone, email, what you need) on the contact page and homepage.'))
    const pricing = /pricing|price|cost|\bfrom \$|[$€£]\s?\d|per (hour|month|sqm|m2|week)|packages|investment/i.test(all)
    if (!pricing) f.push(find('low', 'No pricing, packages or cost guidance anywhere on the pages scanned.', "Give a starting price, a range or a 'what affects cost' section. Price-shoppers leave when there's nothing."))
    if (emails.length && !phones.length) f.push(find('low', 'Email is offered but not phone, the slowest contact route for hot leads.', 'Offer a phone number or booking link next to email.'))
    const good = []
    when(good, ctas.length >= 1 && ctas.length <= 12, `Clear calls to action: ${[...new Set(ctas.map((c) => `"${c.text}"`))].slice(0, 3).join(', ')}.`)
    when(good, phones.length, 'Tap-to-call phone link for mobile visitors.')
    when(good, hasForm, 'An enquiry form is available.')
    when(good, pricing, 'Gives some pricing or cost guidance.')
    checks.push(
      withAi('conversion', 'Conversion & CTAs', 'Leads', ai?.conversion, {
        score: scoreFrom(f),
        findings: f,
        strengths: good,
        facts: [
          ['CTAs on homepage', [...new Set(ctas.map((c) => c.text))].slice(0, 6).join(' · ') || 'None'],
          ['Tap-to-call', phones[0]?.href.replace(/^tel:/i, '') ?? 'None'],
          ['Email links', String(emails.length)],
        ],
        lines: ['Visitors who want to buy have to hunt for how.', "There's a path to enquire, but it's not obvious enough.", "It's easy to take the next step."],
      }),
    )
  }

  // 5. Forms & CRM connection
  {
    const tools = matching(all, FORM_TOOLS)
    const crm = matching(all, CRM_SCRIPTS).map(([n]) => n)
    const formPages = data.pages.filter((p) => p.forms > 0).length
    const f = []
    if (!tools.length && !formPages) f.push(find('critical', 'No form to capture leads, so every enquiry depends on a phone call or email.', 'Add a lead form that posts straight into a CRM so no enquiry is lost.'))
    else if (tools.length) {
      if (tools.every(([, , dest]) => /owner|inbox|email/i.test(dest)) && !crm.length)
        f.push(find('high', `Forms (${tools.map(([n]) => n).join(', ')}) send leads to an inbox, not a CRM.`, 'Pipe submissions into a CRM with instant SMS/email follow-up and a pipeline stage. Speed to lead wins jobs.'))
    } else
      f.push(find('low', "Custom-built form: where it sends leads can't be seen from outside (this scan never submits forms).", 'Submit a test enquiry and confirm it lands in your CRM with the right source and an instant reply.'))
    if (tools.length) f.push(find('low', "Forms weren't submitted (this scan never sends data).", 'Submit a test lead yourself and confirm it lands in the CRM with the right source.'))
    const good = []
    const crmForms = tools.filter(([, , dest]) => /CRM/.test(dest))
    when(good, crmForms.length, `Leads go straight into a CRM (${crmForms.map(([n]) => n).join(', ')}).`)
    when(good, crm.length, `CRM tracking installed: ${crm.join(', ')}.`)
    when(good, formPages > 1, `Forms on ${formPages} pages, so visitors don't have to hunt.`)
    const score = scoreFrom(f)
    checks.push({
      id: 'forms-crm',
      title: 'Forms & CRM connection',
      group: 'Leads',
      score,
      findings: f,
      strengths: good,
      roast: roastLine(score, ['Leads are arriving into a void, or not arriving at all.', 'Leads get captured, but they probably sit in an inbox.', 'Forms are wired into a real system. Nice.']),
      facts: [
        ['Form tools', tools.map(([n]) => n).join(', ') || (formPages ? 'Custom form' : 'None')],
        ['Leads go to', [...new Set(tools.map(([, , d]) => d))].join('; ') || 'Unknown'],
        ['Pages with forms', `${formPages} of ${data.pages.length}`],
        ['CRM scripts', crm.join(', ') || 'None'],
      ],
    })
  }

  // 6. Chatbot / AI agent
  {
    const chat = matching(all, CHAT_TOOLS.map(([n, re, ai2]) => [n, re, ai2]))
    const aiCapable = chat.some(([, , a]) => a)
    const score = chat.length ? (aiCapable ? 95 : 80) : 45
    const f = chat.length
      ? aiCapable
        ? []
        : [find('low', `${chat[0][0]} is live chat only, so nobody answers after hours.`, 'Add an AI assistant that answers FAQs and books calls 24/7, handing over to a person when needed.')]
      : [find('medium', 'No chat or AI assistant.', "Add a chat widget with an AI agent that answers common questions and captures the lead's details, even at 10pm.")]
    checks.push({
      id: 'chatbot',
      title: 'Chatbot / AI agent',
      group: 'Leads',
      score,
      findings: f,
      strengths: chat.length ? [`${chat.map(([n]) => n).join(', ')} on the site${aiCapable ? ', able to answer with AI after hours' : ''}.`] : [],
      facts: [
        ['Chat widget', chat.map(([n]) => n).join(', ') || 'None'],
        ['AI-capable', yesNo(aiCapable)],
      ],
      roast: roastLine(score, ["After 5pm this website goes silent. Your competitors' don't.", 'Someone can chat, as long as a human is online.', 'Visitors can get answers any time.']),
      note: "Chat widgets added by Google Tag Manager won't show up here.",
    })
  }

  // 7. Google stack
  {
    const unique = (re) => [...new Set([...html.matchAll(re)].map((m) => m[0]))]
    const ga4 = unique(/\bG-[A-Z0-9]{6,12}\b/g)
    const gtm = unique(/\bGTM-[A-Z0-9]{4,9}\b/g)
    const ads = unique(/\bAW-\d{6,12}\b/g)
    const legacy = /\bUA-\d{4,10}-\d{1,3}\b/.test(html)
    const verified = /google-site-verification/i.test(html)
    const mapEmbed = /google\.com\/maps\/embed|maps\.googleapis\.com/i.test(html)
    const profile = /g\.page\/|maps\.app\.goo\.gl|google\.com\/maps\/place|google\.com\/maps\?cid|search\.google\.com\/local\/writereview|g\.co\/kgs/i.test(html)
    const reviewsWidget = /elfsight|trustindex|reviewsonmywebsite|embedsocial|grwapi|widget\.trustmary|sociablekit/i.test(html)
    const f = []
    if (!ga4.length && !gtm.length) f.push(find('critical', "No Google Analytics 4 or Tag Manager found, so you can't see where leads come from.", 'Install GA4 (ideally via Tag Manager) and mark form submits and calls as key events.'))
    else if (!ga4.length) f.push(find('low', "Tag Manager is installed; GA4 may be inside it but can't be confirmed from the HTML.", "Check GTM's preview mode that GA4 fires on every page."))
    if (legacy) f.push(find('low', 'Old Universal Analytics (UA-) code is still on the site. It stopped collecting data in 2023.', 'Remove the dead UA tag.'))
    if (!unreadable && !profile && !mapEmbed) f.push(find('medium', 'No link to a Google Business Profile or map.', "Link to your Google Business Profile and ask for reviews from the site. It's a strong local ranking and trust signal."))
    if (!schema.some((t) => /LocalBusiness|Organization|Corporation|Store|Contractor|Service|Restaurant|Dentist|Attorney|Plumber|Electrician|RoofingContractor|HomeAndConstructionBusiness|GeneralContractor|ProfessionalService/i.test(t)))
      f.push(find('medium', 'No business schema (LocalBusiness / Organization) for Google to read.', 'Add LocalBusiness schema with name, address, phone, hours, area served and your Google profile link.'))
    if (!verified) f.push(find('low', 'No Search Console verification tag (it may be verified via DNS instead).', "Make sure Search Console is set up; it's how you see search queries and indexing errors."))
    const good = []
    when(good, ga4.length, `Google Analytics 4 is installed (${ga4.join(', ')}).`)
    when(good, gtm.length, `Tag Manager is in place (${gtm.join(', ')}).`)
    when(good, ads.length, 'Google Ads conversion tag is installed.')
    when(good, profile || mapEmbed, 'Links to Google Maps / Business Profile.')
    when(good, reviewsWidget, 'Shows a reviews widget.')
    const score = scoreFrom(f)
    checks.push({
      id: 'google',
      title: 'Google stack',
      group: 'Search',
      score,
      findings: f,
      strengths: good,
      roast: roastLine(score, ["Google can barely tell this business exists, and you can't tell what Google sends you.", 'The Google basics are half set up.', 'The Google stack is wired up properly.']),
      facts: [
        ['GA4', ga4.join(', ') || 'Not found'],
        ['Tag Manager', gtm.join(', ') || 'Not found'],
        ['Google Ads tag', ads.join(', ') || 'Not found'],
        ['Business Profile link', yesNo(profile)],
        ['Map embed', yesNo(mapEmbed)],
        ['Reviews widget', yesNo(reviewsWidget)],
        ['Search Console tag', yesNo(verified)],
      ],
    })
  }

  // 8. Tracking & ad pixels
  {
    const found = matching(all, PIXELS).map(([n]) => n)
    const adPixels = found.filter((n) => /Meta|LinkedIn|TikTok|Pinterest|UET|Twitter|Snap|Reddit/.test(n))
    const f = []
    if (!adPixels.length) f.push(find('medium', "No ad pixels (Meta, Microsoft, LinkedIn…), so you can't retarget visitors or measure ad conversions.", 'Add the Meta Pixel (with Conversions API) before spending on ads, and track leads as conversions.'))
    if (!found.some((n) => /Clarity|Hotjar/.test(n))) f.push(find('low', 'No session-recording or heatmap tool.', 'Add Microsoft Clarity (free) to watch where visitors get stuck.'))
    if (!found.some((n) => /CallRail|WhatConverts/.test(n)) && phones.length) f.push(find('low', "Phone calls aren't tracked to their source.", 'Use call tracking so you know which channel made the phone ring.'))
    const score = scoreFrom(f)
    checks.push({
      id: 'pixels',
      title: 'Tracking & ad pixels',
      group: 'Leads',
      score,
      findings: f,
      strengths: found.length ? [`Tracking installed: ${found.join(', ')}.`] : [],
      facts: [['Found', found.join(', ') || 'None']],
      roast: roastLine(score, ['Every visitor leaves without a trace.', 'Some tracking, with blind spots.', 'Visitors and conversions are measured.']),
      note: "Pixels loaded through Tag Manager won't appear in the HTML.",
    })
  }

  // 9. SEO fundamentals
  {
    const f = []
    const rules = data.robots ? parseRobots(data.robots) : null
    if (rules && blocksAll(rules, '*')) f.push(find('critical', 'robots.txt blocks all search engines (Disallow: /).', 'Remove the site-wide Disallow unless this really is a private or staging site.'))
    const noindex = data.pages.filter((p) => p.noindex)
    if (noindex.some((p) => p === home)) f.push(find('critical', "The homepage is set to noindex, so it won't appear on Google.", 'Remove the noindex robots tag.'))
    else if (noindex.length) f.push(find('high', `${noindex.length} page(s) are set to noindex: ${noindex.slice(0, 3).map((p) => new URL(p.url).pathname).join(', ')}.`, 'Check these are meant to be hidden from Google.'))
    const noTitle = data.pages.filter((p) => !p.title)
    const longTitle = data.pages.filter((p) => p.title.length > 65)
    const noDesc = data.pages.filter((p) => !p.description)
    if (noTitle.length) f.push(find('high', `${noTitle.length} page(s) have no title tag.`, 'Give every page a unique title (50-60 characters) with its main keyword.'))
    if (longTitle.length) f.push(find('low', `${longTitle.length} title(s) are over 65 characters and will be cut off in Google.`, 'Shorten titles to around 55-60 characters.'))
    if (noDesc.length) f.push(find(noDesc.length > data.pages.length / 2 ? 'medium' : 'low', `${noDesc.length} of ${data.pages.length} pages have no meta description.`, 'Write a unique 140-160 character description for each page.'))
    const dupTitles = Object.entries(data.pages.reduce((m, p) => (p.title && (m[p.title] = (m[p.title] ?? 0) + 1), m), {})).filter(([, n]) => n > 1)
    if (dupTitles.length) f.push(find('medium', `Duplicate titles across pages: "${dupTitles[0][0].slice(0, 50)}"${dupTitles.length > 1 ? ` and ${dupTitles.length - 1} more` : ''}.`, "Make each page's title unique to what that page is about."))
    const badH1 = data.pages.filter((p) => p.h1s.length !== 1)
    if (!unreadable && badH1.length) f.push(find('medium', `${badH1.length} page(s) have ${badH1.some((p) => !p.h1s.length) ? 'no H1 or ' : ''}more than one H1.`, "Use exactly one H1 per page that matches the page's topic."))
    if (home.canonical) {
      if (/staging|vercel\.app|netlify\.app|pages\.dev|localhost/i.test(home.canonical)) f.push(find('critical', `The canonical points at a staging URL (${home.canonical}).`, 'Point canonicals at the live domain.'))
    } else f.push(find('low', 'No canonical tag on the homepage.', 'Add a self-referencing canonical tag to every page to avoid duplicate-content issues.'))
    if (!data.sitemapFound) f.push(find('medium', 'No XML sitemap found.', 'Publish /sitemap.xml and submit it in Search Console.'))
    if (!data.robots) f.push(find('low', 'No robots.txt file.', 'Add a robots.txt that links to your sitemap.'))
    if (!home.ogImage) f.push(find('low', 'No Open Graph image, so shared links look bare on social media and in messages.', 'Add og:title, og:description and a 1200×630 og:image.'))
    const imageCount = data.pages.reduce((n, p) => n + p.images, 0)
    const noAlt = data.pages.reduce((n, p) => n + p.imagesNoAlt, 0)
    if (noAlt > 3) f.push(find('low', `${noAlt} of ${imageCount} images have no alt text.`, 'Describe each meaningful image in its alt text.'))
    const longDesc = data.pages.filter((p) => p.description.length > 165)
    if (longDesc.length) f.push(find('low', `${longDesc.length} meta description(s) run over 165 characters and get cut off.`, 'Keep descriptions to 140-160 characters.'))
    if (Object.values(data.pages.reduce((m, p) => (p.description && (m[p.description] = (m[p.description] ?? 0) + 1), m), {})).some((n) => n > 1)) f.push(find('low', 'Several pages share the same meta description.', 'Write a unique description for each page.'))
    const good = []
    when(good, data.sitemapFound, `XML sitemap found (${data.sitemapCount} URLs).`)
    when(good, data.robots && !(rules && blocksAll(rules, '*')), 'robots.txt lets search engines in.')
    when(good, !noTitle.length && !dupTitles.length, 'Every page scanned has its own title.')
    when(good, !unreadable && !badH1.length, 'Exactly one H1 on every page scanned.')
    when(good, home.canonical && !/staging|vercel\.app|netlify\.app|pages\.dev/i.test(home.canonical), 'Canonical tags point at the live domain.')
    when(good, schema.length, `Structured data present (${schema.slice(0, 4).join(', ')}).`)
    when(good, home.ogImage, 'Open Graph image set for social sharing.')
    const own = scoreFrom(f)
    const score = psiM?.seo != null ? clamp(0.7 * own + 0.3 * psiM.seo) : own
    checks.push({
      id: 'seo',
      title: 'SEO fundamentals',
      group: 'Search',
      score,
      findings: f,
      strengths: good,
      roast: roastLine(score, ['Google is being given every reason to skip this site.', 'The basics are mostly there, with gaps that cost rankings.', 'Solid on-page SEO foundations.']),
      facts: [
        ['Pages checked', String(data.pages.length)],
        ['Sitemap', data.sitemapFound ? `${data.sitemapCount} URLs` : 'Not found'],
        ['robots.txt', data.robots ? 'Found' : 'Missing'],
        ['Schema types', schema.slice(0, 6).join(', ') || 'None'],
        ['Google SEO score', psiM?.seo != null ? `${psiM.seo}/100` : '–'],
      ],
    })
  }

  // 10. AI search visibility
  {
    const f = []
    const rules = data.robots ? parseRobots(data.robots) : null
    const blocked = rules ? AI_CRAWLERS.filter((c) => blocksAll(rules, c)) : []
    if (blocked.length)
      f.push(find(blocked.some((c) => /OAI-SearchBot|ChatGPT-User|PerplexityBot|Claude-SearchBot/.test(c)) ? 'high' : 'low', `robots.txt blocks AI crawlers: ${blocked.join(', ')}.`, 'Allow AI search crawlers (OAI-SearchBot, PerplexityBot, Claude-SearchBot) if you want to be recommended in ChatGPT, Perplexity and Claude answers.'))
    if (!data.llms) f.push(find('low', 'No llms.txt file.', 'Add /llms.txt: a short plain-text summary of who you are, what you offer and your key pages, for AI assistants.'))
    if (data.js)
      f.push(find('critical', `The homepage HTML is an empty JavaScript shell (~${data.js.rawWords} words before JavaScript runs). AI crawlers and link previews don't run JavaScript, so they see a blank page.`, 'Pre-render or server-render the content (e.g. vite-plugin-ssr/prerender, Next.js, Astro) so the HTML carries the real text.'))
    else if (home.words < 100) f.push(find('high', "Almost no text in the raw HTML, so AI crawlers (which mostly don't run JavaScript) see an empty page.", 'Render the main content on the server (or pre-render), not only with JavaScript.'))
    if (!schema.length) f.push(find('medium', 'No structured data for AI and search engines to read.', 'Add Organization/LocalBusiness, Service and FAQ schema.'))
    const faq = /faq|frequently asked/i.test(all)
    if (!faq) f.push(find('low', 'No FAQ content.', 'Answer the questions customers actually ask. AI answers love clear Q&A.'))
    const good = []
    when(good, !blocked.length, 'AI crawlers are allowed in robots.txt.')
    when(good, data.llms, 'Publishes an llms.txt for AI assistants.')
    when(good, !data.js && home.words >= 300, 'Main content is readable without JavaScript.')
    when(good, faq, 'Has FAQ content AI answers can quote.')
    const score = scoreFrom(f)
    checks.push({
      id: 'ai-visibility',
      title: 'AI search visibility',
      group: 'Search',
      score,
      findings: f,
      strengths: good,
      roast: roastLine(score, ["When someone asks ChatGPT for a recommendation, this site isn't in the conversation.", "AI assistants can read you, but you're not making it easy.", 'Ready to be found and quoted by AI search.']),
      facts: [
        ['llms.txt', data.llms ? 'Found' : 'Missing'],
        ['AI crawlers blocked', blocked.join(', ') || 'None'],
        ['Text in raw HTML', `${data.js?.rawWords ?? home.words} words`],
      ],
    })
  }

  // 11. Performance
  {
    const f = []
    for (const a of failing(psiM, 'performance').sort((x, y) => x.score - y.score).slice(0, 5))
      f.push(find(a.score < 0.5 ? 'medium' : 'low', `${a.title}${a.display ? ` (${a.display})` : ''}`, 'See Google PageSpeed Insights for the exact files involved.'))
    if (psiM) {
      if ((psiM.field.lcp ?? psiM.lab.lcp ?? 0) > 4000)
        f.unshift(find('high', `The main content takes ${ms(psiM.field.lcp ?? psiM.lab.lcp)} to appear on mobile.`, 'Compress and properly size the hero image, preload it, and cut render-blocking scripts. Target under 2.5s.'))
    } else {
      if (data.home.ms > 1800) f.push(find('high', `The server took ${ms(data.home.ms)} to return the homepage HTML.`, 'Use page caching / a CDN; aim for under 0.8 seconds.'))
      if (home.bytes > 4e5) f.push(find('medium', `The homepage HTML alone is ${Math.round(home.bytes / 1024)} KB.`, 'Remove inline bloat (page-builder markup, inlined data).'))
      const scripts = (html.match(/<script[^>]+src=/gi) ?? []).length
      if (scripts > 25) f.push(find('medium', `${scripts} external scripts load on the homepage.`, 'Remove unused plugins and third-party scripts; defer the rest.'))
      const eager = imgs.filter((i) => i.getAttribute('loading') !== 'lazy').length
      if (imgs.length > 8 && eager > 0.7 * imgs.length) f.push(find('low', `${eager} of ${imgs.length} homepage images load immediately instead of lazily.`, 'Add loading="lazy" to images below the first screen.'))
    }
    const score = psiM ? clamp((psiM.perf ?? 0) * 0.65 + (psiD?.perf ?? psiM.perf ?? 0) * 0.35) : scoreFrom(f, 80)
    const good = []
    when(good, data.home.ms && data.home.ms < 800, `Fast server response (${ms(data.home.ms)}).`)
    when(good, psiM?.perf != null && psiM.perf >= 90, `Excellent mobile speed score (${psiM?.perf}/100).`)
    when(good, (psiM?.field.lcp ?? psiM?.lab.lcp ?? 99999) <= 2500, `Main content appears in ${ms(psiM?.field.lcp ?? psiM?.lab.lcp)} on mobile.`)
    checks.push({
      id: 'performance',
      title: 'Performance',
      group: 'Speed & mobile',
      score,
      findings: f,
      strengths: good,
      note: psiM ? undefined : "Estimated from server timing only: Google PageSpeed couldn't run.",
      roast: roastLine(score, ['Visitors are watching a loading screen instead of your offer.', 'Fast enough on desktop, sluggish where it counts.', "Quick. Visitors aren't kept waiting."]),
      facts: [
        ['Mobile score', psiM?.perf != null ? `${psiM.perf}/100` : '–'],
        ['Desktop score', psiD?.perf != null ? `${psiD.perf}/100` : '–'],
        ['LCP (real users)', ms(psiM?.field.lcp)],
        ['INP (real users)', ms(psiM?.field.inp)],
        ['CLS', psiM?.field.cls != null ? psiM.field.cls.toFixed(2) : psiM?.lab.cls != null ? psiM.lab.cls.toFixed(2) : '–'],
        ['Server response', ms(data.home.ms)],
      ],
    })
  }

  // 12. Mobile experience
  {
    const f = []
    if (!/width=device-width/i.test(home.viewport)) f.push(find('critical', 'No mobile viewport tag, so phones show a shrunk desktop page.', 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.'))
    if (psiM?.perf != null && psiM.perf < 50) f.push(find('high', `Mobile speed score is ${psiM.perf}/100. Most visitors are on phones.`, 'Prioritise mobile speed: lighter images, fewer scripts.'))
    for (const a of [...failing(psiM, 'accessibility'), ...failing(psiM, 'seo')].filter((x) => /tap|target|font|viewport|content-width/i.test(x.id)).slice(0, 3))
      f.push(find('medium', a.title, 'Fix this in the mobile layout; check it on a real phone.'))
    if (!unreadable && !phones.length) f.push(find('medium', 'No tap-to-call link for phone visitors.', 'Put a click-to-call button in the mobile header.'))
    const unsized = imgs.filter((i) => !i.getAttribute('width') || !i.getAttribute('height')).length
    if (unsized > 4) f.push(find('low', `${unsized} homepage images have no width/height, so the page jumps as they load.`, 'Set width and height (or aspect-ratio) on every image.'))
    const good = []
    when(good, /width=device-width/i.test(home.viewport), 'Responsive viewport set for phones.')
    when(good, phones.length, 'Tap-to-call available on mobile.')
    when(good, psiM?.perf != null && psiM.perf >= 75, `Good mobile speed (${psiM?.perf}/100).`)
    const score = scoreFrom(f)
    checks.push({
      id: 'mobile',
      title: 'Mobile experience',
      group: 'Speed & mobile',
      score,
      findings: f,
      strengths: good,
      roast: roastLine(score, ['On a phone, this site is a chore.', "Works on mobile, but doesn't feel built for it.", 'Phone visitors get a good experience.']),
      facts: [
        ['Viewport tag', yesNo(/width=device-width/i.test(home.viewport))],
        ['Mobile speed', psiM?.perf != null ? `${psiM.perf}/100` : '–'],
        ['Tap-to-call', yesNo(!!phones.length)],
      ],
    })
  }

  // 13. Security
  {
    const f = []
    if (!https) f.push(find('critical', 'The site doesn\'t load over HTTPS. Browsers mark it "Not secure".', "Install an SSL certificate (free via Let's Encrypt or Cloudflare) and redirect all traffic to HTTPS."))
    else if (data.httpCheck && !data.httpCheck.finalUrl.startsWith('https:')) f.push(find('high', "http:// doesn't redirect to https://.", 'Force a 301 redirect from HTTP to HTTPS.'))
    if (data.safeBrowsing) f.push(find('critical', 'Google Safe Browsing flags this site as dangerous.', 'Clean the malware immediately, then request a review in Search Console.'))
    const exposed = Object.entries(data.probes).filter(([, v]) => v).map(([k]) => k)
    for (const path of exposed)
      f.push(
        find(
          /\.env|\.git/.test(path) ? 'critical' : path.includes('users') ? 'high' : 'medium',
          `${path} is publicly accessible${/\.env/.test(path) ? ' and may leak passwords and API keys' : /\.git/.test(path) ? ', so the source code can be downloaded' : path.includes('users') ? ', which lists admin usernames for attackers' : path.includes('xmlrpc') ? ', a common brute-force target' : ''}.`,
          `Block ${path} at the server or firewall${/\.env|\.git/.test(path) ? ' and rotate every secret it contained' : ''}.`,
        ),
      )
    if (https && !header('strict-transport-security')) f.push(find('medium', 'No HSTS header.', 'Add Strict-Transport-Security so browsers always use HTTPS.'))
    if (!header('content-security-policy')) f.push(find('low', 'No Content-Security-Policy header.', 'Add a CSP to limit which scripts can run (protects against injected code).'))
    if (!header('x-frame-options') && !/frame-ancestors/i.test(header('content-security-policy') ?? '')) f.push(find('low', "The site can be embedded in other sites' frames (clickjacking).", 'Send X-Frame-Options: SAMEORIGIN.'))
    if (!header('x-content-type-options')) f.push(find('low', 'No X-Content-Type-Options header.', 'Send X-Content-Type-Options: nosniff.'))
    const poweredBy = header('x-powered-by')
    const versions = [server && /\d/.test(server) ? `Server: ${server}` : '', poweredBy ? `X-Powered-By: ${poweredBy}` : '', (html.match(/<meta[^>]+generator[^>]+content="([^"]*\d[^"]*)"/i) ?? [])[1] ?? ''].filter(Boolean)
    if (versions.length) f.push(find('low', `Software versions are advertised (${versions.join('; ')}).`, "Hide version numbers so attackers can't match known exploits."))
    if (https && /<(?:script|img|iframe|link)[^>]+(?:src|href)=["']http:\/\//i.test(html)) f.push(find('medium', 'Mixed content: the HTTPS page loads files over plain HTTP.', 'Change every http:// asset URL to https://.'))
    if (data.home.cookies.some((c) => !/secure/.test(c))) f.push(find('low', 'Cookies are set without the Secure flag.', 'Mark cookies Secure and HttpOnly.'))
    if (data.dns && !data.dns.dmarc) f.push(find('medium', 'No DMARC record, so anyone can send email pretending to be this domain.', 'Publish a DMARC record (start with p=none, move to quarantine).'))
    if (data.dns && data.dns.mx.length && !data.dns.spf) f.push(find('medium', 'No SPF record, so your own emails are more likely to land in spam.', 'Publish an SPF record listing the services that send your email.'))
    if (data.rdap?.expires && Date.parse(data.rdap.expires) - Date.now() < 30 * 864e5) f.push(find('high', `The domain expires on ${data.rdap.expires.slice(0, 10)}.`, 'Renew the domain and turn on auto-renew.'))
    const good = []
    when(good, https && (!data.httpCheck || data.httpCheck.finalUrl.startsWith('https:')), 'HTTPS everywhere, with HTTP redirected.')
    when(good, header('strict-transport-security'), 'HSTS forces secure connections.')
    when(good, header('content-security-policy'), 'Content-Security-Policy in place.')
    when(good, !exposed.length, 'No exposed .env, .git, user lists or open folders found.')
    when(good, data.dns?.spf && data.dns?.dmarc, "SPF and DMARC protect the domain's email.")
    when(good, data.safeBrowsing === false, 'Clean on Google Safe Browsing.')
    const own = scoreFrom(f)
    const score = data.observatory ? clamp(0.75 * own + 0.25 * data.observatory.score) : own
    checks.push({
      id: 'security',
      title: 'Security',
      group: 'Security & trust',
      score,
      findings: f,
      strengths: good,
      roast: roastLine(score, ['The front door is locked, but the windows are wide open.', 'Reasonably safe, with a few gaps an attacker would like.', 'Security basics are handled.']),
      facts: [
        ['HTTPS', yesNo(https)],
        ['Mozilla Observatory', data.observatory ? `${data.observatory.grade} (${data.observatory.score}/100)` : '–'],
        ['Exposed files', exposed.join(', ') || 'None found'],
        ['Safe Browsing', data.safeBrowsing == null ? '–' : data.safeBrowsing ? 'FLAGGED' : 'Clean'],
        ['SPF / DMARC', data.dns ? `${data.dns.spf ? 'Yes' : 'No'} / ${data.dns.dmarc ? 'Yes' : 'No'}` : '–'],
      ],
    })
  }

  // 14. Authority & backlinks
  {
    const f = []
    const age = data.rdap?.created ? (Date.now() - Date.parse(data.rdap.created)) / 315576e5 : null
    const rank = data.authority?.pageRank
    if (rank != null && rank < 2.5) f.push(find('medium', `Domain authority is low (${rank.toFixed(1)}/10 on Open PageRank).`, 'Earn links: Google Business Profile, local directories, suppliers, industry associations, local press and partners.'))
    if (age != null && age < 1) f.push(find('low', 'The domain is under a year old, so search engines trust it less for now.', 'Keep publishing and building citations; age helps over time.'))
    const socials = ['facebook.com', 'instagram.com', 'linkedin.com', 'youtube.com', 'tiktok.com', 'x.com/', 'twitter.com'].filter((s) => all.includes(s))
    if (!unreadable && socials.length < 2) f.push(find('low', 'Few or no social profiles linked.', 'Link active social profiles. They reinforce that the business is real and active.'))
    const score = scoreFrom(f, rank != null ? 30 + 9 * rank : age != null ? Math.min(85, 50 + 4 * age) : 70)
    const good = []
    when(good, rank != null && rank >= 4, `Strong domain authority (${rank?.toFixed(1)}/10).`)
    when(good, age != null && age >= 3, `An established domain (${age?.toFixed(0)} years old).`)
    when(good, socials.length >= 2, `Linked social profiles: ${socials.map((s) => s.replace(/\.com\/?|\/$/, '')).join(', ')}.`)
    checks.push({
      id: 'authority',
      title: 'Authority & backlinks',
      group: 'Search',
      score,
      findings: f,
      strengths: good,
      note: rank == null ? 'Backlink authority is not available for this domain. Scored from domain age only.' : 'Referring-domain counts need a paid backlink provider.',
      roast: roastLine(score, ['The rest of the internet barely vouches for this site.', 'Some authority, not enough to beat established competitors.', 'Well established and well linked.']),
      facts: [
        ['Open PageRank', rank != null ? `${rank.toFixed(1)}/10` : '–'],
        ['Global rank', data.authority?.rank ? `#${data.authority.rank.toLocaleString()}` : '–'],
        ['Domain age', age != null ? `${age.toFixed(1)} years` : '–'],
        ['Registrar', data.rdap?.registrar ?? '–'],
        ['Social profiles', socials.map((s) => s.replace(/\.com\/?|\/$/, '')).join(', ') || 'None'],
      ],
    })
  }

  // 15. Trust & credibility
  {
    const f = []
    const links = clickables.map((c) => `${c.text} ${c.href}`).join(' ').toLowerCase()
    const privacy = /privacy/.test(links)
    const reviews = /testimonial|review|★|5[- ]star|stars?\b|rated/i.test(all)
    const ratingSchema = schema.some((t) => /AggregateRating|Review/i.test(t))
    const address = schema.some((t) => /PostalAddress/i.test(t)) || /streetAddress|\b\d{1,5}\s+\w+(\s\w+)?\s+(st|street|rd|road|ave|avenue|dr|drive|blvd|lane|ln|way|ct|court|pl|place|hwy|highway)\b/i.test(text)
    const credentials = /licen[cs]ed|insured|certified|accredited|award|member of|registered|guarantee|warranty|years of experience|since \d{4}/i.test(text)
    const year = new Date().getFullYear()
    const copyright = (text.match(/(?:©|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/i) ?? [])[1]
    if (!reviews) f.push(find('high', 'No reviews or testimonials on the pages scanned.', 'Show real reviews (ideally your Google reviews) near every call to action.'))
    if (!privacy) f.push(find('medium', 'No privacy policy link.', "Add a privacy policy. It's required in most countries if you collect form data."))
    if (!address) f.push(find('medium', 'No business address found.', 'Show your address or service area in the footer and in LocalBusiness schema.'))
    if (!phones.length && !/\+?\d[\d\s()-]{7,}\d/.test(text)) f.push(find('high', 'No phone number visible.', 'Display a phone number in the header and footer.'))
    if (!credentials) f.push(find('low', 'No licences, insurance, guarantees or experience mentioned.', 'State credentials and guarantees plainly. They remove the risk of choosing you.'))
    if (copyright && Number(copyright) < year - 1) f.push(find('low', `The footer says © ${copyright}, so the site looks abandoned.`, 'Update the copyright year (or generate it automatically).'))
    const about = /about|our story|who we are|team/.test(links)
    if (!about) f.push(find('low', 'No About / Team page linked.', 'Show the people behind the business. Buyers hire people, not logos.'))
    const good = []
    when(good, reviews, 'Reviews or testimonials on the site.')
    when(good, ratingSchema, 'Review/rating schema can show stars in Google.')
    when(good, address, 'A business address is shown.')
    when(good, privacy, 'Privacy policy linked.')
    when(good, credentials, 'Mentions credentials, guarantees or experience.')
    when(good, about, 'Has an About / Team page.')
    checks.push(
      withAi('trust', 'Trust & credibility', 'Security & trust', ai?.trust, {
        score: scoreFrom(f),
        findings: f,
        strengths: good,
        facts: [
          ['Reviews / testimonials', yesNo(reviews)],
          ['Rating schema', yesNo(ratingSchema)],
          ['Address', yesNo(address)],
          ['Privacy policy', yesNo(privacy)],
          ['Credentials mentioned', yesNo(credentials)],
          ['Copyright year', copyright ?? '–'],
        ],
        lines: ['Nothing here gives a stranger a reason to trust you with their money.', 'Some proof, but not enough to win over a cautious buyer.', "Plenty of proof that you're the real deal."],
      }),
    )
  }

  // 16. Accessibility
  {
    const f = []
    if (!home.lang) f.push(find('medium', "The page doesn't declare its language.", 'Add lang="en" (or the right language) to the <html> tag for screen readers.'))
    const fields = [...doc.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea')]
    const unlabelled = fields.filter((el) => !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && !(el.id && doc.querySelector(`label[for="${CSS.escape(el.id)}"]`)) && !el.closest('label'))
    if (unlabelled.length) f.push(find('medium', `${unlabelled.length} form field(s) have no label (placeholders vanish when typing and aren't read reliably).`, 'Give every field a visible <label>.'))
    if (home.imagesNoAlt) f.push(find('low', `${home.imagesNoAlt} homepage image(s) have no alt attribute.`, 'Add alt text to meaningful images and alt="" to decorative ones.'))
    const nameless = [...doc.querySelectorAll('a[href], button')].filter((el) => !(el.textContent ?? '').trim() && !el.getAttribute('aria-label') && !el.getAttribute('title') && !el.querySelector("img[alt]:not([alt=''])")).length
    if (nameless) f.push(find('medium', `${nameless} link(s) or button(s) have no readable name (icon-only), so screen readers announce nothing.`, 'Add an aria-label to every icon-only link and button.'))
    for (const a of failing(psiM, 'accessibility').slice(0, 4)) f.push(find('low', a.title, 'Details in Google PageSpeed Insights › Accessibility.'))
    const good = []
    when(good, home.lang, `Page language declared (${home.lang}).`)
    when(good, fields.length && !unlabelled.length, 'Every form field has a label.')
    when(good, imgs.length && !home.imagesNoAlt, 'Every homepage image has alt text.')
    when(good, psiM?.a11y != null && psiM.a11y >= 90, `Strong Google accessibility score (${psiM?.a11y}/100).`)
    const own = scoreFrom(f)
    const score = psiM?.a11y != null ? clamp(0.6 * psiM.a11y + 0.4 * own) : own
    checks.push({
      id: 'accessibility',
      title: 'Accessibility',
      group: 'Security & trust',
      score,
      findings: f,
      strengths: good,
      roast: roastLine(score, ["A chunk of visitors simply can't use this site.", 'Usable for most, frustrating for some.', 'Accessible and considerate.']),
      facts: [
        ['Google accessibility score', psiM?.a11y != null ? `${psiM.a11y}/100` : '–'],
        ['Language set', home.lang || 'No'],
        ['Unlabelled fields', String(unlabelled.length)],
      ],
    })
  }

  // 17. Technical health
  {
    const f = []
    if (broken.length)
      f.push(find(broken.length > 5 ? 'high' : 'medium', `${broken.length} broken internal link(s): ${broken.slice(0, 3).map((l) => `${new URL(l.url).pathname} (${l.status || 'no response'})`).join(', ')}.`, 'Fix or redirect every broken URL.'))
    if (unverified.length > 2) f.push(find('low', `${unverified.length} internal URL(s) didn't respond in time, so they couldn't be verified.`, 'Open a few by hand; slow or rate-limited pages hurt visitors too.'))
    if (data.home.chain.length > 2) f.push(find('low', `The homepage goes through ${data.home.chain.length - 1} redirects before loading.`, 'Redirect straight to the final URL in one hop.'))
    if (data.soft404 && data.soft404.status === 200) f.push(find('medium', 'Missing pages return "200 OK" instead of 404 (soft 404s).', 'Make unknown URLs return a real 404 status with a helpful page.'))
    const psi = psiM ?? psiD
    const consoleErrors = psi?.failing.find((a) => a.id === 'errors-in-console')
    if (consoleErrors) f.push(find('medium', 'JavaScript errors appear in the browser console.', 'Open DevTools › Console, then fix or remove the failing scripts. Errors can silently break forms and tracking.'))
    for (const a of failing(psi, 'best-practices').filter((x) => x.id !== 'errors-in-console').slice(0, 3)) f.push(find('low', a.title, 'Details in Google PageSpeed Insights › Best Practices.'))
    if (platforms.includes('WordPress')) {
      const version = (html.match(/content="WordPress ([\d.]+)"/i) ?? [])[1]
      f.push(find('low', `WordPress site${version ? ` (v${version})` : ''}: plugins and core need regular updates.`, 'Keep core, theme and plugins updated, and remove unused plugins.'))
    }
    if (!doc.querySelector('link[rel~="icon" i], link[rel="shortcut icon" i], link[rel="apple-touch-icon" i]')) f.push(find('low', 'No favicon declared, so browser tabs and bookmarks show a blank icon.', 'Add a favicon and an Apple touch icon.'))
    const inlineKb = Math.round([...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].reduce((n, m) => n + m[1].length, 0) / 1024)
    if (inlineKb > 150) f.push(find('low', `${inlineKb} KB of inline script is embedded in the homepage HTML.`, 'Move bulky inline data and scripts into cached files.'))
    const good = []
    when(good, data.links.length && !broken.length, `All ${data.links.length} internal URLs tested work.`)
    when(good, data.soft404?.status === 404, 'Missing pages correctly return 404.')
    when(good, data.home.chain.length <= 2, 'Homepage loads without a redirect chain.')
    when(good, !consoleErrors && psi, 'No JavaScript console errors.')
    const score = scoreFrom(f)
    checks.push({
      id: 'technical',
      title: 'Technical health',
      group: 'Security & trust',
      score,
      findings: f,
      strengths: good,
      roast: roastLine(score, ['Under the hood, things are quietly breaking.', 'Mostly healthy, with loose ends.', 'Technically clean.']),
      facts: [
        ['URLs checked', String(data.links.length)],
        ['Broken', String(broken.length)],
        ['Unverified', String(unverified.length)],
        ['Redirect hops', String(Math.max(0, data.home.chain.length - 1))],
        ['Missing pages return', data.soft404 ? String(data.soft404.status) : '–'],
        ['Platform', platforms.join(', ') || 'Unknown'],
      ],
    })
  }

  // What can't be read from an empty JavaScript shell is left unscored rather than guessed.
  if (unreadable)
    for (const c of checks)
      if (['forms-crm', 'chatbot', 'pixels'].includes(c.id) && !c.strengths.length) Object.assign(c, { score: null, findings: [], roast: "Couldn't tell from the code.", note: unreadableNote })

  // ---- the overall score
  const WEIGHT = { 'first-impression': 1.2, design: 1, copy: 1, conversion: 1.4, 'forms-crm': 1.2, chatbot: 0.6, google: 1, pixels: 0.6, seo: 1.2, 'ai-visibility': 0.8, performance: 1.2, mobile: 1.2, security: 1.1, authority: 0.8, trust: 1.2, accessibility: 0.8, technical: 1 }
  const scored = checks.filter((c) => c.score != null)
  const allFindings = checks.flatMap((c) => c.findings)
  const penalty = 4 * allFindings.filter((x) => x.severity === 'critical').length + 2 * allFindings.filter((x) => x.severity === 'high').length
  const overall = clamp(scored.reduce((s, c) => s + c.score * WEIGHT[c.id], 0) / scored.reduce((s, c) => s + WEIGHT[c.id], 0) - penalty)
  const ranked = [...scored].sort((a, b) => a.score - b.score)
  const weakest = ranked.slice(0, 3)
  const strongest = ranked.slice(-2).reverse()
  const firstFix = allFindings.sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity))[0]
  const summary =
    ai?.summary ??
    [
      !data.js
        ? ''
        : data.js.rendered
          ? `Heads up: ${data.host} builds the whole page with JavaScript. We loaded it in a real browser to judge what visitors see, but AI crawlers and link previews that don't run JavaScript still get an empty page.`
          : `Heads up: ${data.host} builds the whole page with JavaScript and it couldn't be rendered this time, so content, conversion and trust are left unscored rather than guessed.`,
      `${data.host} scores ${overall}/100. ${weakest[0].roast}`,
      `It's strongest on ${strongest.map((c) => c.title).join(' and ')}, and weakest on ${weakest.map((c) => `${c.title} (${c.score})`).join(', ')}.`,
      firstFix ? `Start here: ${firstFix.issue.replace(/\.$/, '')}. ${firstFix.fix}` : '',
    ]
      .join(' ')
      .trim()
  const fixes = checks
    .flatMap((c) => c.findings.map((x) => ({ ...x, check: c.title, w: WEIGHT[c.id] })))
    .filter((x) => x.severity !== 'low')
    .sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) || b.w - a.w)
    .slice(0, 10)
    .map(({ severity, issue, fix, check }) => ({ severity, issue, fix, check }))

  return {
    checks,
    overall,
    verdict: overall >= 80 ? 'Solid. Polish the details.' : overall >= 60 ? 'Leaking leads.' : 'Costing you business.',
    summary,
    tech: [...new Set(platforms)],
    fixes,
  }
}

export const gradeOf = (n) => (n >= 90 ? 'A' : n >= 80 ? 'B' : n >= 65 ? 'C' : n >= 50 ? 'D' : 'F')
export const labelOf = (n) => (n == null ? 'Not scored' : n >= 90 ? 'Excellent' : n >= 75 ? 'Good' : n >= 60 ? 'Decent' : n >= 40 ? 'Needs work' : 'Critical')
export const scoreColour = (n) => (n == null ? '#8d887f' : n >= 75 ? '#2bd48f' : n >= 60 ? '#e8a33d' : n >= 40 ? '#ff7a45' : '#ef5a6f')
export const severityColour = { critical: '#ef5a6f', high: '#ff7a45', medium: '#e8a33d', low: '#8d887f' }
