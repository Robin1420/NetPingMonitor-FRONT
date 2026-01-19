import { useId } from "react"

const STATUS_COLORS = {
  UP: "#22c55e",
  DOWN: "#ef4444",
  UNKNOWN: "#94a3b8",
}

const formatTime = (value, includeSeconds = false) => {
  if (!value) return "--"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return parsed.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    second: includeSeconds ? "2-digit" : undefined,
  })
}

const buildSeries = (points) => {
  const values = points
    .map((point) => (typeof point?.l === "number" ? point.l : null))
    .filter((value) => value !== null)
  if (values.length === 0) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(1, max - min)
  let lastValue = values[0]
  const normalized = points.map((point) => {
    const value = typeof point?.l === "number" ? point.l : null
    if (value !== null) {
      lastValue = value
      return value
    }
    return lastValue
  })
  return { normalized, min, range }
}

function Sparkline({
  points = [],
  width = 160,
  height = 56,
  intervalSeconds = 5,
  labelEveryMinutes = 1,
  showAllLabels = false,
  yLabelFontSize = 8,
  xLabelFontSize = 7,
  paddingLeft: paddingLeftProp,
  labelHeight: labelHeightProp,
  showYAxisLabels = true,
  showSeconds = false,
}) {
  const uid = useId()

  if (!points.length) {
    return <span className="sparkline-empty">Sin datos</span>
  }

  const series = buildSeries(points)
  if (!series) {
    return <span className="sparkline-empty">Sin datos</span>
  }

  if (points.length === 1) {
    const singlePoint = points[0] || {}
    const status = singlePoint?.s || "UNKNOWN"
    const color = STATUS_COLORS[status] || STATUS_COLORS.UNKNOWN
    const latency =
      typeof singlePoint?.l === "number" ? `${singlePoint.l} ms` : "--"
    const loss =
      typeof singlePoint?.p === "number" ? `${singlePoint.p}%` : "--"
    return (
      <svg
        className="sparkline"
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <title>{`Estado: ${status} | Latencia: ${latency} | Perdida: ${loss}`}</title>
        <circle cx={width / 2} cy={height / 2} r="4" fill={color} />
      </svg>
    )
  }

  const defaultPaddingLeft = showYAxisLabels ? 72 : 12
  const paddingLeft = paddingLeftProp ?? defaultPaddingLeft
  const paddingRight = 8
  const paddingTop = 5
  const paddingBottom = 5
  const barHeight = 4
  const barGap = 8
  const labelHeight = labelHeightProp ?? 26
  const innerWidth = Math.max(1, width - paddingLeft - paddingRight)
  const chartHeight = Math.max(
    10,
    height - paddingTop - paddingBottom - barHeight - barGap - labelHeight,
  )
  const stepX = points.length > 1 ? innerWidth / (points.length - 1) : 0

  const pointPairs = series.normalized.map((value, index) => {
    const ratio = (value - series.min) / series.range
    const x = paddingLeft + index * stepX
    const y = paddingTop + chartHeight * (1 - ratio)
    return { x, y }
  })

  const linePoints = pointPairs.map((point) => `${point.x},${point.y}`).join(" ")
  const baselineY = paddingTop + chartHeight
  const areaPath = [
    `M ${pointPairs[0].x} ${pointPairs[0].y}`,
    ...pointPairs.slice(1).map((point) => `L ${point.x} ${point.y}`),
    `L ${pointPairs[pointPairs.length - 1].x} ${baselineY}`,
    `L ${pointPairs[0].x} ${baselineY}`,
    "Z",
  ].join(" ")

  const barWidth = innerWidth / points.length
  const barThickness = Math.max(1, barWidth * 0.5)
  const barY = baselineY + barGap
  const labelY = barY + barHeight + 4
  const lastPoint = points[points.length - 1]
  const lastStatus = lastPoint?.s || "UNKNOWN"
  const lastLatency =
    typeof lastPoint?.l === "number" ? `${lastPoint.l} ms` : "--"
  const lastLoss =
    typeof lastPoint?.p === "number" ? `${lastPoint.p}%` : "--"

  const tickIndexes = []
  if (showAllLabels) {
    points.forEach((_, index) => tickIndexes.push(index))
  } else {
    const labelStepMs = Math.max(1, labelEveryMinutes) * 60000
    let lastTickTime = null
    points.forEach((point, index) => {
      const rawTime =
        point?.t || point?.checked_at || point?.checkedAt || point?.timestamp
      const parsed = rawTime ? new Date(rawTime) : null
      const timeMs =
        parsed && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : null
      if (timeMs === null) {
        if (
          tickIndexes.length === 0 ||
          index % Math.max(1, intervalSeconds) === 0
        ) {
          tickIndexes.push(index)
        }
        return
      }
      if (lastTickTime === null || timeMs - lastTickTime >= labelStepMs) {
        tickIndexes.push(index)
        lastTickTime = timeMs
      }
    })
  }

  const yTicks = 3
  const yValues = Array.from({ length: yTicks }, (_, index) => {
    return series.min + (series.range * index) / (yTicks - 1)
  })

  return (
    <svg
      className="sparkline"
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <title>{`Estado: ${lastStatus} | Latencia: ${lastLatency} | Perdida: ${lastLoss}`}</title>
      <defs>
        <linearGradient id={`${uid}-fill`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(255, 68, 4, 0.28)" />
          <stop offset="100%" stopColor="rgba(255, 68, 4, 0)" />
        </linearGradient>
        <pattern
          id={`${uid}-grid`}
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 8 0 L 0 0 0 8"
            fill="none"
            stroke="rgba(255, 68, 4, 0.06)"
            strokeWidth="0.5"
          />
        </pattern>
        <pattern
          id={`${uid}-grid-major`}
          width="24"
          height="24"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 24 0 L 0 0 0 24"
            fill="none"
            stroke="rgba(255, 68, 4, 0.12)"
            strokeWidth="0.7"
          />
        </pattern>
      </defs>
      <rect
        x={paddingLeft}
        y={paddingTop}
        width={innerWidth}
        height={chartHeight}
        fill={`url(#${uid}-grid)`}
      />
      <rect
        x={paddingLeft}
        y={paddingTop}
        width={innerWidth}
        height={chartHeight}
        fill={`url(#${uid}-grid-major)`}
      />
      <path d={areaPath} fill={`url(#${uid}-fill)`} />
      {yValues.map((value, index) => {
        const ratio = (value - series.min) / series.range
        const y = paddingTop + chartHeight * (1 - ratio)
        return (
          <g key={`ytick-${index}`}>
            <line
              x1={paddingLeft}
              x2={paddingLeft + innerWidth}
              y1={y}
              y2={y}
              stroke="rgba(255, 68, 4, 0.18)"
              strokeWidth="0.6"
            />
            {showYAxisLabels ? (
              <text
                x={paddingLeft - 6}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={yLabelFontSize}
                fill="rgba(84, 70, 60, 0.85)"
              >
                {Math.round(value)} ms
              </text>
            ) : null}
          </g>
        )
      })}
      {tickIndexes.map((index) => {
        const x = paddingLeft + index * barWidth + barWidth / 2
        return (
          <line
            key={`xline-${index}`}
            x1={x}
            x2={x}
            y1={paddingTop}
            y2={baselineY}
            stroke="rgba(255, 68, 4, 0.12)"
            strokeWidth="0.5"
          />
        )
      })}
      <polyline
        fill="none"
        stroke="var(--accent-strong)"
        strokeWidth="0.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={linePoints}
      />
      {points.map((point, index) => {
        const status = point?.s || "UNKNOWN"
        const color = STATUS_COLORS[status] || STATUS_COLORS.UNKNOWN
        const x =
          paddingLeft + index * barWidth + (barWidth - barThickness) / 2
        return (
          <rect
            key={`${status}-${index}`}
            x={x}
            y={barY}
            width={barThickness}
            height={barHeight}
            fill={color}
            rx="1"
          />
        )
      })}
      {tickIndexes.map((index) => {
        const point = points[index]
        const timestamp =
          point?.t || point?.checked_at || point?.checkedAt || point?.timestamp
        const label = formatTime(timestamp, showSeconds)
        const x = paddingLeft + index * barWidth + barWidth / 2
        return (
          <text
            key={`xtick-${index}`}
            x={x}
            y={labelY}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize={xLabelFontSize}
            fill="rgba(84, 70, 60, 0.85)"
            transform={`rotate(-90 ${x} ${labelY})`}
          >
            {label}
          </text>
        )
      })}
    </svg>
  )
}

export default Sparkline
