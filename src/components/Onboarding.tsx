import { createSignal, For, Show } from 'solid-js'
import {
  currentOnboardingStep,
  onboardingAction,
  onboardingSteps,
} from '../shared/onboarding'
import type { StorageShape } from '../shared/types'
import { OrganizationSection } from './Organization'
import { StudySection } from './Study'

const labels = [
  'Вернуться через popup',
  'Выбрать словари',
  'Код организации',
  'Пять карточек',
  'Три задания в браузере',
]
export function Onboarding(props: {
  state: StorageShape
  refresh: () => unknown
}) {
  const [selection, setSelection] = createSignal<string[] | null>(null)
  const [error, setError] = createSignal('')
  const step = () => currentOnboardingStep(props.state)
  const selected = () => selection() ?? props.state.activeVocabularyIds
  async function act(action: Parameters<typeof onboardingAction>[0]) {
    try {
      await onboardingAction(action)
      await props.refresh()
      setError('')
    } catch {
      setError('Не удалось сохранить шаг. Повторите действие.')
    }
  }
  return (
    <Show when={step()}>
      <section
        class="grid gap-4 border border-rule p-6 my-6"
        aria-label="Знакомство с Bir söz"
      >
        <h2 class="section-heading">Знакомство с Bir söz</h2>
        <ol>
          <For each={onboardingSteps}>
            {(key, index) => (
              <li>
                {index() + 1}. {labels[index()]} —{' '}
                {props.state.onboarding.steps[key] === 'skipped'
                  ? 'пропущено'
                  : props.state.onboarding.steps[key]
                    ? 'готово'
                    : step() === key
                      ? 'текущий шаг'
                      : 'впереди'}
              </li>
            )}
          </For>
        </ol>
        <Show when={step() === 'popup'}>
          <p>
            Нажмите значок расширений в панели Chrome → Bir Söz → «Мой
            прогресс», чтобы вернуться сюда.
          </p>
        </Show>
        <Show when={step() === 'vocabulary'}>
          <p>
            Можно включить несколько словарей. Выберите хотя бы один из A1, A2,
            B1, затем подтвердите выбор.
          </p>
          <Show
            when={props.state.catalogVersion !== null}
            fallback={
              <>
                <p>Ожидаем загрузку словарей. Проверьте сеть.</p>
                <button
                  type="button"
                  onClick={async () => {
                    await chrome.runtime.sendMessage({
                      type: 'bir-soz:sync-catalog',
                    })
                    await props.refresh()
                  }}
                >
                  Повторить загрузку
                </button>
              </>
            }
          >
            <For each={props.state.vocabularies.filter((v) => v.isRemote)}>
              {(v) => (
                <label class="flex gap-2">
                  <input
                    type="checkbox"
                    checked={selected().includes(v.id)}
                    onChange={(e) =>
                      setSelection(
                        e.currentTarget.checked
                          ? [...selected(), v.id]
                          : selected().filter((id) => id !== v.id),
                      )
                    }
                  />
                  {v.name}
                </label>
              )}
            </For>
            <button
              type="button"
              class="dashboard-settings-button"
              disabled={!selected().length}
              onClick={() => act({ action: 'vocabulary', ids: selected() })}
            >
              Подтвердить словари
            </button>
          </Show>
        </Show>
        <Show when={step() === 'organization'}>
          <OrganizationSection
            organization={props.state.organization}
            onConnected={() => void act({ action: 'connected' })}
          />
          <Show when={props.state.organization}>
            <button type="button" onClick={() => act({ action: 'connected' })}>
              Продолжить с подключённой организацией
            </button>
          </Show>
          <button
            type="button"
            class="dashboard-settings-button"
            onClick={() => act({ action: 'skip-organization' })}
          >
            У меня нет кода
          </button>
        </Show>
        <Show when={step() === 'cards'}>
          <p>
            Переверните карточку и оцените уверенность. Пять оценок откроют
            следующий шаг.
          </p>
          <Show
            when={
              props.state.studySession?.completedAt === null &&
              (!props.state.studySession?.onboarding ||
                props.state.studySession?.onboardingRunId !==
                  props.state.onboarding.runId)
            }
          >
            <p>
              Сначала завершите сохранённую сессию, затем начните пять карточек
              знакомства.
            </p>
          </Show>
          <StudySection
            session={props.state.studySession}
            ready={props.state.catalogVersion !== null}
            onboarding
            refresh={props.refresh}
          />
        </Show>
        <Show when={step() === 'browser'}>
          <p>
            Продолжайте пользоваться браузером. Ответьте на три естественных
            задания: {props.state.onboarding.browserAnswers} из 3. Интервал
            остаётся прежним; его можно настроить в popup.
          </p>
        </Show>
        <Show when={error()}>
          <p role="alert">{error()}</p>
        </Show>
      </section>
    </Show>
  )
}
