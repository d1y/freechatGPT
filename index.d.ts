interface ChatGPTModel {
  Id:         string
  LangServer: string
  ModelName:  string
  Introduce:  string
  Enabled:    boolean
  Message:    string
  Free:       boolean
  IsDefault:  boolean
}

interface ConversationStackOption {
  /**
   * 问题
   */
  question: string
  /**
   * 上一次的答案
   */
  lastAnswer: string
}

interface ChatGPTDialogue {
  content: string
  role: 'user' | 'ChatGPT'
}

interface TokenURL {
  expire: number
  token: string
  version: '0.1'
  wid: string
}

/**
 * 两个模型可用
 */
type ChatGPTModel = "ChatGPT" | "Claude2"