import { describe, it, expect } from 'vitest'
import { BreadcrumbBuffer } from '@getmonitor/core'
import { installBreadcrumbSources } from '../breadcrumbSources'

describe('installBreadcrumbSources', () => {
  it('records console.log calls as breadcrumbs', () => {
    const buffer = new BreadcrumbBuffer()
    installBreadcrumbSources(buffer)

    console.log('hello world')

    const crumbs = buffer.getAll().filter((c) => c.category === 'console')
    expect(crumbs.some((c) => c.message.includes('hello world'))).toBe(true)
  })

  it('records console.warn calls with level "warning"', () => {
    const buffer = new BreadcrumbBuffer()
    installBreadcrumbSources(buffer)

    console.warn('careful')

    const crumb = buffer.getAll().find((c) => c.message.includes('careful'))
    expect(crumb?.level).toBe('warning')
  })

  it('records click events with a CSS-selector-like description', () => {
    const buffer = new BreadcrumbBuffer()
    installBreadcrumbSources(buffer)

    const button = document.createElement('button')
    button.id = 'submit'
    document.body.appendChild(button)
    button.click()

    const crumbs = buffer.getAll().filter((c) => c.category === 'ui.click')
    expect(crumbs.some((c) => c.message.includes('#submit'))).toBe(true)
  })

  it('records a navigation breadcrumb on history.pushState', () => {
    const buffer = new BreadcrumbBuffer()
    installBreadcrumbSources(buffer)

    history.pushState({}, '', '/next-page')

    const crumbs = buffer.getAll().filter((c) => c.category === 'navigation')
    expect(crumbs.length).toBeGreaterThan(0)
  })
})
