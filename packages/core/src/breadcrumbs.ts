import { Breadcrumb } from './types'

export type BreadcrumbInput = Omit<Breadcrumb, 'timestamp'> & { timestamp?: string }

export class BreadcrumbBuffer {
  private buffer: Breadcrumb[] = []
  private readonly maxEntries: number

  constructor(maxEntries: number = 20) {
    this.maxEntries = maxEntries
  }

  add(breadcrumb: BreadcrumbInput): void {
    this.buffer.push({
      timestamp: breadcrumb.timestamp ?? new Date().toISOString(),
      category: breadcrumb.category,
      message: breadcrumb.message,
      data: breadcrumb.data,
      level: breadcrumb.level ?? 'log',
    })

    if (this.buffer.length > this.maxEntries) {
      this.buffer.shift()
    }
  }

  getAll(): Breadcrumb[] {
    return [...this.buffer]
  }

  clear(): void {
    this.buffer = []
  }
}
