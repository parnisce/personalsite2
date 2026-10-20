import { FiArrowUpRight, FiStar } from 'react-icons/fi'
import { TbBrandGithub, TbCode, TbHistory, TbScale } from 'react-icons/tb'
import { formatCount, readingMinutes, renderMarkdown, shortDate, timeAgo } from '../lib/resources'

export function TagList({ tags, compact = false }) {
  if (!tags?.length) return null
  return (
    <ul className={`res-tags${compact ? ' is-compact' : ''}`}>
      {tags.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  )
}

export function RepoCard({ repo }) {
  if (!repo?.full_name) return null
  return (
    <a className="res-repo" href={repo.html_url} target="_blank" rel="noopener noreferrer">
      <span className="res-repo-head">
        <span className="res-repo-icon">
          <TbBrandGithub aria-hidden="true" />
        </span>
        <span>
          <small>GitHub repo</small>
          <strong>{repo.full_name}</strong>
        </span>
        <FiArrowUpRight aria-hidden="true" />
      </span>
      <dl>
        <div>
          <dt>
            <FiStar aria-hidden="true" /> Stars
          </dt>
          <dd>{formatCount(repo.stars)}</dd>
        </div>
        <div>
          <dt>
            <TbCode aria-hidden="true" /> Language
          </dt>
          <dd>{repo.language || '—'}</dd>
        </div>
        <div>
          <dt>
            <TbScale aria-hidden="true" /> Licence
          </dt>
          <dd>{repo.license || '—'}</dd>
        </div>
        <div>
          <dt>
            <TbHistory aria-hidden="true" /> Updated
          </dt>
          <dd>{repo.pushed_at ? timeAgo(repo.pushed_at) : '—'}</dd>
        </div>
      </dl>
    </a>
  )
}

// One article, used on the public page and in the admin's live preview.
export function ResourceArticle({ resource }) {
  const minutes = readingMinutes(resource.body ?? '')
  return (
    <article className="res-article">
      <TagList tags={resource.tags} />
      <h1>{resource.title || 'Untitled resource'}</h1>
      {resource.summary && <p className="res-lede">{resource.summary}</p>}
      <RepoCard repo={resource.github} />
      <div className="res-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(resource.body) }} />
      <p className="res-meta">
        {resource.published_at && <>{shortDate(resource.published_at)} · </>}
        {minutes} min read
      </p>
    </article>
  )
}

export function ResourceCard({ resource }) {
  return (
    <a className="res-card" href={`#/${resource.slug}`}>
      <TagList tags={resource.tags} compact />
      <h2>{resource.title}</h2>
      <p>{resource.summary}</p>
      <span className="res-card-foot">
        <span className="res-card-repo">
          {resource.github?.full_name && (
            <>
              <FiStar aria-hidden="true" />
              <span>
                {formatCount(resource.github.stars)} · {resource.github.full_name}
              </span>
            </>
          )}
        </span>
        <span className="res-card-date">
          {shortDate(resource.published_at)} · {readingMinutes(resource.body ?? '')} min
        </span>
      </span>
    </a>
  )
}
