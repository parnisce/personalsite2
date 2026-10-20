import { fetchRepo, parseRepo } from './resources'

// Builds a first draft of a Resources write-up from a GitHub repo: tags from its topics, a
// summary from its description and a Markdown body assembled from its README. Everything it
// writes is meant to be edited; the "My take" section is left for your own words.

const SMALL_WORDS = new Set(['ai', 'ml', 'ui', 'ux', 'api', 'cli', 'mcp', 'sdk', 'llm', 'gpt', 'seo', 'css', 'html', 'php', 'sql', 'aws', 'ci', 'cd', 'ide', 'rag', 'vr', 'ar', 'os', 'db', 'cms', 'crm', 'hmr', 'ssr', 'ssg', 'orm', 'jwt', 'sql', 'npm', 'url', 'dom', 'tui', 'gui', 'iac', 'etl'])

export function prettyTag(topic) {
  return topic
    .split('-')
    .filter(Boolean)
    .map((w) => (SMALL_WORDS.has(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(' ')
}

export function prettyName(repoName) {
  return repoName
    .replace(/[-_.]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

async function fetchReadme(owner, repo) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, { headers: { Accept: 'application/vnd.github.raw+json' } })
  if (!res.ok) return ''
  return res.text()
}

// Absolute links, no HTML, no badges.
function cleanReadme(text, { owner, repo, branch }) {
  const raw = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/`
  const blob = `https://github.com/${owner}/${repo}/blob/${branch}/`
  const absolute = (url, image) => (/^(https?:|mailto:|#|data:)/i.test(url) ? url : (image ? raw : blob) + url.replace(/^\.?\//, ''))
  return text
    .replace(/\r/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?(?:details|summary|p|div|picture|source|center|br|sub|sup|a|img|h[1-6]|b|i|em|strong|span|table|tr|td|th|thead|tbody)\b[^>]*>/gi, '')
    .split('\n')
    .filter((line) => !/^\s*\[!\[.*\]\(.*\)\]\(.*\)\s*$/.test(line) && !/^\s*!\[[^\]]*\]\([^)]*(shields\.io|badge|img\.shields)[^)]*\)\s*$/i.test(line))
    .join('\n')
    .replace(/(!?)\[([^\]]*)\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g, (_, bang, label, url, title) => `${bang}[${label}](${absolute(url, Boolean(bang))}${title})`)
}

function sections(text) {
  const lines = text.split('\n')
  const out = [{ title: '', level: 0, lines: [] }]
  let fenced = false
  lines.forEach((line) => {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced
    const m = !fenced && /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(line)
    if (m) out.push({ title: m[2].replace(/[*_`]/g, '').trim(), level: m[1].length, lines: [] })
    else out[out.length - 1].lines.push(line)
  })
  const flat = out.map((s) => ({ ...s, body: s.lines.join('\n').trim() }))
  // A section's full text includes its sub-sections (### under ##), headed so they stay readable.
  return flat.map((s, i) => {
    const subs = []
    for (let j = i + 1; j < flat.length && flat[j].level > s.level; j += 1) subs.push(`### ${flat[j].title}\n\n${flat[j].body}`)
    return { ...s, full: [s.body, ...subs].filter(Boolean).join('\n\n') }
  })
}

// Cut at a paragraph or line break, and close an open code fence if the cut lands inside one.
function clip(text, max) {
  if (text.length <= max) return text
  let cut = text.slice(0, max)
  const stop = Math.max(cut.lastIndexOf('\n\n'), cut.lastIndexOf('\n'))
  if (stop > max * 0.5) cut = cut.slice(0, stop)
  if ((cut.match(/^\s*(```|~~~)/gm) ?? []).length % 2) cut += '\n```'
  return `${cut.trimEnd()}\n`
}

const demote = (text) => text.replace(/^#{1,6}\s+/gm, '### ')

const introOf = (secs, description) => {
  const before = secs.filter((s, i) => i === 0 || (i === 1 && s.level === 1)).map((s) => s.body).join('\n\n')
  const paragraphs = before
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p && !/^[-*]\s/.test(p) && !/^[|>`]/.test(p) && !/^!\[/.test(p) && p.length > 30 && !p.endsWith(':') && !p.includes('•') && !/^\s*\[[^\]]+\]\s*$/m.test(p))
  return paragraphs.slice(0, 2).join('\n\n').slice(0, 900) || description || ''
}

export async function draftFromRepo(url) {
  const parsed = parseRepo(url)
  const repo = await fetchRepo(url)
  const readme = await fetchReadme(parsed.owner, parsed.repo).catch(() => '')
  const secs = readme ? sections(cleanReadme(readme, { owner: parsed.owner, repo: parsed.repo, branch: repo.default_branch ?? 'main' })) : []

  const find = (re, skip = []) => secs.find((s) => s.level > 0 && re.test(s.title) && !skip.includes(s) && s.full.length > 20)
  const install = find(/install|getting started|quick ?start|set ?up/i)
  const features = find(/features?|highlights?|capabilities|what you get|why/i, [install])
  const usage = find(/usage|how to use|examples?/i, [install, features])

  const stars = repo.stars >= 1000 ? `${+(repo.stars / 1000).toFixed(1)}k` : String(repo.stars)
  const facts = [`**${repo.full_name}** has ${stars} stars on GitHub`, repo.language ? `is written mostly in ${repo.language}` : '', repo.license ? `and is released under the ${repo.license} licence` : '']
    .filter(Boolean)
    .join(', ')
    .replace(/, and/, ' and')

  const parts = []
  const intro = introOf(secs, repo.description)
  parts.push(intro || `${repo.full_name} on GitHub.`)
  parts.push(`## What is this repo\n\n${repo.description ? `${repo.description}\n\n` : ''}${facts}.`)
  if (features) parts.push(`## Key features\n\n${demote(clip(features.full, 1600))}`)
  if (install) parts.push(`## How to install\n\n${demote(clip(install.full, 2600))}`)
  if (usage) parts.push(`## How to use it\n\n${demote(clip(usage.full, 2000))}`)
  parts.push('## Where it fits in a real build\n\n_Add your own notes here: what you tried it on, what worked, and who it is for._')
  parts.push(`## Links\n\n- [${repo.full_name} on GitHub](${repo.html_url})`)

  const tags = (repo.topics ?? []).slice(0, 6).map(prettyTag)
  if (repo.language && tags.length < 3 && !tags.includes(repo.language)) tags.push(repo.language)

  return {
    repo,
    tags,
    title: prettyName(parsed.repo),
    summary: (repo.description ?? '').slice(0, 160),
    body: `${parts.join('\n\n')}\n`,
    foundReadme: Boolean(readme),
  }
}
