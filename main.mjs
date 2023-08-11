#!/usr/bin/env node

import { WebSocket } from 'ws'
import { request } from 'undici'

import readline from 'readline'
import logger from 'loglevel'
import { marked } from 'marked'
import { gfmHeadingId } from "marked-gfm-heading-id"
import TerminalRenderer from 'marked-terminal'

const kGetTokenUrl = 'https://aiplus.azurewebsites.net/api/GetTokenUrl'
const kSignalApi = "https://aiplus.azurewebsites.net/api"
const kEntryApi = "https://lshk-lshkdev.azurewebsites.net/api"

// TODO: impl create new chat api(session)
// const kCreateNewChatApi = ""

marked.use(gfmHeadingId({
  prefix: "my-prefix-"
}))
marked.setOptions({
  mangle: false,
  renderer: new TerminalRenderer()
})

const kHeader = {
  'Accept': '*/*',
  'Accept-Language': 'en-US',
  'Origin': 'vscode-webview://026c25r5u0hktsjo669revb3hs3gsqid8iupfjniit1h1s2btanj',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'cross-site',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_3_1) AppleWebKit/537.36 (KHTML, like Gecko) Code-Insiders/1.82.0-insider Chrome/108.0.5359.215 Electron/22.3.18 Safari/537.36',
  'sec-ch-ua': '"Not?A_Brand";v="8", "Chromium";v="108"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"'
}

const kEOF = '[END]'

/**
 * @param {string} wid 
 * @returns {string}
 */
function createConversationApi(wid) {
  return `${kSignalApi}/chatgpt/conversation?wid=${wid}&model=1`
}

async function createConversationStack(wid) {
  /**
   * @type {Array<ChatGPTDialogue>}
   */
  const dialogue = []
  const url = createConversationApi(wid)
  /**
   * @param question {string}
   * @param lastAnswer {string?}
   */
  const result = async function(question, lastAnswer = "") {
    if (lastAnswer) {
      dialogue.push({
        content: lastAnswer,
        role: 'ChatGPT',
      })
    }
    dialogue.push({
      content: question,
      role: 'user',
    })
    await request(url, {
      method: 'POST',
      headers: {
        ...kHeader,
        token: "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dialogue),
    })
    return result
  }
  return result
}

let ws

/**
 * @param wss {string}
 * @returns {Promise<any>}
 */
async function askQuestionsChatGPT(wss) {
  ws = new WebSocket(wss)
  const resp = await new Promise((res, rej)=> {
    let result = ""
    ws.onopen = () => {
      logger.debug('创建连接成功')
    }
    ws.onmessage = event=> {
      const data = event.data
      if (data == kEOF) {
        res(result)  
      } else {
        result += (data ?? '')
      }
    }
    ws.onerror = ()=> {
      logger.error('创建连接失败')
      rej("")
    }
  })
  return resp
}

/**
 * @returns {Promise<Array<ChatGPTModel>>}
 */
async function getModelList() {
  const url = `${kEntryApi}/ai/GetModelList`
  const resp = await request(url, {
    method: "GET",
    headers: kHeader,
  })
  /**
   * @type {Array<ChatGPTModel>}
   */
  const data = resp.body.json()
  return data
}

/**
 * @returns {Promise<TokenURL>}
 */
async function getTokenUrl() {
  const resp = await request(kGetTokenUrl, {
    method: "GET",
    headers: kHeader,
  })
  /**
   * @type {TokenURL}
   */
  const data = await resp.body.json()
  return data
}

async function main() {

  // 1. 先拿到模型, 有两个: ChatGPT | Claude2
  // 目前先实现 ChatGPT 模型
  // TODO: reimpl 
  // const models = await getModelList()

  // 2. 然后通过下面这个接口拿到其他相关的字段
  // - expire: 失效时间
  // - token: 一个 wss 链接
  // - wid: 后续接口都需要带上这个 wid
  const tokenModelContext = await getTokenUrl()

  // 3. 等待输入指令, 现在输入了一个问题: 耗子尾汁是什么意思?
  // 那么现在立马启动一个 WebSocket 连接, 并且发送请求, url 就是 tokenModelContext->token
  // 等待返回结果, 返回结果是一个一个字符串, 最后的标识符是 "[END]"
  // 在启动并且建立连接之后, 需要把之前所有的上下文都发过去, 通过 createConversationStack 函数
  const updateConversation = await createConversationStack(tokenModelContext.wid)

  console.clear()

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  
  function askQuestion() {
    rl.question('◠ ◡ ◠ >> ', async (question) => {
      updateConversation(question)
      const result = await askQuestionsChatGPT(tokenModelContext.token) 
      console.log(marked(result))
      askQuestion()
    })
  }
  
  askQuestion();

  process.on('SIGINT', () => {
    rl.close();
    !!ws && ws.close()
    process.exit();
  });
}

main()