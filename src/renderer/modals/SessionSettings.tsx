import NiceModal, { muiDialogV5, useModal } from '@ebay/nice-modal-react'
import { ActionIcon, FileButton, Flex, Stack, Switch, Text, Tooltip } from '@mantine/core'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material'
import { IconInfoCircle, IconTrash } from '@tabler/icons-react'
import { pick } from 'lodash'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { chatSessionSettings, pictureSessionSettings } from 'src/shared/defaults'
import {
  createMessage,
  isChatSession,
  isPictureSession,
  ModelProviderEnum,
  type Session,
  type SessionSettings,
} from 'src/shared/types'
import { Accordion, AccordionDetails, AccordionSummary } from '@/components/Accordion'
import { AssistantAvatar } from '@/components/Avatar'
import { handleImageInputAndSave } from '@/components/Image'
import ImageCountSlider from '@/components/ImageCountSlider'
import ImageStyleSelect from '@/components/ImageStyleSelect'
import LazyNumberInput from '@/components/LazyNumberInput'
import MaxContextMessageCountSlider from '@/components/MaxContextMessageCountSlider'
import ModelSelector from '@/components/ModelSelector'
import { ScalableIcon } from '@/components/ScalableIcon'
import SegmentedControl from '@/components/SegmentedControl'
import SliderWithInput from '@/components/SliderWithInput'
import { useProviders } from '@/hooks/useProviders'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { trackingEvent } from '@/packages/event'
import { StorageKeyGenerator } from '@/storage/StoreStorage'
import { updateSession } from '@/stores/chatStore'
import { getSessionMeta, mergeSettings } from '@/stores/sessionHelpers'
import { settingsStore, useSettingsStore } from '@/stores/settingsStore'
import { getMessageText } from '../../shared/utils/message'

const SessionSettingsModal = NiceModal.create(
  ({ session, disableAutoSave = false }: { session: Session; disableAutoSave?: boolean }) => {
    const modal = useModal()
    const { t } = useTranslation()
    const isSmallScreen = useIsSmallScreen()

    const [editingData, setEditingData] = useState<Session | null>(session || null)
    useEffect(() => {
      if (!session) {
        setEditingData(null)
      } else {
        setEditingData({
          ...session,
          settings: session.settings ? { ...session.settings } : undefined,
        })
      }
    }, [session])

    const [systemPrompt, setSystemPrompt] = useState('')
    useEffect(() => {
      if (!session) {
        setSystemPrompt('')
      } else {
        const systemMessage = session.messages.find((m) => m.role === 'system')
        setSystemPrompt(systemMessage ? getMessageText(systemMessage) : '')
      }
    }, [session])

    const onReset = (event: React.MouseEvent) => {
      event.stopPropagation()
      event.preventDefault()
      setEditingData((_editingData) =>
        _editingData
          ? {
              ..._editingData,
              settings: pick(_editingData.settings, ['provider', 'modelId']),
            }
          : _editingData
      )
    }

    useEffect(() => {
      if (session) {
        trackingEvent('chat_config_window', { event_category: 'screen_view' })
      }
    }, [session])

    const onCancel = () => {
      if (session) {
        setEditingData({
          ...session,
        })
      }
      modal.resolve()
      modal.hide()
    }

    const applySessionChanges = (target: Session) => {
      target.name = (target.name ?? '').trim() || session.name
      const trimmed = systemPrompt.trim()
      const messages = Array.isArray(target.messages) ? [...target.messages] : []
      if (trimmed === '') {
        target.messages = messages.filter((m) => m.role !== 'system')
      } else {
        const idx = messages.findIndex((m) => m.role === 'system')
        if (idx >= 0) {
          const sys = { ...messages[idx], contentParts: [{ type: 'text' as const, text: trimmed }] }
          target.messages = [...messages.slice(0, idx), sys, ...messages.slice(idx + 1)]
        } else {
          target.messages = [createMessage('system', trimmed), ...messages]
        }
      }
      return target
    }
    const onSave = () => {
      if (!session || !editingData) {
        return
      }

      if (!disableAutoSave) {
        void updateSession(editingData.id, (s) => {
          const merged = {
            ...(s ?? {}),
            ...getSessionMeta(editingData),
            settings: editingData.settings,
          } as Session

          return applySessionChanges(merged)
        })
      } else {
        applySessionChanges(editingData)
      }

      modal.resolve(editingData)
      modal.hide()
    }

    if (!session || !editingData) {
      return null
    }

    return (
      <Dialog
        {...muiDialogV5(modal)}
        onClose={() => {
          modal.resolve()
          modal.hide()
        }}
        fullWidth
      >
        <DialogTitle>{t('Conversation Settings')}</DialogTitle>
        <DialogContent>
          <FileButton
            accept="image/png,image/jpeg"
            onChange={(file) => {
              if (file) {
                const key = StorageKeyGenerator.picture(`assistant-avatar:${session?.id}`)
                handleImageInputAndSave(file, key, () => setEditingData({ ...editingData, assistantAvatarKey: key }))
              }
            }}
          >
            {(props) => (
              <Flex justify="center">
                <Flex className="relative">
                  <AssistantAvatar
                    size={isSmallScreen ? 64 : 80}
                    avatarKey={editingData.assistantAvatarKey}
                    picUrl={editingData.picUrl}
                    sessionType={editingData.type}
                    {...props}
                  />

                  {editingData.assistantAvatarKey && (
                    <ActionIcon
                      color="chatbox-error"
                      size={24}
                      radius="xl"
                      bottom={0}
                      right={0}
                      className="absolute"
                      onClick={() => {
                        setEditingData({ ...editingData, assistantAvatarKey: undefined })
                      }}
                    >
                      <ScalableIcon icon={IconTrash} size={18} />
                    </ActionIcon>
                  )}
                </Flex>
              </Flex>
            )}
          </FileButton>

          <TextField
            autoFocus={!isSmallScreen}
            margin="dense"
            label={t('name')}
            type="text"
            fullWidth
            variant="outlined"
            value={editingData.name}
            onChange={(e) => setEditingData({ ...editingData, name: e.target.value })}
          />
          <div className="mt-1">
            <TextField
              margin="dense"
              label={t('Instruction (System Prompt)')}
              placeholder={t('Copilot Prompt Demo') || ''}
              fullWidth
              variant="outlined"
              multiline
              minRows={2}
              maxRows={8}
              value={systemPrompt}
              onChange={(event) => setSystemPrompt(event.target.value)}
            />
          </div>

          <Accordion defaultExpanded={true} className="mt-2">
            <AccordionSummary aria-controls="panel1a-content">
              <div className="flex flex-row w-full justify-between items-center">
                <Typography>{t('Specific model settings')}</Typography>
              </div>
              {editingData.settings && (
                <Button size="small" variant="text" onClick={onReset}>
                  {t('Reset')}
                </Button>
              )}
            </AccordionSummary>
            <AccordionDetails>
              {isChatSession(session) && (
                <ChatConfig
                  settings={editingData.settings}
                  onSettingsChange={(d) =>
                    setEditingData((_data) => {
                      if (_data) {
                        return {
                          ..._data,
                          settings: {
                            ..._data?.settings,
                            ...d,
                          },
                        }
                      } else {
                        return null
                      }
                    })
                  }
                />
              )}
              {isPictureSession(session) && (
                <PictureConfig
                  settings={editingData.settings}
                  onSettingsChange={(d) =>
                    setEditingData((_data) => {
                      if (_data) {
                        return {
                          ..._data,
                          settings: {
                            ..._data?.settings,
                            ...d,
                          },
                        }
                      } else {
                        return null
                      }
                    })
                  }
                />
              )}
            </AccordionDetails>
          </Accordion>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancel}>{t('cancel')}</Button>
          <Button onClick={onSave}>{t('save')}</Button>
        </DialogActions>
      </Dialog>
    )
  }
)

export default SessionSettingsModal

interface ThinkingBudgetConfigProps {
  currentBudgetTokens: number
  isEnabled: boolean
  onConfigChange: (config: { budgetTokens: number; enabled: boolean }) => void
  tooltipText: string
  minValue?: number
  maxValue?: number
}

function ThinkingBudgetConfig({
  currentBudgetTokens,
  isEnabled,
  onConfigChange,
  tooltipText,
  minValue = 1024,
  maxValue = 10000,
}: ThinkingBudgetConfigProps) {
  const { t } = useTranslation()

  const PRESET_VALUES = useMemo(() => [2048, 5120, 10240], [])

  const thinkingBudgetOptions = useMemo(
    () => [
      { label: t('Disabled'), value: 'disabled' },
      { label: `${t('Low')} (2K)`, value: PRESET_VALUES[0].toString() },
      { label: `${t('Medium')} (5K)`, value: PRESET_VALUES[1].toString() },
      { label: `${t('High')} (10K)`, value: PRESET_VALUES[2].toString() },
      { label: t('Custom'), value: 'custom' },
    ],
    [t, PRESET_VALUES]
  )

  const [isCustomMode, setIsCustomMode] = useState(false)
  const [userSelectedCustom, setUserSelectedCustom] = useState(false)

  useEffect(() => {
    if (isEnabled) {
      const matchesPreset = PRESET_VALUES.includes(currentBudgetTokens)
      if (!matchesPreset && !isCustomMode && !userSelectedCustom) {
        setIsCustomMode(true)
      }
    } else {
      if (isCustomMode || userSelectedCustom) {
        setIsCustomMode(false)
        setUserSelectedCustom(false)
      }
    }
  }, [isEnabled, currentBudgetTokens, PRESET_VALUES, isCustomMode, userSelectedCustom])

  const getCurrentSegmentValue = useCallback(() => {
    if (!isEnabled) return 'disabled'

    if (isCustomMode || userSelectedCustom) return 'custom'

    const matchingPreset = PRESET_VALUES.find((preset) => preset === currentBudgetTokens)
    return matchingPreset ? matchingPreset.toString() : 'custom'
  }, [isEnabled, isCustomMode, userSelectedCustom, PRESET_VALUES, currentBudgetTokens])

  const handleThinkingConfigChange = useCallback(
    (value: string) => {
      if (value === 'disabled') {
        setIsCustomMode(false)
        setUserSelectedCustom(false)
        onConfigChange({ budgetTokens: 0, enabled: false })
      } else if (value === 'custom') {
        setIsCustomMode(true)
        setUserSelectedCustom(true)
        const customValue = currentBudgetTokens > 0 ? currentBudgetTokens : minValue || PRESET_VALUES[0]
        onConfigChange({ budgetTokens: customValue, enabled: true })
      } else {
        setIsCustomMode(false)
        setUserSelectedCustom(false)
        onConfigChange({ budgetTokens: parseInt(value), enabled: true })
      }
    },
    [currentBudgetTokens, minValue, PRESET_VALUES, onConfigChange]
  )

  const handleCustomBudgetChange = useCallback(
    (v: number | undefined) => {
      onConfigChange({ budgetTokens: v || minValue, enabled: true })
    },
    [minValue, onConfigChange]
  )

  const currentSegmentValue = getCurrentSegmentValue()

  return (
    <Stack gap="md">
      <Flex align="center" gap="xs">
        <Text size="sm" fw="600">
          {t('Thinking Budget')}
        </Text>
        <Tooltip
          label={tooltipText}
          withArrow={true}
          maw={320}
          className="!whitespace-normal"
          zIndex={3000}
          events={{ hover: true, focus: true, touch: true }}
        >
          <ScalableIcon icon={IconInfoCircle} size={20} className="text-[var(--mantine-color-chatbox-tertiary-text)]" />
        </Tooltip>
      </Flex>

      <SegmentedControl
        key="thinking-budget-control"
        value={currentSegmentValue}
        onChange={handleThinkingConfigChange}
        data={thinkingBudgetOptions}
      />

      {currentSegmentValue === 'custom' && (
        <SliderWithInput
          min={minValue}
          max={maxValue}
          step={1}
          value={currentBudgetTokens}
          onChange={handleCustomBudgetChange}
        />
      )}
    </Stack>
  )
}

function ClaudeProviderConfig({
  settings,
  onSettingsChange,
}: {
  settings: SessionSettings
  onSettingsChange: (data: Session['settings']) => void
}) {
  const { t } = useTranslation()
  const providerOptions = settings?.providerOptions?.claude

  const handleConfigChange = (config: { budgetTokens: number; enabled: boolean }) => {
    onSettingsChange({
      providerOptions: {
        claude: {
          thinking: {
            type: config.enabled ? 'enabled' : 'disabled',
            budgetTokens: config.budgetTokens,
          },
        },
      },
    })
  }

  return (
    <ThinkingBudgetConfig
      currentBudgetTokens={providerOptions?.thinking?.budgetTokens || 1024}
      isEnabled={providerOptions?.thinking?.type === 'enabled'}
      onConfigChange={handleConfigChange}
      tooltipText={t('Thinking Budget only works for 3.7 or later models')}
      minValue={1024}
      maxValue={10000}
    />
  )
}

function OpenAIProviderConfig({
  settings,
  onSettingsChange,
}: {
  settings: SessionSettings
  onSettingsChange: (data: Session['settings']) => void
}) {
  const { t } = useTranslation()
  const providerOptions = settings?.providerOptions?.openai

  const reasoningEffortOptions = useMemo(
    () => [
      { label: t('Disabled'), value: 'null' },
      { label: t('Low'), value: 'low' },
      { label: t('Medium'), value: 'medium' },
      { label: t('High'), value: 'high' },
    ],
    [t]
  )

  const handleReasoningEffortChange = useCallback(
    (value: string) => {
      const reasoningEffort = value === 'null' ? undefined : (value as 'low' | 'medium' | 'high')
      onSettingsChange({
        providerOptions: {
          openai: { reasoningEffort },
        },
      })
    },
    [onSettingsChange]
  )

  const currentValue = useMemo(() => {
    const effort = providerOptions?.reasoningEffort
    return effort === undefined ? 'null' : effort
  }, [providerOptions?.reasoningEffort])

  return (
    <Stack gap="md">
      <Flex align="center" gap="xs">
        <Text size="sm" fw="600">
          {t('Thinking Effort')}
        </Text>
        <Tooltip
          label={t('Thinking Effort only works for OpenAI o-series models')}
          withArrow={true}
          maw={320}
          className="!whitespace-normal"
          zIndex={3000}
          events={{ hover: true, focus: true, touch: true }}
        >
          <ScalableIcon icon={IconInfoCircle} size={20} className="text-[var(--mantine-color-chatbox-tertiary-text)]" />
        </Tooltip>
      </Flex>

      <SegmentedControl
        key="reasoning-effort-control"
        value={currentValue}
        onChange={handleReasoningEffortChange}
        data={reasoningEffortOptions}
      />
    </Stack>
  )
}

function GoogleProviderConfig({
  settings,
  onSettingsChange,
}: {
  settings: SessionSettings
  onSettingsChange: (data: Session['settings']) => void
}) {
  const { t } = useTranslation()
  const providerOptions = settings?.providerOptions?.google

  const handleConfigChange = (config: { budgetTokens: number; enabled: boolean }) => {
    onSettingsChange({
      providerOptions: {
        google: { thinkingConfig: { thinkingBudget: config.budgetTokens, includeThoughts: config.enabled } },
      },
    })
  }

  return (
    <ThinkingBudgetConfig
      currentBudgetTokens={providerOptions?.thinkingConfig?.thinkingBudget || 0}
      isEnabled={(providerOptions?.thinkingConfig?.thinkingBudget || 0) > 0}
      onConfigChange={handleConfigChange}
      tooltipText={t('Thinking Budget only works for 2.0 or later models')}
      minValue={0}
      maxValue={10000}
    />
  )
}

export function ChatConfig({
  settings,
  onSettingsChange,
}: {
  settings: Session['settings']
  onSettingsChange: (data: Session['settings']) => void
}) {
  const { t } = useTranslation()
  const globalSettingsStream = useSettingsStore((s) => s.stream)

  return (
    <Stack gap="md">
      <MaxContextMessageCountSlider
        value={settings?.maxContextMessageCount ?? chatSessionSettings().maxContextMessageCount!}
        onChange={(v) => onSettingsChange({ maxContextMessageCount: v })}
      />

      <Stack gap="xs">
        <Flex align="center" gap="xs">
          <Text size="sm" fw="600">
            {t('Temperature')}
          </Text>
          <Tooltip
            label={t(
              'Modify the creativity of AI responses; the higher the value, the more random and intriguing the answers become, while a lower value ensures greater stability and reliability.'
            )}
            withArrow={true}
            maw={320}
            className="!whitespace-normal"
            zIndex={3000}
            events={{ hover: true, focus: true, touch: true }}
          >
            <ScalableIcon
              icon={IconInfoCircle}
              size={20}
              className="text-[var(--mantine-color-chatbox-tertiary-text)]"
            />
          </Tooltip>
        </Flex>

        <SliderWithInput value={settings?.temperature} onChange={(v) => onSettingsChange({ temperature: v })} max={2} />
      </Stack>

      <Stack gap="xs">
        <Flex align="center" gap="xs">
          <Text size="sm" fw="600">
            Top P
          </Text>
          <Tooltip
            label={t(
              'The topP parameter controls the diversity of AI responses: lower values make the output more focused and predictable, while higher values allow for more varied and creative replies.'
            )}
            withArrow={true}
            maw={320}
            className="!whitespace-normal"
            zIndex={3000}
            events={{ hover: true, focus: true, touch: true }}
          >
            <ScalableIcon
              icon={IconInfoCircle}
              size={20}
              className="text-[var(--mantine-color-chatbox-tertiary-text)]"
            />
          </Tooltip>
        </Flex>

        <SliderWithInput value={settings?.topP} onChange={(v) => onSettingsChange({ topP: v })} max={1} />
      </Stack>

      <Flex justify="space-between" align="center">
        <Flex align="center" gap="xs">
          <Text size="sm" fw="600">
            {t('Max Output Tokens')}
          </Text>
          <Tooltip
            label={t(
              'Set the maximum number of tokens for model output. Please set it within the acceptable range of the model, otherwise errors may occur.'
            )}
            withArrow={true}
            maw={320}
            className="!whitespace-normal"
            zIndex={3000}
            events={{ hover: true, focus: true, touch: true }}
          >
            <ScalableIcon
              icon={IconInfoCircle}
              size={20}
              className="text-[var(--mantine-color-chatbox-tertiary-text)]"
            />
          </Tooltip>
        </Flex>

        <LazyNumberInput
          width={96}
          value={settings?.maxTokens}
          onChange={(v) => onSettingsChange({ maxTokens: typeof v === 'number' ? v : undefined })}
          min={0}
          step={1024}
          allowDecimal={false}
          placeholder={t('Not set') || ''}
        />
      </Flex>

      {settings?.provider !== ModelProviderEnum.ChatboxAI && (
        <Stack gap="xs" py="xs">
          <Flex align="center" justify="space-between" gap="xs">
            <Text size="sm" fw="600">
              {t('Stream output')}
            </Text>
            <Switch
              checked={settings?.stream ?? globalSettingsStream ?? true}
              onChange={(v) => onSettingsChange({ stream: v.target.checked })}
            />
          </Flex>
        </Stack>
      )}

      <Stack>
        {settings?.provider === ModelProviderEnum.Claude && (
          <ClaudeProviderConfig settings={settings} onSettingsChange={onSettingsChange} />
        )}
        {settings?.provider === ModelProviderEnum.OpenAI && (
          <OpenAIProviderConfig settings={settings} onSettingsChange={onSettingsChange} />
        )}
        {settings?.provider === ModelProviderEnum.Gemini && (
          <GoogleProviderConfig settings={settings} onSettingsChange={onSettingsChange} />
        )}
      </Stack>
    </Stack>
  )
}

function PictureConfig({
  settings,
  onSettingsChange,
}: {
  settings: Session['settings']
  onSettingsChange: (data: Session['settings']) => void
}) {
  const { t } = useTranslation()
  const { providers } = useProviders()
  const globalSettings = settingsStore.getState().getSettings()
  const sessionSettings = mergeSettings(globalSettings, settings || {}, 'picture')

  const modelSelectorDisplayText = useMemo(() => {
    const provider = sessionSettings.provider
    const modelId = sessionSettings.modelId
    if (!provider || !modelId) {
      return t('Select Model')
    }
    const providerInfo = providers.find((p) => p.id === provider)
    const modelInfo = (providerInfo?.models || providerInfo?.defaultSettings?.models)?.find((m) => m.modelId === modelId)
    return `${providerInfo?.name || provider} - ${modelInfo?.nickname || modelId}`
  }, [providers, sessionSettings.provider, sessionSettings.modelId, t])

  return (
    <Stack gap="md">
      <Stack gap="xs">
        <Text size="sm" fw="600">
          {t('Model')}
        </Text>
        <ModelSelector
          onSelect={(provider, model) => {
            onSettingsChange({
              provider: provider as string,
              modelId: model,
            })
          }}
          selectedProviderId={sessionSettings.provider}
          selectedModelId={sessionSettings.modelId}
        >
          <Button variant="light" fullWidth>
            {modelSelectorDisplayText}
          </Button>
        </ModelSelector>
      </Stack>

      <ImageStyleSelect
        value={sessionSettings.dalleStyle || pictureSessionSettings().dalleStyle!}
        onChange={(v) => onSettingsChange({ dalleStyle: v })}
        className={sessionSettings.dalleStyle === undefined ? 'opacity-50' : ''}
      />
      <ImageCountSlider
        value={sessionSettings.imageGenerateNum || pictureSessionSettings().imageGenerateNum!}
        onChange={(v) => onSettingsChange({ imageGenerateNum: v })}
        className={sessionSettings.imageGenerateNum === undefined ? 'opacity-50' : ''}
      />
    </Stack>
  )
}
