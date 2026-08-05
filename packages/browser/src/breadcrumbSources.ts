import { BreadcrumbBuffer } from '@getmonitor/core'

export function installBreadcrumbSources(buffer: BreadcrumbBuffer): void {
  installConsoleBreadcrumbs(buffer)
  installNavigationBreadcrumbs(buffer)
  installClickBreadcrumbs(buffer)
}

function installConsoleBreadcrumbs(buffer: BreadcrumbBuffer): void {
  ;(['log', 'info', 'warn'] as const).forEach((level) => {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      original(...args)
      buffer.add({
        category: 'console',
        message: args.map(String).join(' '),
        level: level === 'warn' ? 'warning' : 'info',
      })
    }
  })
}

function installNavigationBreadcrumbs(buffer: BreadcrumbBuffer): void {
  const record = () => buffer.add({ category: 'navigation', message: window.location.href })

  window.addEventListener('popstate', record)

  const originalPushState = history.pushState.bind(history)
  history.pushState = (...args: Parameters<History['pushState']>) => {
    originalPushState(...args)
    record()
  }
}

function installClickBreadcrumbs(buffer: BreadcrumbBuffer): void {
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      buffer.add({ category: 'ui.click', message: describeElement(target) })
    },
    { capture: true }
  )
}

function describeElement(el: HTMLElement): string {
  const id = el.id ? `#${el.id}` : ''
  const cls = typeof el.className === 'string' && el.className ? `.${el.className.split(' ').join('.')}` : ''
  return `${el.tagName.toLowerCase()}${id}${cls}`
}
