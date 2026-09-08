import { createSignal, For, Show } from 'solid-js'
import {
  currentOnboardingStep,
  onboardingAction,
  onboardingSteps,
} from '../shared/onboarding'
import type { StorageShape } from '../shared/types'
import { OrganizationForm } from './Organization'

const labels = [
  'Что такое Bir Söz',
  'Где найти Bir Söz',
  'Организация',
  'Настройка Bir Söz',
  'Изучение слов',
  'Задания в браузере',
]
function ExtensionsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 11h-1V7a2 2 0 0 0-2-2h-4V4a2 2 0 0 0-4 0v1H5a2 2 0 0 0-2 2v4h1a2 2 0 0 1 0 4H3v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4h1a2 2 0 0 0 0-4Z" />
    </svg>
  )
}
export function Onboarding(props: {
  state: StorageShape
  refresh: () => unknown
  onOpenStudy: () => void
}) {
  const [error, setError] = createSignal('')
  const [busy, setBusy] = createSignal(false)
  const step = () => currentOnboardingStep(props.state)
  const index = () => onboardingSteps.indexOf(step() ?? 'intro')
  async function act(action: Parameters<typeof onboardingAction>[0]) {
    if (busy()) return
    setBusy(true)
    setError('')
    try {
      await onboardingAction(action)
      await props.refresh()
    } catch {
      setError('Не удалось сохранить шаг. Повторите действие.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Show when={step()}>
      <section class="onboarding" aria-label="Знакомство с Bir Söz">
        <header class="onboarding-header">
          <span class="onboarding-eyebrow">Первые шаги</span>
          <h2 class="section-heading">Знакомство с Bir Söz</h2>
        </header>
        <ol class="onboarding-steps" aria-label="Шаги знакомства">
          <For each={onboardingSteps}>
            {(key, i) => (
              <li
                classList={{
                  'is-current': step() === key,
                  'is-done':
                    Boolean(props.state.onboarding.steps[key]) &&
                    step() !== key,
                }}
                aria-current={step() === key ? 'step' : undefined}
              >
                <span class="onboarding-step-number" aria-hidden="true">
                  {props.state.onboarding.steps[key] && step() !== key
                    ? '✓'
                    : i() + 1}
                </span>
                <span>{labels[i()]}</span>
              </li>
            )}
          </For>
        </ol>
        <div class="onboarding-content" aria-live="polite">
          <span class="onboarding-eyebrow">
            Шаг {index() + 1} из {onboardingSteps.length}
          </span>
          <h3>{labels[index()]}</h3>
          <Show when={step() === 'intro'}>
            <p>
              Bir Söz помогает изучать казахские слова во время обычной работы в
              браузере. Небольшие задания появляются на страницах, а карточки
              позволяют повторять слова в удобном для вас темпе.
            </p>
            <p>
              Рекомендуем пройти первые шаги: вы узнаете, где найти расширение,
              выберете словари и познакомитесь с заданиями. Так вы сможете
              полноценно пользоваться Bir Söz.
            </p>
            <p class="onboarding-note">
              Если вы подключаетесь по заданию организации, обязательно пройдите
              все шаги. Знакомство с Bir Söz засчитывается только после
              завершения последнего шага.
            </p>
          </Show>
          <Show when={step() === 'popup'}>
            <p>
              Настройки расширения всегда под рукой: нажмите значок пазла в
              правом верхнем углу Chrome и выберите Bir Söz. Чтобы вернуться
              сюда, нажмите «Мой прогресс».
            </p>
            <figure
              class="onboarding-browser-guide"
              aria-label="Как открыть Bir Söz: Расширения → Bir Söz → Мой прогресс"
            >
              <div class="onboarding-browser-example">
                <div class="onboarding-browser-toolbar">
                  <span class="onboarding-address">Панель Chrome</span>
                  <span class="onboarding-extensions-icon">
                    <ExtensionsIcon />
                  </span>
                </div>
                <div class="onboarding-menu-example">
                  <strong>Расширения</strong>
                  <div class="onboarding-menu-choice">
                    <span>Bir Söz</span>
                    <span aria-hidden="true">→</span>
                  </div>
                </div>
              </div>
              <span class="onboarding-guide-arrow" aria-hidden="true">
                →
              </span>
              <div class="onboarding-popup-example">
                <strong>Bir Söz</strong>
                <span>Интервал заданий · Словари</span>
                <span class="onboarding-progress-example">Мой прогресс ↗</span>
              </div>
              <figcaption>Расширения → Bir Söz → Мой прогресс</figcaption>
            </figure>
          </Show>
          <Show when={step() === 'vocabulary'}>
            <p>
              Все доступные словари находятся ниже на этой странице. Посмотрите
              их и выберите подходящие: можно включить один или несколько
              наборов и менять выбор в любое время.
            </p>
            <a class="onboarding-secondary" href="#vocabularies">
              Посмотреть словари ниже ↓
            </a>
            <p>
              Выберите, как часто вы хотите видеть задания. Откройте Bir Söz
              через значок «Расширения» в панели Chrome и настройте ползунок
              «Между заданиями» в окне расширения.
            </p>
            <p>
              Подберите комфортный интервал, чтобы задания вписывались в вашу
              работу. Его можно изменить в любое время.
            </p>
            <p class="onboarding-note">
              Текущий интервал: {props.state.settings.cooldownMinutes} мин.
              Когда выберете словари и удобный интервал, вернитесь сюда и
              нажмите «Далее».
            </p>
          </Show>
          <Show when={step() === 'organization'}>
            <Show
              when={!props.state.organization}
              fallback={
                <p>
                  Подключение уже сохранено. Можно перейти к следующему шагу.
                </p>
              }
            >
              <OrganizationForm
                onConnected={() => void act({ action: 'connected' })}
              />
            </Show>
            <div class="onboarding-footer">
              <Show when={props.state.organization}>
                <button
                  class="onboarding-next"
                  type="button"
                  disabled={busy()}
                  onClick={() => act({ action: 'connected' })}
                >
                  Далее
                </button>
              </Show>
              <button
                class="onboarding-secondary"
                type="button"
                disabled={busy()}
                onClick={() => act({ action: 'skip-organization' })}
              >
                Пропустить — у меня нет кода
              </button>
            </div>
          </Show>
          <Show when={step() === 'cards'}>
            <p>
              Карточки помогают заучивать слова в удобном темпе. Переверните
              карточку, чтобы увидеть перевод, затем оцените, насколько уверенно
              вы помните слово.
            </p>
            <button
              type="button"
              class="onboarding-secondary"
              aria-haspopup="dialog"
              onClick={props.onOpenStudy}
            >
              Открыть изучение слов ↗
            </button>
            <p class="onboarding-note">
              Кнопка «Изучать слова» справа от настроек открывает это окно в
              любой момент. Завершать сессию сейчас не обязательно —
              познакомьтесь с карточками и нажмите «Далее».
            </p>
          </Show>
          <Show when={step() === 'browser'}>
            <p>
              Продолжайте пользоваться браузером. На обычных страницах будут
              появляться задания — ответьте на три из них.
            </p>
            <div class="onboarding-browser-progress">
              <For each={[1, 2, 3]}>
                {(n) => (
                  <progress
                    max={1}
                    value={props.state.onboarding.browserAnswers >= n ? 1 : 0}
                    aria-label={`Задание ${n}`}
                  />
                )}
              </For>
            </div>
            <Show
              when={props.state.onboarding.browserAnswers >= 3}
              fallback={
                <p class="onboarding-note">
                  Когда три ответа будут готовы, на значке Bir Söz появится ✓.
                  Вернитесь сюда через «Мой прогресс». Интервал заданий остаётся
                  прежним.
                </p>
              }
            >
              <p>
                Всё готово! Нажмите «Далее», чтобы завершить знакомство. Эта
                подсказка больше не появится.
              </p>
            </Show>
          </Show>
          <Show when={step() !== 'organization'}>
            <div class="onboarding-footer">
              <button
                class="onboarding-next"
                type="button"
                disabled={
                  busy() ||
                  (step() === 'browser' &&
                    props.state.onboarding.browserAnswers < 3)
                }
                onClick={() => {
                  const current = step()
                  if (current && current !== 'organization')
                    void act({ action: 'next', step: current })
                }}
              >
                Далее <span aria-hidden="true">→</span>
              </button>
            </div>
          </Show>
          <Show when={error()}>
            <p role="alert">{error()}</p>
          </Show>
        </div>
      </section>
    </Show>
  )
}
