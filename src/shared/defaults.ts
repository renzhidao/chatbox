import { v4 as uuidv4 } from 'uuid'
import {
  type Config,
  ModelProviderEnum,
  ModelProviderType,
  type ProviderBaseInfo,
  type SessionSettings,
  type Settings,
  Theme,
} from './types'

export function settings(): Settings {
  return {
    showWordCount: false,
    showTokenCount: false,
    showTokenUsed: true,
    showModelName: true,
    showMessageTimestamp: false,
    showFirstTokenLatency: false,
    userAvatarKey: '',
    defaultAssistantAvatarKey: '',
    theme: Theme.System,
    language: 'en',
    fontSize: 14,
    spellCheck: true,

    defaultPrompt: getDefaultPrompt(),

    allowReportingAndTracking: true,

    enableMarkdownRendering: true,
    enableLaTeXRendering: true,
    enableMermaidRendering: true,
    injectDefaultMetadata: true,
    autoPreviewArtifacts: false,
    autoCollapseCodeBlock: true,
    pasteLongTextAsAFile: true,

    autoGenerateTitle: true,

    autoLaunch: false,
    autoUpdate: true,
    betaUpdate: false,

    shortcuts: {
      quickToggle: 'Alt+`',
      inputBoxFocus: 'mod+i',
      inputBoxWebBrowsingMode: 'mod+e',
      newChat: 'mod+n',
      newPictureChat: 'mod+shift+n',
      sessionListNavNext: 'mod+tab',
      sessionListNavPrev: 'mod+shift+tab',
      sessionListNavTargetIndex: 'mod',
      messageListRefreshContext: 'mod+r',
      dialogOpenSearch: 'mod+k',
      inputBoxSendMessage: 'Enter',
      inputBoxSendMessageWithoutResponse: 'Ctrl+Enter',
      optionNavUp: 'up',
      optionNavDown: 'down',
      optionSelect: 'enter',
    },
    extension: {
      webSearch: {
        provider: 'build-in',
        tavilyApiKey: '',
      },
      knowledgeBase: {
        models: {
          embedding: undefined,
          rerank: undefined,
        },
      },
    },
    mcp: {
      servers: [],
      enabledBuiltinServers: [],
    },
  }
}

export function newConfigs(): Config {
  return { uuid: uuidv4() }
}

export function getDefaultPrompt() {
  return 'You are a helpful assistant.'
}

export function chatSessionSettings(): SessionSettings {
  return {
    provider: ModelProviderEnum.ChatboxAI,
    modelId: 'chatboxai-4',
    maxContextMessageCount: 6,
  }
}

export function pictureSessionSettings(): SessionSettings {
  return {
    provider: ModelProviderEnum.ChatboxAI,
    modelId: 'DALL-E-3',
    imageGenerateNum: 3,
    dalleStyle: 'vivid',
  }
}

export const SystemProviders: ProviderBaseInfo[] = [
  {
    id: ModelProviderEnum.ChatboxAI,
    name: 'Chatbox AI',
    type: ModelProviderType.ChatboxAI,
  },
  {
    id: ModelProviderEnum.OpenAI,
    name: 'OpenAI',
    type: ModelProviderType.OpenAI,
    urls: {
      website: 'https://openai.com',
    },
    defaultSettings: {
      apiHost: 'https://api.openai.com',
      models: [
        {
          modelId: 'gpt-5-chat-latest',
          capabilities: ['vision', 'tool_use'],
          contextWindow: 400_000,
          maxOutput: 128_000,
        },
        {
          modelId: 'gpt-5',
          capabilities: ['vision', 'tool_use'],
          contextWindow: 400_000,
          maxOutput: 128_000,
        },
        {
          modelId: 'gpt-5-mini',
          capabilities: ['vision', 'tool_use'],
          contextWindow: 128_000,
          maxOutput: 4_096,
        },
        {
          modelId: 'gpt-5-nano',
          capabilities: ['vision', 'tool_use'],
          contextWindow: 128_000,
          maxOutput: 4_096,
        },
        {
          modelId: 'gpt-4o',
          capabilities: ['vision', 'tool_use'],
          contextWindow: 128_000,
          maxOutput: 4_096,
        },
        {
          modelId: 'gpt-4o-mini',
          capabilities: ['vision', 'tool_use'],
          contextWindow: 128_000,
          maxOutput: 4_096,
        },
        {
          modelId: 'o4-mini',
          capabilities: ['vision', 'tool_use', 'reasoning'],
          contextWindow: 200_000,
          maxOutput: 100_000,
        },
        {
          modelId: 'o3-mini',
          capabilities: ['vision', 'tool_use', 'reasoning'],
          contextWindow: 200_000,
          maxOutput: 200_000,
        },
        {
          modelId: 'o3',
          capabilities: ['vision', 'tool_use', 'reasoning'],
          contextWindow: 200_000,
          maxOutput: 100_000,
        },
        {
          modelId: 'dall-e-3',
        },
        {
          modelId: 'dall-e-2',
        },
        {
          modelId: 'text-embedding-3-small',
          type: 'embedding',
        },
      ],
    },
  },
  {
    id: ModelProviderEnum.Claude,
    name: 'Claude',
    type: ModelProviderType.Claude,
    urls: {
      website: 'https://www.anthropic.com',
    },
    defaultSettings: {
      apiHost: 'https://api.anthropic.com/v1',
      models: [
        {
          modelId: 'claude-opus-4-0',
          contextWindow: 200_000,
          maxOutput: 32_000,
          capabilities: ['vision', 'reasoning', 'tool_use'],
        },
        {
          modelId: 'claude-sonnet-4-0',
          contextWindow: 200_000,
          maxOutput: 64_000,
          capabilities: ['vision', 'reasoning', 'tool_use'],
        },
        {
          modelId: 'claude-3-7-sonnet-latest',
          capabilities: ['vision', 'tool_use', 'reasoning'],
          contextWindow: 200_000,
        },
        {
          modelId: 'claude-3-5-sonnet-latest',
          capabilities: ['vision'],
          contextWindow: 200_000,
        },
        {
          modelId: 'claude-3-5-haiku-latest',
          capabilities: ['vision'],
          contextWindow: 200_000,
        },
        {
          modelId: 'claude-3-opus-latest',
          capabilities: ['vision'],
          contextWindow: 200_000,
        },
      ],
    },
  },
  {
    id: ModelProviderEnum.Gemini,
    name: 'Gemini',
    type: ModelProviderType.Gemini,
    urls: {
      website: 'https://gemini.google.com/',
    },
    defaultSettings: {
      apiHost: 'https://generativelanguage.googleapis.com',
      models: [
        {
          modelId: 'gemini-2.5-flash',
          capabilities: ['vision', 'reasoning', 'tool_use'],
          contextWindow: 1_000_000,
          maxOutput: 8_192,
        },
        {
          modelId: 'gemini-2.5-pro',
          capabilities: ['vision', 'reasoning', 'tool_use'],
          contextWindow: 1_000_000,
          maxOutput: 8_192,
        },
        {
          modelId: 'gemini-2.5-flash-image-preview',
          capabilities: ['vision'],
          contextWindow: 32_768,
          maxOutput: 8_192,
        },
        {
          modelId: 'gemini-2.0-flash-exp',
          capabilities: ['vision'],
          contextWindow: 1_000_000,
          maxOutput: 8_192,
        },
        {
          modelId: 'gemini-2.0-flash-thinking-exp',
          capabilities: ['vision', 'reasoning'],
          contextWindow: 32_000,
          maxOutput: 8_000,
        },
        {
          modelId: 'gemini-2.0-flash-thinking-exp-1219',
          capabilities: ['vision', 'reasoning'],
          contextWindow: 32_000,
          maxOutput: 8_000,
        },
        {
          modelId: 'gemini-1.5-pro-latest',
          capabilities: ['vision'],
          contextWindow: 2_000_000,
          maxOutput: 8_192,
        },
        {
          modelId: 'gemini-1.5-flash-latest',
          capabilities: ['vision'],
          contextWindow: 1_000_000,
          maxOutput: 8_192,
        },
      ],
    },
  },
  {
    id: ModelProviderEnum.Ollama,
    name: 'Ollama',
    type: ModelProviderType.OpenAI,
    defaultSettings: {
      apiHost: 'http://127.0.0.1:11434',
    },
  },
  {
    id: ModelProviderEnum.LMStudio,
    name: 'LM Studio',
    type: ModelProviderType.OpenAI,
    defaultSettings: {
      apiHost: 'http://127.0.0.1:1234',
    },
  },
  {
    id: ModelProviderEnum.DeepSeek,
    name: 'DeepSeek',
    type: ModelProviderType.OpenAI,
    urls: {
      website: 'https://www.deepseek.com/',
    },
    defaultSettings: {
      models: [
        {
          modelId: 'deepseek-chat',
          contextWindow: 64_000,
          capabilities: ['tool_use'],
        },
        {
          modelId: 'deepseek-coder',
          contextWindow: 64_000,
        },
        {
          modelId: 'deepseek-reasoner',
          contextWindow: 64_000,
          capabilities: ['reasoning', 'tool_use'],
        },
      ],
    },
  },
  {
    id: ModelProviderEnum.SiliconFlow,
    name: 'SiliconFlow',
    type: ModelProviderType.OpenAI,
    urls: {
      website: 'https://siliconflow.cn/',
    },
    defaultSettings: {
      apiHost: 'https://api.siliconflow.cn',
      models: [
        {
          modelId: 'deepseek-ai/DeepSeek-V3.1',
          capabilities: ['tool_use'],
          contextWindow: 160_000,
        },
        {
          modelId: 'deepseek-ai/DeepSeek-V3',
          capabilities: ['tool_use'],
          contextWindow: 64_000,
        },
        {
          modelId: 'deepseek-ai/DeepSeek-R1',
          capabilities: ['reasoning', 'tool_use'],
          contextWindow: 64_000,
        },
        {
          modelId: 'Pro/deepseek-ai/DeepSeek-R1',
          capabilities: ['reasoning', 'tool_use'],
          contextWindow: 64_000,
        },
        {
          modelId: 'Pro/deepseek-ai/DeepSeek-V3',
          capabilities: ['tool_use'],
          contextWindow: 64_000,
        },
        {
          modelId: 'Pro/deepseek-ai/DeepSeek-V3.1',
          capabilities: ['tool_use'],
          contextWindow: 160_000,
        },
        {
          modelId: 'moonshotai/Kimi-K2-Instruct-0905',
          capabilities: ['tool_use'],
          contextWindow: 256_000,
        },
        {
          modelId: 'Qwen/Qwen2.5-7B-Instruct',
          capabilities: ['tool_use'],
          contextWindow: 32_000,
        },
        {
          modelId: 'Qwen/Qwen2.5-14B-Instruct',
          capabilities: ['tool_use'],
          contextWindow: 32_000,
        },
        {
          modelId: 'Qwen/Qwen2.5-32B-Instruct',
          capabilities: ['tool_use'],
          contextWindow: 32_000,
        },
        {
          modelId: 'Qwen/Qwen2.5-72B-Instruct',
          capabilities: ['tool_use'],
          contextWindow: 32_000,
        },
        {
          modelId: 'Qwen/Qwen2.5-VL-32B-Instruct',
          capabilities: ['vision'],
          contextWindow: 128_000,
        },
        {
          modelId: 'Qwen/Qwen2.5-VL-72B-Instruct',
          capabilities: ['vision'],
          contextWindow: 128_000,
        },
        {
          modelId: 'Qwen/QVQ-72B-Preview',
          capabilities: ['vision'],
          contextWindow: 128_000,
        },
        {
          modelId: 'Qwen/QwQ-32B',
          capabilities: ['tool_use'],
          contextWindow: 32_000,
        },
        {
          modelId: 'Pro/Qwen/Qwen2.5-VL-7B-Instruct',
          capabilities: ['vision'],
          contextWindow: 32_000,
        },
        { modelId: 'BAAI/bge-m3', type: 'embedding' },
        { modelId: 'BAAI/bge-large-zh-v1.5', type: 'embedding' },
        { modelId: 'Pro/BAAI/bge-m3', type: 'embedding' },
        { modelId: 'BAAI/bge-reranker-v2-m3', type: 'rerank' },
      ],
    },
  },
  {
    id: ModelProviderEnum.OpenRouter,
    name: 'OpenRouter',
    type: ModelProviderType.OpenAI,
    urls: {
      website: 'https://openrouter.ai/',
    },
    defaultSettings: {
      apiHost: 'https://openrouter.ai/api/v1',
      models: [
        {
          modelId: 'deepseek/deepseek-chat-v3.1:free',
          type: 'chat',
          nickname: 'DeepSeek: DeepSeek V3.1 (free)',
          capabilities: ['tool_use'],
          contextWindow: 64000,
        },
        {
          modelId: 'deepseek/deepseek-chat-v3-0324:free',
          type: 'chat',
          nickname: 'DeepSeek: DeepSeek V3 0324 (free)',
          capabilities: ['tool_use'],
          contextWindow: 163840,
        },
        {
          modelId: 'deepseek/deepseek-r1-0528',
          type: 'chat',
          nickname: 'DeepSeek: R1 0528',
          capabilities: ['tool_use'],
          contextWindow: 163840,
        },
        {
          modelId: 'deepseek/deepseek-r1:free',
          type: 'chat',
          nickname: 'DeepSeek: R1 (free)',
          capabilities: ['tool_use'],
          contextWindow: 163840,
        },
        {
          modelId: 'tngtech/deepseek-r1t2-chimera:free',
          type: 'chat',
          nickname: 'TNG: DeepSeek R1T2 Chimera (free)',
          capabilities: ['tool_use'],
          contextWindow: 163840,
        },
        {
          modelId: 'google/gemini-2.5-pro',
          type: 'chat',
          nickname: 'Google: Gemini 2.5 Pro',
          capabilities: ['tool_use', 'vision'],
          contextWindow: 1048576,
        },
        {
          modelId: 'google/gemini-2.5-flash-image-preview',
          type: 'chat',
          nickname: 'Google: Gemini 2.5 Flash Image Preview',
          capabilities: ['tool_use', 'vision'],
          contextWindow: 32768,
        },
        {
          modelId: 'openai/gpt-5-chat',
          type: 'chat',
          nickname: 'OpenAI: GPT-5 Chat',
          capabilities: ['tool_use', 'vision'],
          contextWindow: 128000,
        },
        {
          modelId: 'openai/gpt-4o-2024-11-20',
          type: 'chat',
          nickname: 'OpenAI: GPT-4o (2024-11-20)',
          capabilities: ['tool_use', 'vision'],
          contextWindow: 128000,
        },
        {
          modelId: 'x-ai/grok-3-mini',
          type: 'chat',
          nickname: 'xAI: Grok 3 Mini',
          capabilities: ['tool_use'],
          contextWindow: 131072,
        },
      ],
    },
  },
  {
    id: ModelProviderEnum.VolcEngine,
    name: 'VolcEngine',
    type: ModelProviderType.OpenAI,
    urls: {
      website: 'https://www.volcengine.com/',
    },
    defaultSettings: {
      apiHost: 'https://ark.cn-beijing.volces.com',
      apiPath: '/api/v3/chat/completions',
      models: [
        {
          modelId: 'deepseek-v3-250324',
          contextWindow: 64_000,
          capabilities: ['tool_use', 'reasoning'],
        },
        {
          modelId: 'deepseek-r1-250528',
          contextWindow: 16_384,
          capabilities: ['reasoning', 'tool_use'],
        },
        {
          modelId: 'doubao-1-5-thinking-pro-250415',
          contextWindow: 128_000,
          capabilities: ['reasoning'],
        },
        {
          modelId: 'doubao-1.5-vision-pro-250328',
          contextWindow: 128_000,
          capabilities: ['vision'],
        },
        { modelId: 'doubao-embedding-text-240715', type: 'embedding' },
      ],
    },
  },
  {
    id: ModelProviderEnum.Azure,
    name: 'Azure OpenAI',
    type: ModelProviderType.OpenAI,
    defaultSettings: {
      endpoint: 'https://<resource_name>.openai.azure.com',
      apiVersion: '2024-05-01-preview',
    },
  },
  {
    id: ModelProviderEnum.XAI,
    name: 'xAI',
    type: ModelProviderType.OpenAI,
    urls: {
      website: 'https://x.ai/',
    },
    defaultSettings: {
      apiHost: 'https://api.x.ai',
      models: [
        {
          modelId: 'grok-4-0709',
          contextWindow: 256_000,
          capabilities: ['vision', 'tool_use', 'reasoning'],
        },
        {
          modelId: 'grok-3',
          contextWindow: 131_072,
          capabilities: ['tool_use'],
        },
        {
          modelId: 'grok-3-mini',
          contextWindow: 131_072,
          capabilities: ['tool_use', 'reasoning'],
        },
        {
          modelId: 'grok-3-fast',
          contextWindow: 131_072,
          capabilities: ['tool_use'],
        },
        {
          modelId: 'grok-2-vision-1212',
          capabilities: ['vision'],
          contextWindow: 8192,
        },
        {
          modelId: 'grok-2-1212',
          contextWindow: 128_000,
        },
        {
          modelId: 'grok-vision-beta',
          capabilities: ['vision'],
          contextWindow: 8192,
        },
        {
          modelId: 'grok-beta',
          contextWindow: 128_000,
        },
      ],
    },
  },
  {
    id: ModelProviderEnum.MistralAI,
    name: 'Mistral AI',
    type: ModelProviderType.OpenAI,
    urls: {
      website: 'https://mistral.ai',
    },
    defaultSettings: {
      apiHost: 'https://api.mistral.ai/v1',
      models: [
        {
          modelId: 'pixtral-large-latest',
          contextWindow: 128_000,
          capabilities: ['vision', 'tool_use'],
        },
        {
          modelId: 'mistral-large-latest',
          contextWindow: 32_000,
          capabilities: ['tool_use'],
        },
        {
          modelId: 'mistral-medium-latest',
          contextWindow: 32_000,
          capabilities: ['tool_use'],
        },
        {
          modelId: 'mistral-small-latest',
          contextWindow: 32_000,
          capabilities: ['tool_use'],
        },
        {
          modelId: 'magistral-medium-latest',
          contextWindow: 32_000,
          capabilities: ['reasoning', 'tool_use'],
        },
        {
          modelId: 'magistral-small-latest',
          contextWindow: 32_000,
          capabilities: ['reasoning', 'tool_use'],
        },
        {
          modelId: 'codestral-22b-latest',
          contextWindow: 32_000,
          capabilities: [],
        },
        {
          modelId: 'mistral-embed',
          type: 'embedding',
        },
      ],
    },
  },
  {
    id: ModelProviderEnum.Perplexity,
    name: 'Perplexity',
    type: ModelProviderType.OpenAI,
    urls: {
      website: 'https://www.perplexity.ai/',
    },
    defaultSettings: {
      models: [
        { modelId: 'sonar' },
        { modelId: 'sonar-pro' },
        { modelId: 'sonar-reasoning' },
        { modelId: 'sonar-reasoning-pro' },
        { modelId: 'sonar-deep-research' },
      ],
    },
  },
  {
    id: ModelProviderEnum.Groq,
    name: 'Groq',
    type: ModelProviderType.OpenAI,
    urls: {
      website: 'https://groq.com/',
    },
    defaultSettings: {
      apiHost: 'https://api.groq.com/openai',
      models: [
        {
          modelId: 'llama-3.3-70b-versatile',
          contextWindow: 131_072,
          maxOutput: 32_768,
          capabilities: ['tool_use'],
        },
        {
          modelId: 'moonshotai/kimi-k2-instruct',
          contextWindow: 131_072,
          maxOutput: 16_384,
          capabilities: ['tool_use'],
        },
        {
          modelId: 'qwen/qwen3-32b',
          contextWindow: 131_072,
          maxOutput: 40_960,
          capabilities: ['tool_use'],
        },
      ],
    },
  },
  {
    id: ModelProviderEnum.ChatGLM6B,
    name: 'ChatGLM6B',
    type: ModelProviderType.OpenAI,
    defaultSettings: {
      apiHost: 'https://open.bigmodel.cn/api/paas/v4/',
      models: [
        {
          modelId: 'glm-4.5',
          capabilities: ['reasoning', 'tool_use'],
          contextWindow: 128_000,
        },
        {
          modelId: 'glm-4.5-air',
          capabilities: ['reasoning', 'tool_use'],
          contextWindow: 128_000,
        },
        {
          modelId: 'glm-4.5v',
          capabilities: ['reasoning', 'vision', 'tool_use'],
          contextWindow: 64_000,
        },
        {
          modelId: 'glm-4-air',
          capabilities: ['tool_use'],
          contextWindow: 128_000,
        },
        {
          modelId: 'glm-4-plus',
          capabilities: ['tool_use'],
          contextWindow: 128_000,
        },
        {
          modelId: 'glm-4-flash',
          capabilities: ['tool_use'],
          contextWindow: 128_000,
        },
        {
          modelId: 'glm-4v-plus-0111',
          capabilities: ['vision', 'tool_use'],
          contextWindow: 16_000,
        },
        {
          modelId: 'glm-4v-flash',
          capabilities: ['vision', 'tool_use'],
          contextWindow: 16_000,
        },
      ],
    },
  },
]
