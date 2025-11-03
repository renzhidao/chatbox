
import { Image } from '@mantine/core'
import type { ModelProvider } from 'src/shared/types'
import { useProviders } from '@/hooks/useProviders'
import CustomProviderIcon from '../CustomProviderIcon'

import azureIcon from '../../static/icons/providers/azure.png'
import chatboxAIIcon from '../../static/icons/providers/chatbox-ai.png'
import chatglmIcon from '../../static/icons/providers/chatglm-6b.png'
import claudeIcon from '../../static/icons/providers/claude.png'
import deepseekIcon from '../../static/icons/providers/deepseek.png'
import geminiIcon from '../../static/icons/providers/gemini.png'
import groqIcon from '../../static/icons/providers/groq.png'
import lmstudioIcon from '../../static/icons/providers/lm-studio.png'
import mistralIcon from '../../static/icons/providers/mistral-ai.png'
import ollamaIcon from '../../static/icons/providers/ollama.png'
import openaiIcon from '../../static/icons/providers/openai.png'
import openrouterIcon from '../../static/icons/providers/openrouter.png'
import perplexityIcon from '../../static/icons/providers/perplexity.png'
import siliconflowIcon from '../../static/icons/providers/siliconflow.png'
import volcengineIcon from '../../static/icons/providers/volcengine.png'
import xaiIcon from '../../static/icons/providers/xAI.png'

const icons: Record<string, string> = {
  azure: azureIcon,
  'chatbox-ai': chatboxAIIcon,
  'chatglm-6b': chatglmIcon,
  claude: claudeIcon,
  deepseek: deepseekIcon,
  gemini: geminiIcon,
  groq: groqIcon,
  'lm-studio': lmstudioIcon,
  'mistral-ai': mistralIcon,
  ollama: ollamaIcon,
  openai: openaiIcon,
  openrouter: openrouterIcon,
  perplexity: perplexityIcon,
  siliconflow: siliconflowIcon,
  volcengine: volcengineIcon,
  xai: xaiIcon,
}

export default function ProviderImageIcon(props: {
  className?: string
  size?: number
  provider: ModelProvider | string
  providerName?: string
}) {
  const { className, size = 24, provider, providerName } = props

  const {providers} = useProviders()
  const providerInfo = providers.find((p) => p.id === provider)
  
  if(providerInfo?.isCustom){
    return providerInfo.iconUrl ? (
      <Image w={size} h={size} src={providerInfo.iconUrl} alt={providerInfo.name} />
    ) : (
      <CustomProviderIcon providerId={providerInfo.id} providerName={providerInfo.name} size={size} />
    )
  }

  const iconSrc = icons[provider as string]

  return iconSrc ? (
    <Image w={size} h={size} src={iconSrc} className={className} alt={`${providerName || provider} image icon`} />
  ) : providerName ? (
    <CustomProviderIcon providerId={provider} providerName={providerName} size={size} />
  ) : null
}
