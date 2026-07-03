// Monitoring middleware — tracks per-endpoint request metrics in memory
// No external dependencies, no DB — just a module-level Map

interface EndpointMetric {
  count: number
  totalMs: number
  errors4xx: number
  errors5xx: number
  lastMinute: number
  lastMinuteTimestamps: number[]
}

const metrics = new Map<string, EndpointMetric>()

const ID_PATTERN = /^[0-9a-fA-F]{24}$/
const CLERK_ID_PATTERN = /^user_/

function normalizePath(path: string): string {
  return path
    .split('/')
    .map((seg) =>
      ID_PATTERN.test(seg) || CLERK_ID_PATTERN.test(seg) || /^\d+$/.test(seg)
        ? ':id'
        : seg,
    )
    .join('/')
}

function pruneTimestamps(metric: EndpointMetric): void {
  const cutoff = Date.now() - 60000
  metric.lastMinuteTimestamps = metric.lastMinuteTimestamps.filter((t) => t > cutoff)
  metric.lastMinute = metric.lastMinuteTimestamps.length
}

export function monitoringMiddleware() {
  return async (c: any, next: any) => {
    const start = Date.now()
    const key = `${c.req.method}:${normalizePath(c.req.path)}`

    await next()

    const duration = Date.now() - start
    const status = c.res.status

    if (!metrics.has(key)) {
      metrics.set(key, {
        count: 0,
        totalMs: 0,
        errors4xx: 0,
        errors5xx: 0,
        lastMinute: 0,
        lastMinuteTimestamps: [],
      })
    }

    const metric = metrics.get(key)!
    metric.count++
    metric.totalMs += duration
    if (status >= 400 && status < 500) metric.errors4xx++
    if (status >= 500) metric.errors5xx++
    metric.lastMinuteTimestamps.push(Date.now())

    pruneTimestamps(metric)
  }
}

export function getMetrics() {
  for (const m of metrics.values()) pruneTimestamps(m)

  const entries: Record<string, Omit<EndpointMetric, 'lastMinuteTimestamps'> & { avgMs: number }> = {}
  let totalRequests = 0
  let totalMs = 0
  let total4xx = 0
  let total5xx = 0

  for (const [key, metric] of metrics) {
    entries[key] = {
      count: metric.count,
      totalMs: metric.totalMs,
      errors4xx: metric.errors4xx,
      errors5xx: metric.errors5xx,
      lastMinute: metric.lastMinute,
      avgMs: metric.count > 0 ? Math.round(metric.totalMs / metric.count) : 0,
    }
    totalRequests += metric.count
    totalMs += metric.totalMs
    total4xx += metric.errors4xx
    total5xx += metric.errors5xx
  }

  return {
    metrics: entries,
    summary: {
      totalRequests,
      avgResponseTime: totalRequests > 0 ? Math.round(totalMs / totalRequests) : 0,
      errorRate4xx: totalRequests > 0 ? Math.round((total4xx / totalRequests) * 10000) / 100 : 0,
      errorRate5xx: totalRequests > 0 ? Math.round((total5xx / totalRequests) * 10000) / 100 : 0,
      activeEndpoints: metrics.size,
    },
  }
}

export function resetMetrics(): void {
  metrics.clear()
}
