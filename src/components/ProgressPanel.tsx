import {
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from 'solid-js'
import { isActiveDay } from '../shared/activity'
import {
  buildProgressDays,
  formatInteraction,
  type ProgressDay,
  periodAccuracy,
} from '../shared/progress'
import type { StorageShape } from '../shared/types'

const RANGE_DAYS = 30

export function ProgressPanel(props: {
  storage: StorageShape
  onStudy: () => void
}) {
  const stats = () => props.storage.userStats
  const days = createMemo(() =>
    buildProgressDays(stats().dailyReviewHistory, RANGE_DAYS),
  )
  const time = () => formatInteraction(stats().timeInLanguageContactMs)
  const hasActivity = () =>
    stats().dailyReviewHistory.some(isActiveDay) ||
    stats().timeInLanguageContactMs > 0

  return (
    <div class="progress-main">
      <div class="stat-block progress-metric">
        <span>Взаимодействие с языком</span>
        <strong class="progress-metric-value">{time().value}</strong>
        <span>{time().unit} всего</span>
      </div>
      <Show
        when={hasActivity()}
        fallback={<ProgressEmpty onStudy={props.onStudy} />}
      >
        <ProgressCharts days={days()} />
      </Show>
    </div>
  )
}

function ProgressEmpty(props: { onStudy: () => void }) {
  return (
    <div class="progress-empty">
      <div class="progress-empty-ghost" aria-hidden="true">
        <For each={[30, 55, 40, 70, 50, 85, 65]}>
          {(height) => <i style={{ height: `${height}%` }} />}
        </For>
      </div>
      <h3>Здесь появится ваш прогресс</h3>
      <p>
        Ответьте на задание в браузере или пройдите несколько карточек — мы
        покажем взаимодействие с языком и точность по дням.
      </p>
      <button type="button" class="onboarding-next" onClick={props.onStudy}>
        Изучать слова
      </button>
    </div>
  )
}

// Geometry in CSS pixels; the SVG is drawn at its measured width.
const LEFT = 40
const RIGHT = 44
const BAR_TOP = 8
const BAR_HEIGHT = 120
const PANEL_GAP = 60
const LINE_HEIGHT = 96
const AXIS_HEIGHT = 24
const LINE_TOP = BAR_TOP + BAR_HEIGHT + PANEL_GAP
const TOTAL_HEIGHT = LINE_TOP + LINE_HEIGHT + AXIS_HEIGHT
const MINUTE_STEPS = [2, 4, 6, 10, 20, 30, 40, 60, 90, 120, 180, 240, 360]

function ProgressCharts(props: { days: ProgressDay[] }) {
  let frame!: HTMLDivElement
  const [width, setWidth] = createSignal(640)
  const [hover, setHover] = createSignal<number | null>(null)
  onMount(() => {
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(280, Math.floor(entry.contentRect.width)))
    })
    observer.observe(frame)
    onCleanup(() => observer.disconnect())
  })

  const minutes = (day: ProgressDay) => (day.durationMs ?? 0) / 60_000
  const maxMinutes = createMemo(() => {
    const max = Math.max(0, ...props.days.map(minutes))
    return MINUTE_STEPS.find((step) => step >= max) ?? Math.ceil(max / 60) * 60
  })
  const band = () => (width() - LEFT - RIGHT) / props.days.length
  const center = (index: number) => LEFT + band() * (index + 0.5)
  const barWidth = () => Math.max(3, Math.min(24, band() - 4))
  const barY = (value: number) =>
    BAR_TOP + BAR_HEIGHT - (value / maxMinutes()) * BAR_HEIGHT
  const lineY = (accuracy: number) =>
    LINE_TOP + LINE_HEIGHT - accuracy * LINE_HEIGHT

  const accuracyPoints = createMemo(() =>
    props.days.flatMap((day, index) =>
      day.accuracy === null
        ? []
        : [{ index, x: center(index), y: lineY(day.accuracy) }],
    ),
  )
  // Connect only consecutive days: a gap means no answers that day.
  const accuracySegments = createMemo(() => {
    const segments: string[] = []
    let current = ''
    let previous = -2
    for (const point of accuracyPoints()) {
      if (point.index !== previous + 1 && current) {
        segments.push(current)
        current = ''
      }
      current += `${current ? 'L' : 'M'}${point.x},${point.y}`
      previous = point.index
    }
    if (current) segments.push(current)
    return segments.filter((segment) => segment.includes('L'))
  })
  const lastPoint = () => accuracyPoints().at(-1)
  const accuracy = () => periodAccuracy(props.days)
  const periodMinutes = () =>
    Math.round(props.days.reduce((sum, day) => sum + minutes(day), 0))
  const untracked = () => props.days.some((day) => day.durationMs === null)
  const tickDays = () =>
    props.days.flatMap((day, index) =>
      (props.days.length - 1 - index) % 7 === 0 ? [{ day, index }] : [],
    )

  const hovered = () => {
    const index = hover()
    return index === null ? undefined : props.days[index]
  }
  // Sit beside the crosshair, flipping left in the right half of the chart.
  const tooltipFlipped = () => center(hover() ?? 0) > width() / 2
  const tooltipLeft = () => center(hover() ?? 0) + (tooltipFlipped() ? -12 : 12)

  return (
    <figure class="progress-charts">
      <div class="progress-chart-titles">
        <figcaption>
          <span>Взаимодействие с языком, мин в день</span>
          <strong class="progress-chart-total">
            {periodMinutes()} мин за 30 дней
          </strong>
        </figcaption>
      </div>
      <div
        ref={frame}
        class="progress-chart-frame"
        onPointerLeave={() => setHover(null)}
      >
        <svg
          width={width()}
          height={TOTAL_HEIGHT}
          viewBox={`0 0 ${width()} ${TOTAL_HEIGHT}`}
          role="img"
          aria-label={`Взаимодействие с языком: ${periodMinutes()} мин за ${RANGE_DAYS} дней. Точность: ${accuracy() === null ? 'нет ответов' : `${Math.round((accuracy() ?? 0) * 100)}%`}.`}
        >
          <title>Взаимодействие с языком и точность по дням</title>
          {/* Minutes panel */}
          <For each={[0, maxMinutes() / 2, maxMinutes()]}>
            {(tick) => (
              <>
                <line
                  class="chart-grid"
                  x1={LEFT}
                  x2={width() - RIGHT}
                  y1={barY(tick)}
                  y2={barY(tick)}
                />
                <text
                  class="chart-tick"
                  x={LEFT - 8}
                  y={barY(tick)}
                  text-anchor="end"
                  dominant-baseline="middle"
                >
                  {tick}
                </text>
              </>
            )}
          </For>
          <For each={props.days}>
            {(day, index) => {
              const height = () =>
                Math.max(
                  day.durationMs ? 2 : 0,
                  (minutes(day) / maxMinutes()) * BAR_HEIGHT,
                )
              return (
                <Show when={height() > 0}>
                  <path
                    class="chart-bar"
                    classList={{ dim: hover() !== null && hover() !== index() }}
                    d={roundedTopBar(
                      center(index()) - barWidth() / 2,
                      BAR_TOP + BAR_HEIGHT - height(),
                      barWidth(),
                      height(),
                    )}
                  />
                </Show>
              )
            }}
          </For>

          {/* Accuracy panel */}
          <text class="chart-panel-title" x={0} y={LINE_TOP - 24}>
            Точность, % верных
          </text>
          <Show when={accuracy() !== null}>
            <text
              class="chart-panel-total"
              x={width()}
              y={LINE_TOP - 24}
              text-anchor="end"
            >
              {Math.round((accuracy() ?? 0) * 100)}% за 30 дней
            </text>
          </Show>
          <For each={[0, 0.5, 1]}>
            {(tick) => (
              <>
                <line
                  class="chart-grid"
                  x1={LEFT}
                  x2={width() - RIGHT}
                  y1={lineY(tick)}
                  y2={lineY(tick)}
                />
                <text
                  class="chart-tick"
                  x={LEFT - 8}
                  y={lineY(tick)}
                  text-anchor="end"
                  dominant-baseline="middle"
                >
                  {tick * 100}
                </text>
              </>
            )}
          </For>
          <For each={accuracySegments()}>
            {(segment) => <path class="chart-line" d={segment} />}
          </For>
          <For each={accuracyPoints()}>
            {(point) => (
              <circle
                class="chart-dot"
                classList={{ active: hover() === point.index }}
                cx={point.x}
                cy={point.y}
                r={4}
              />
            )}
          </For>
          <Show when={lastPoint()}>
            {(point) => (
              <text
                class="chart-end-label"
                x={point().x + 10}
                y={point().y}
                dominant-baseline="middle"
              >
                {Math.round((props.days[point().index]?.accuracy ?? 0) * 100)}%
              </text>
            )}
          </Show>

          {/* Shared date axis */}
          <For each={tickDays()}>
            {(tick) => (
              <text
                class="chart-tick"
                x={center(tick.index)}
                y={LINE_TOP + LINE_HEIGHT + 16}
                text-anchor="middle"
              >
                {shortDate(tick.day.date)}
              </text>
            )}
          </For>

          {/* Crosshair and hit targets spanning both panels */}
          <Show when={hover() !== null}>
            <line
              class="chart-crosshair"
              x1={center(hover() ?? 0)}
              x2={center(hover() ?? 0)}
              y1={BAR_TOP}
              y2={LINE_TOP + LINE_HEIGHT}
            />
          </Show>
          <For each={props.days}>
            {(_, index) => (
              <rect
                class="chart-hit"
                x={LEFT + band() * index()}
                y={0}
                width={band()}
                height={LINE_TOP + LINE_HEIGHT}
                onPointerEnter={() => setHover(index())}
              />
            )}
          </For>
        </svg>
        <Show when={hovered()}>
          {(day) => (
            <div
              class="chart-tooltip"
              classList={{ flip: tooltipFlipped() }}
              style={{ left: `${tooltipLeft()}px`, top: `${BAR_TOP}px` }}
              aria-hidden="true"
            >
              <strong class="chart-tooltip-date">{longDate(day().date)}</strong>
              <span>{dayTimeText(day())}</span>
              <span>{dayAccuracyText(day())}</span>
              <Show when={day().studied > 0}>
                <span>Карточек: {day().studied}</span>
              </Show>
            </div>
          )}
        </Show>
      </div>
      <Show when={untracked()}>
        <p class="progress-note">
          Взаимодействие по дням считается с версии 0.2.4; для более ранних дней
          видна только точность.
        </p>
      </Show>
    </figure>
  )
}

function roundedTopBar(x: number, y: number, width: number, height: number) {
  const radius = Math.min(4, width / 2, height)
  return `M${x},${y + height}V${y + radius}Q${x},${y} ${x + radius},${y}H${
    x + width - radius
  }Q${x + width},${y} ${x + width},${y + radius}V${y + height}Z`
}

function dayTimeText(day: ProgressDay) {
  if (day.durationMs === null) return 'Взаимодействие не записано'
  const value = Math.round(day.durationMs / 60_000)
  return day.durationMs > 0 && value === 0
    ? 'Взаимодействие: меньше минуты'
    : `Взаимодействие: ${value} мин`
}

function dayAccuracyText(day: ProgressDay) {
  if (day.accuracy === null) return 'Заданий не было'
  return `Верно ${day.correct} из ${day.answered} · ${Math.round(day.accuracy * 100)}%`
}

function shortDate(date: Date) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
  }).format(date)
}

function longDate(date: Date) {
  return new Intl.DateTimeFormat('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  }).format(date)
}
