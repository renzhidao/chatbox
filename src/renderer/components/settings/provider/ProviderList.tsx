import { Button, Flex, Image, Indicator, ScrollArea, Stack, Text } from '@mantine/core'
import { IconChevronRight, IconFileImport, IconPlus } from '@tabler/icons-react'
import { Link, useRouterState } from '@tanstack/react-router'
import clsx from 'clsx'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProviderBaseInfo } from 'src/shared/types'
import CustomProviderIcon from '@/components/CustomProviderIcon'
import { ScalableIcon } from '@/components/ScalableIcon'
import { useProviders } from '@/hooks/useProviders'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import platform from '@/platform'

// 移动端兼容：使用动态 require 替代静态 import
const loadIcon = (name: string): string => {
  try {
    return require(`../../static/icons/providers/${name}.png`)
  } catch (e) {
    console.warn(`Provider icon not found: ${name}`)
    return ''
  }
}

const icons: Record<string, string> = {
  azure: loadIcon('azure'),
  'chatbox-ai': loadIcon('chatbox-ai'),
  'chatglm-6b': loadIcon('chatglm-6b'),
  claude: loadIcon('claude'),
  deepseek: loadIcon('deepseek'),
  gemini: loadIcon('gemini'),
  groq: loadIcon('groq'),
  'lm-studio': loadIcon('lm-studio'),
  'mistral-ai': loadIcon('mistral-ai'),
  ollama: loadIcon('ollama'),
  openai: loadIcon('openai'),
  openrouter: loadIcon('openrouter'),
  perplexity: loadIcon('perplexity'),
  siliconflow: loadIcon('siliconflow'),
  volcengine: loadIcon('volcengine'),
  xai: loadIcon('xAI'),
}

interface ProviderListProps {
  providers: ProviderBaseInfo[]
  onAddProvider: () => void
  onImportProvider: () => void
  isImporting: boolean
}

export function ProviderList({ providers, onAddProvider, onImportProvider, isImporting }: ProviderListProps) {
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()
  const routerState = useRouterState()

  const providerId = useMemo(() => {
    const pathSegments = routerState.location.pathname.split('/').filter(Boolean)
    const providerIndex = pathSegments.indexOf('provider')
    return providerIndex !== -1 ? pathSegments[providerIndex + 1] : undefined
  }, [routerState.location.pathname])

  const { providers: availableProviders } = useProviders()

  return (
    <Stack
      maw={isSmallScreen ? undefined : 256}
      className={clsx(
        'border-solid border-0 border-r border-[var(--mantine-color-chatbox-border-primary-outline)] ',
        isSmallScreen ? 'w-full border-r-0' : 'flex-[1_0_auto]'
      )}
      gap={0}
    >
      <ScrollArea flex={1} type={isSmallScreen ? 'never' : 'hover'} scrollHideDelay={100}>
        <Stack p={isSmallScreen ? 0 : 'xs'} gap={isSmallScreen ? 0 : 'xs'}>
          {providers.map((provider) => (
            <Link
              key={provider.id}
              to={provider.id === 'chatbox-ai' ? `/settings/provider/chatbox-ai` : `/settings/provider/$providerId`}
              params={{ providerId: provider.id }}
              className={clsx(
                'no-underline',
                isSmallScreen
                  ? 'border-solid border-0 border-b border-[var(--mantine-color-chatbox-border-primary-outline)]'
                  : ''
              )}
            >
              <Flex
                component="span"
                align="center"
                gap="xs"
                p="md"
                pr="xl"
                py={isSmallScreen ? 'sm' : undefined}
                c={provider.id === providerId ? 'chatbox-brand' : 'chatbox-secondary'}
                bg={provider.id === providerId ? 'var(--mantine-color-chatbox-brand-light)' : 'transparent'}
                className="cursor-pointer select-none rounded-md hover:!bg-[var(--mantine-color-chatbox-brand-outline-hover)]"
              >
                {provider.isCustom ? (
                  provider.iconUrl ? (
                    <Image w={36} h={36} src={provider.iconUrl} alt={provider.name} />
                  ) : (
                    <CustomProviderIcon providerId={provider.id} providerName={provider.name} size={36} />
                  )
                ) : (
                  <Image w={36} h={36} src={icons[provider.id]} alt={provider.name} />
                )}

                <Text
                  span
                  size="sm"
                  flex={isSmallScreen ? 1 : undefined}
                  className="!text-inherit whitespace-nowrap overflow-hidden text-ellipsis"
                >
                  {t(provider.name)}
                </Text>

                {!!availableProviders.find((p) => p.id === provider.id) && (
                  <Indicator
                    size={8}
                    color="chatbox-success"
                    className="ml-auto"
                    disabled={!availableProviders.find((p) => p.id === provider.id)}
                  />
                )}

                {isSmallScreen && (
                  <ScalableIcon
                    icon={IconChevronRight}
                    size={20}
                    className="!text-[var(--mantine-color-chatbox-tertiary-outline)] ml-2"
                  />
                )}
              </Flex>
            </Link>
          ))}
        </Stack>
      </ScrollArea>
      <Stack gap="xs" mx="md" my="sm">
        <Button variant="outline" leftSection={<ScalableIcon icon={IconPlus} />} onClick={onAddProvider}>
          {t('Add')}
        </Button>
        {platform.type !== 'mobile' && (
          <Button
            variant="light"
            leftSection={<ScalableIcon icon={IconFileImport} />}
            onClick={onImportProvider}
            loading={isImporting}
          >
            {t('Import from clipboard')}
          </Button>
        )}
      </Stack>
    </Stack>
  )
}
