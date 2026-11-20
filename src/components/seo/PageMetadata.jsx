import { useEffect } from 'react'
import { SITE_URL } from './siteConfig.js'

function upsertMeta(attribute, key, content) {
  let tag = document.querySelector(`meta[${attribute}="${key}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(attribute, key)
    document.head.append(tag)
  }
  tag.content = content
}

export default function PageMetadata({ title, description }) {
  useEffect(() => {
    document.title = `${title} | QuickTools`

    const canonicalUrl = new URL(window.location.pathname, SITE_URL).href
    upsertMeta('name', 'description', description)
    upsertMeta('property', 'og:title', document.title)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:type', 'website')
    upsertMeta('property', 'og:site_name', 'QuickTools')
    upsertMeta('property', 'og:url', canonicalUrl)
    upsertMeta('name', 'twitter:card', 'summary')
    upsertMeta('name', 'twitter:title', document.title)
    upsertMeta('name', 'twitter:description', description)

    let canonicalTag = document.querySelector('link[rel="canonical"]')
    if (!canonicalTag) {
      canonicalTag = document.createElement('link')
      canonicalTag.rel = 'canonical'
      document.head.append(canonicalTag)
    }
    canonicalTag.href = canonicalUrl
  }, [title, description])

  return null
}
