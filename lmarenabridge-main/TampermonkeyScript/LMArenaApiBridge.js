// ==UserScript==
// @name         LMArena API Bridge (No-404 Solid)
// @namespace    http://tampermonkey.net/
// @version      2.7.0
// @description  使用本地WS桥接LMArena；自动记住真实接口的域名/前缀/方法，避免404；无需控制台与额外操作。
// @match        https://lmarena.ai/*
// @match        https://*.lmarena.ai/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=lmarena.ai
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  // 本地后端地址（与你现在运行的一致）
  const SERVER_WS = "ws://127.0.0.1:5102/ws";
  const API_HOST_5102 = "http://127.0.0.1:5102";
  const ID_SERVER_5103 = "http://127.0.0.1:5103/update";

  // 如确定环境可手动指定（否则留空，自动识别）
  const FORCE_ORIGIN = ""; // 例如 "https://lmarena.ai"
  const FORCE_PREFIX = ""; // 例如 "/zh-CN" 或 "/en"
  const FORCE_METHOD = ""; // "PUT" 或 "POST"

  let socket;
  let isCaptureModeActive = false;   // ID捕获开关（由后端指令触发）
  let apiOrigin = "";                // 真实接口域名（从“重试”请求中学习）
  let apiPathPrefix = "";            // 语言/区域前缀（从“重试”请求中学习）
  let apiMethod = "PUT";             // 真实方法（PUT/POST，从“重试”请求中学习）

  // 工具：URL拼接（避免双斜杠）
  function joinUrl(origin, path) {
    const o = (origin || "").replace(/\/+$/, "");
    const p = (path || "").replace(/^\/+/, "");
    return o + "/" + p;
  }

  // 建立与本地后端的WS连接
  function connect() {
    const ws = new WebSocket(SERVER_WS);
    socket = ws;

    ws.onopen = () => {
      if (!document.title.startsWith("✅ ")) document.title = "✅ " + document.title;
    };

    ws.onmessage = async (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }

      // 控制指令
      if (msg && msg.command) {
        if (msg.command === 'refresh' || msg.command === 'reconnect') {
          location.reload();
        } else if (msg.command === 'activate_id_capture') {
          isCaptureModeActive = true;
          if (!document.title.startsWith("🎯 ")) document.title = "🎯 " + document.title;
        } else if (msg.command === 'send_page_source') {
          sendPageSource();
        }
        return;
      }

      // 正常请求
      const { request_id, payload } = msg || {};
      if (!request_id || !payload) return;
      await executeFetchAndStreamBack(request_id, payload);
    };

    ws.onclose = () => {
      if (document.title.startsWith("✅ ")) document.title = document.title.substring(2);
      setTimeout(connect, 1500);
    };

    ws.onerror = () => {
      try { ws.close(); } catch {}
    };
  }

  // 发送数据到本地后端
  function sendToServer(requestId, data) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ request_id: requestId, data }));
    }
  }

  // 执行真正的 LMArena 请求，并把流回传
  async function executeFetchAndStreamBack(requestId, payload) {
    const { is_image_request, message_templates, target_model_id, session_id, message_id } = payload || {};

    if (!session_id || !message_id) {
      sendToServer(requestId, { error: "会话ID为空；请在后端UI点“开始捕获”，回聊天页点一次“重试/Retry”" });
      sendToServer(requestId, "[DONE]");
      return;
    }
    if (!message_templates || !message_templates.length) {
      sendToServer(requestId, { error: "message_templates 为空" });
      sendToServer(requestId, "[DONE]");
      return;
    }

    // 构造消息链（最后一条 pending，其它 success）
    const newMessages = [];
    let lastMsgId = null;
    for (let i = 0; i < message_templates.length; i++) {
      const t = message_templates[i];
      const id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(16).slice(2));
      const parents = lastMsgId ? [lastMsgId] : [];
      const status = is_image_request ? 'success' : ((i === message_templates.length - 1) ? 'pending' : 'success');
      newMessages.push({
        role: t.role, content: t.content, id,
        evaluationId: null, evaluationSessionId: session_id, parentMessageIds: parents,
        experimental_attachments: t.attachments || [],
        failureReason: null, metadata: null,
        participantPosition: t.participantPosition || "a",
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        status
      });
      lastMsgId = id;
    }
    const body = { messages: newMessages, modelId: target_model_id };

    // 生成候选“域名/前缀/方法”
    const origins = Array.from(new Set([
      (FORCE_ORIGIN || "").trim(),
      (apiOrigin || "").trim(),
      location.origin
    ].filter(Boolean)));

    const htmlLang = (document.documentElement.getAttribute('lang') || '').trim(); // zh-CN/en-US
    const shortLang = htmlLang.split('-')[0] || '';                                 // zh/en
    const pathFirst = (location.pathname.split('/')[1] || '').trim();               // 可能是 zh-CN/en

    const prefixesUnique = Array.from(new Set([
      (FORCE_PREFIX || "").trim(),
      (apiPathPrefix || "").trim(),
      htmlLang ? '/' + htmlLang : '',
      shortLang ? '/' + shortLang : '',
      (/^[a-zA-Z-]+$/.test(pathFirst) ? '/' + pathFirst : ''),
      ''
    ]));
    const prefixes = prefixesUnique.map(p => (p === '/' ? '' : p));

    const methods = Array.from(new Set([
      (FORCE_METHOD || "").toUpperCase(),
      (apiMethod || "").toUpperCase(),
      'PUT', 'POST'
    ].filter(Boolean)));

    // 逐个组合尝试，直到成功
    window.isApiBridgeRequest = true;
    let response = null, used = null, lastErr = '';
    try {
      outer:
      for (const or of origins) {
        for (const pre of prefixes) {
          const path = `${pre}/api/stream/retry-evaluation-session-message/${session_id}/messages/${message_id}`;
          const url = joinUrl(or, path);
          for (const m of methods) {
            try {
              response = await fetch(url, {
                method: m,
                headers: { 'Content-Type': 'text/plain;charset=UTF-8', 'Accept': '*/*' },
                body: JSON.stringify(body),
                credentials: 'include'
              });
              if (response && response.ok && response.body) { used = { url, m }; break outer; }
              if (response) { try { lastErr = (await response.text() || '').slice(0, 800); } catch {} }
            } catch (e) {
              lastErr = String(e).slice(0, 300);
              response = null;
            }
          }
        }
      }

      if (!used) {
        const status = response ? response.status : 'N/A';
        sendToServer(requestId, { error: `网络响应不正常。状态: ${status}. 内容: ${lastErr || 'no body'}` });
        sendToServer(requestId, "[DONE]");
        return;
      }

      // 成功：把流回传
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) { sendToServer(requestId, "[DONE]"); break; }
        sendToServer(requestId, decoder.decode(value));
      }

    } catch (e) {
      sendToServer(requestId, { error: e.message || String(e) });
      sendToServer(requestId, "[DONE]");
    } finally {
      window.isApiBridgeRequest = false;
    }
  }

  // 拦截页面自己的 fetch：
  // 1) 记住实际使用的 origin/前缀/方法（即使未开启“开始捕获”，也会记住，减少人为步骤）
  // 2) 若“开始捕获”开启，抓到 sessionId/messageId 回传后端写入配置
  const originalFetch = window.fetch;
  window.fetch = function (...args) {
    let urlString = '';
    try {
      const u0 = args[0];
      if (u0 instanceof Request) urlString = u0.url;
      else if (u0 instanceof URL) urlString = u0.href;
      else if (typeof u0 === 'string') urlString = u0;
    } catch { urlString = ''; }

    if (urlString) {
      try {
        const u = new URL(urlString, location.origin);
        const p = u.pathname || '';
        // 兼容：有/无语言前缀的两种形式
        const re = /^\/(?:[a-zA-Z-]+\/)?api\/stream\/retry-evaluation-session-message\/([a-f0-9-]+)\/messages\/([a-f0-9-]+)/;
        const m = p.match(re);

        if (m && !window.isApiBridgeRequest) {
          // 1) 记住域名/前缀/方法
          apiOrigin = (FORCE_ORIGIN || u.origin || apiOrigin || "");
          const idx = p.indexOf('/api/stream/');
          if (idx > 0) apiPathPrefix = (FORCE_PREFIX || p.slice(0, idx) || apiPathPrefix || "");
          try {
            const init = args[1] || {};
            const meth = (init.method || (args[0] instanceof Request ? args[0].method : apiMethod) || apiMethod).toUpperCase();
            apiMethod = (FORCE_METHOD || meth || apiMethod);
          } catch {}

          // 2) 若处于“开始捕获”，上报ID写进 config.jsonc
          if (isCaptureModeActive) {
            const sessionId = m[1], messageId = m[2];
            isCaptureModeActive = false;
            if (document.title.startsWith("🎯 ")) document.title = document.title.substring(2);
            fetch(ID_SERVER_5103, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId, messageId })
            }).catch(() => {});
          }
        }
      } catch {}
    }

    return originalFetch.apply(this, args);
  };

  // 发送页面源码给本地后端，用于抓取可用模型
  async function sendPageSource() {
    try {
      const htmlContent = document.documentElement.outerHTML;
      await fetch(joinUrl(API_HOST_5102, "/internal/update_available_models"), {
        method: 'POST',
        headers: { 'Content-Type': 'text/html' },
        body: htmlContent
      });
    } catch {}
  }

  // 启动
  connect();
})();
