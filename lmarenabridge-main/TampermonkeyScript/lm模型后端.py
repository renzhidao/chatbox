# api_server_mobile.py
# DEBUG 稳定版（SSE/非流式双栈；双协议自SAP；详细调试端点；IPv6支持；流式保存；优化文件名）
# - /v1/chat/completions => OpenAI 聊天：stream=true 时 SSE（chat.completion.chunk）；否则非流式（choices[0].message.content + text）
# - /v1/completions、/completions => LM Studio 文本：stream=true 时 SSE（choices[0].text）；否则非流式（choices[0].text + message）
# - 新增: 流式(stream:true)对话现在也会在结束后被完整保存。
# - 新增: 保存的文件名中会包含提问内容的摘要，例如 `[时间]_[模型]_[提问摘要].json`，更易识别。
# - IPv6 支持：自动检测并显示公网IPv6地址，方便直接配置域名。
# - 终极修复版：save_config_ids 函数已完全修复，可安全地更新或追加键值，不会破坏 JSON 格式。
# - 语法修复版：修正了 internal_generate_models 函数中的字符串引号错误。

import sys, subprocess, os, json, asyncio, re, uuid, time, random, mimetypes, socket
from datetime import datetime
from typing import Dict, Any, Optional

SERVER_VERSION = "debug-3.7-save-streams"

def auto_install(pkg):
    try:
        __import__(pkg)
    except ImportError:
        print(f"正在安装 {pkg} ...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", pkg])

auto_install("aiohttp")
from aiohttp import web, WSMsgType

# 常量路径
PROJECT_DIR = os.environ.get("LMARENA_PROJECT_DIR", "/storage/emulated/0/Download/lmarenabridge-main")
SAVE_DIR    = "/storage/emulated/0/LM对话"

# 全局状态
CONFIG: Dict[str, Any] = {}
MODEL_NAME_TO_ID_MAP: Dict[str, Dict[str, Optional[str]]] = {}
MODEL_ENDPOINT_MAP: Dict[str, Any] = {}
BROWSER_WS: Optional[web.WebSocketResponse] = None
RESPONSE_CHANNELS: Dict[str, asyncio.Queue] = {}
LAST_ACTIVITY_AT: Optional[float] = None

LAST_DEBUG: Dict[str, Any] = {}
DEBUG_HISTORY: list = []
DEBUG_HISTORY_MAX = 30
LAST_PAYLOAD: Dict[str, Any] = {}
LAST_RESPONSE: Dict[str, Any] = {}

# UI 页面
UI_HTML = r"""<!doctype html><html lang="zh"><head><meta charset="utf-8"/><title>LMArena Bridge 控制台</title><meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial;margin:16px;color:#222}h1{font-size:20px}.card{border:1px solid #ddd;border-radius:8px;padding:12px;margin:12px 0}
button{padding:8px 12px;border:0;border-radius:6px;background:#2b7cff;color:#fff;margin-right:8px;cursor:pointer}
button.secondary{background:#666}button:disabled{background:#aaa}input,select,textarea{width:100%;padding:8px;margin:6px 0 12px;border:1px solid #ccc;border-radius:6px}
.ok{color:#0a0}.warn{color:#c90}.err{color:#c00}code{background:#f6f8fa;padding:2px 4px;border-radius:4px}.row{display:flex;gap:8px;flex-wrap:wrap}.row>*{flex:1;min-width:180px}
.mono{font-family:ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap}</style></head><body>
<h1>LMArena Bridge 控制台</h1>
<div class="card" id="statusBox"><b>版本：</b> <code id="ver"></code><br/><b>连接状态：</b> <span id="wsState">检测中...</span><br/><b>配置目录：</b> <code id="cfgDir"></code><br/><b>保存目录：</b> <code id="saveDir"></code><br/><b>默认会话：</b> <code id="defaultIds"></code><br/><b>模式：</b> <code id="modeInfo"></code><br/><b>功能：</b> <code id="featureInfo"></code><br/><b>模型数：</b> <code id="modelCount"></code></div>

<div class="card"><h3>模型管理</h3><div class="row">
<button id="btnFetch">① 抓取可用模型</button>
<select id="genMode"><option value="merge" selected>合并生成 models.json（保留现有）</option><option value="replace">覆盖生成 models.json（清空重建）</option></select>
<button id="btnGen">② 生成 models.json</button>
<button id="btnReload" class="secondary">③ 重载配置</button>
</div><div id="modelMsg"></div></div>

<div class="card"><h3>ID 捕获</h3><p>点击"开始捕获"，然后到 LMArena 对话页点任意"Retry/重试"。抓到后会自动写入 config.jsonc。</p><button id="btnCapture">开始捕获</button> <span id="capMsg"></span></div>

<div class="card"><h3>测试聊天（支持流式）</h3><div class="row"><select id="modelSelect"></select></div>
<textarea id="prompt" rows="4" placeholder="在此输入你的问题..."></textarea>
<label><input type="checkbox" id="streamChk"> 使用 stream</label>
<button id="btnSend">发送</button>
<div id="respBox" class="mono"></div></div>

<div class="card"><h3>调试信息</h3>
<div style="margin-bottom:6px">
  <button id="dbgRefresh">刷新</button>
  <button id="dbgReset" class="secondary">清空</button>
  <button id="dbgShowPayload" class="secondary">最近Payload</button>
  <button id="dbgShowResp" class="secondary">最近响应</button>
</div>
<pre id="dbg" class="mono" style="max-height:45vh;overflow:auto"></pre>
</div>

<script>
const $=id=>document.getElementById(id); const api=(p,o={})=>fetch(p,o);
let modelsLoaded=false,selectedModel=null;

async function loadModelsOnce(){
  if(modelsLoaded) return;
  try{
    const r=await api('/v1/models'); const j=await r.json();
    const sel=$('modelSelect'); sel.innerHTML='';
    if(j.data&&j.data.length){
      j.data.forEach(m=>{ const o=document.createElement('option'); o.value=m.id; o.textContent=m.id; sel.appendChild(o); });
      if(selectedModel && j.data.some(x=>x.id===selectedModel)) sel.value=selectedModel; else selectedModel=sel.value;
    }
    sel.onchange=()=>{ selectedModel=sel.value; };
    modelsLoaded=true;
  }catch(e){}
}
async function updateStatusOnly(){
  try{
    const r=await api('/status'); const j=await r.json();
    $('ver').textContent=j.version||'N/A';
    $('wsState').textContent=j.ws_connected?'✅ 已连接油猴脚本':'❌ 未连接（请打开lmarena.ai页面）';
    $('wsState').className=j.ws_connected?'ok':'err';
    $('cfgDir').textContent=j.project_dir; $('saveDir').textContent=j.save_dir;
    $('defaultIds').textContent=(j.config.session_id||'')+' / '+(j.config.message_id||'');
    $('modeInfo').textContent=`${j.config.id_updater_last_mode||'direct_chat'} | battle=${j.config.id_updater_battle_target||'A'}`;
    $('featureInfo').textContent=`bypass=${!!j.config.bypass_enabled} | tavern=${!!j.config.tavern_mode_enabled}`;
    $('modelCount').textContent=j.model_count;
  }catch(e){$('wsState').textContent='状态读取失败';$('wsState').className='err';}
}
async function refreshDebug(){
  try{
    const r=await api('/debug'); const j=await r.json();
    $('dbg').textContent=JSON.stringify(j,null,2);
  }catch(e){}
}
async function refreshAll(){ await loadModelsOnce(); await updateStatusOnly(); await refreshDebug(); }
setInterval(updateStatusOnly,2000); setInterval(refreshDebug,2000); refreshAll();

$('btnFetch').onclick=async()=>{ $('modelMsg').textContent='抓取中...'; const r=await api('/internal/request_model_update',{method:'POST'}); $('modelMsg').textContent=r.ok?'已请求浏览器发送页面源码，请稍等1-3秒后执行②生成':'失败：请确认油猴已连接'; };
$('btnGen').onclick=async()=>{ const mode=$('genMode').value; $('modelMsg').textContent='生成中...'; const r=await api('/internal/generate_models',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode})}); const j=await r.json(); $('modelMsg').textContent=r.ok?`生成成功：${j.count} 个模型`:`失败：${j.error||'未知错误'}`; modelsLoaded=false; await loadModelsOnce(); };
$('btnReload').onclick=async()=>{ $('modelMsg').textContent='重载中...'; const r=await api('/internal/reload',{method:'POST'}); const j=await r.json(); $('modelMsg').textContent=r.ok?'重载成功':('失败：'+(j.error||'未知错误')); modelsLoaded=false; await loadModelsOnce(); };
$('btnCapture').onclick=async()=>{ $('capMsg').textContent='已触发，请去页面点Retry...'; const r=await api('/internal/start_id_capture',{method:'POST'}); $('capMsg').textContent=r.ok?'捕获模式已开启（标题会出现🎯）':'失败：请确认油猴已连接'; };
$('btnSend').onclick=async()=>{
  $('respBox').textContent='';
  const body={model:selectedModel||$('modelSelect').value,messages:[{role:'user',content:$('prompt').value||'Hello'}],stream: $('streamChk').checked===true};
  const r=await fetch('/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Accept': $('streamChk').checked?'text/event-stream':'application/json'},body:JSON.stringify(body)});
  if ($('streamChk').checked && r.headers.get('Content-Type')?.includes('text/event-stream')) {
    const reader=r.body.getReader(); const dec=new TextDecoder();
    while(true){ const {value,done}=await reader.read(); if(done) break; const s=dec.decode(value); $('respBox').textContent+=s; }
  } else {
    try{ const j=await r.json(); $('respBox').textContent=r.ok?(j.choices?.[0]?.message?.content||j.choices?.[0]?.text||JSON.stringify(j)) : JSON.stringify(j);}catch(e){$('respBox').textContent='返回内容解析失败';}
  }
};
$('dbgRefresh').onclick=refreshDebug;
$('dbgReset').onclick=async()=>{ await api('/debug/reset',{method:'POST'}); refreshDebug(); };
$('dbgShowPayload').onclick=async()=>{ const r=await api('/debug/last_payload'); const j=await r.json(); $('dbg').textContent=JSON.stringify(j,null,2); };
$('dbgShowResp').onclick=async()=>{ const r=await api('/debug/last_response'); const j=await r.json(); $('dbg').textContent=JSON.stringify(j,null,2); };
</script></body></html>
"""

# 工具
def ensure_dir(p):
    try: os.makedirs(p, exist_ok=True)
    except Exception as e: print(f"[WARN] 创建目录失败: {p} => {e}")

def jsonc_load(path)->Dict[str,Any]:
    try:
        with open(path,"r",encoding="utf-8") as f: c=f.read()
        c=re.sub(r'//.*','',c); c=re.sub(r'/\*.*?\*/','',c,flags=re.DOTALL)
        return json.loads(c) if c.strip() else {}
    except FileNotFoundError:
        print(f"[ERR] 文件不存在: {path}"); return {}
    except Exception as e:
        print(f"[ERR] 读取 {path} 失败: {e}"); return {}

def load_config():
    global CONFIG
    cfg=os.path.join(PROJECT_DIR,"config.jsonc")
    CONFIG=jsonc_load(cfg)
    print(f"[INFO] 配置已加载({cfg})。酒馆模式={'ON' if CONFIG.get('tavern_mode_enabled') else 'OFF'}，绕过={'ON' if CONFIG.get('bypass_enabled') else 'OFF'}")

def load_model_map():
    global MODEL_NAME_TO_ID_MAP
    p=os.path.join(PROJECT_DIR,'models.json')
    try:
        raw=json.load(open(p,'r',encoding='utf-8'))
        out={}
        for name,val in raw.items():
            if isinstance(val,str) and ':' in val:
                mid,typ=val.split(':',1); mid=None if mid and mid.lower()=='null' else mid
                out[name]={"id":mid,"type":typ}
            else:
                out[name]={"id":val,"type":"text"}
        MODEL_NAME_TO_ID_MAP=out
        print(f"[INFO] 已加载模型映射 {len(MODEL_NAME_TO_ID_MAP)} 个（{p}）。")
    except Exception as e:
        print(f"[ERR] 读取 {p} 失败: {e}"); MODEL_NAME_TO_ID_MAP={}

def load_model_endpoint_map():
    global MODEL_ENDPOINT_MAP
    p=os.path.join(PROJECT_DIR,'model_endpoint_map.json')
    try:
        s=open(p,'r',encoding='utf-8').read()
        MODEL_ENDPOINT_MAP=json.loads(s) if s.strip() else {}
        print(f"[INFO] 已加载模型端点映射 {len(MODEL_ENDPOINT_MAP)} 个（{p}）。")
    except FileNotFoundError:
        MODEL_ENDPOINT_MAP={}; print(f"[WARN] {p} 未找到，使用空映射。")
    except Exception as e:
        MODEL_ENDPOINT_MAP={}; print(f"[ERR] 读取 {p} 失败: {e}")

def save_config_ids(session_id: str, message_id: str):
    """终极修复版：安全更新 config.jsonc 中的 session_id 和 message_id"""
    path = os.path.join(PROJECT_DIR, 'config.jsonc')
    try:
        # 1. 读取或创建内容
        try:
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
        except FileNotFoundError:
            print(f"[WARN] {path} 不存在，创建新文件")
            content = '''{
  "version": "2.6.1",
  "session_id": "YOUR_SESSION_ID",
  "message_id": "YOUR_MESSAGE_ID",
  "id_updater_last_mode": "direct_chat",
  "id_updater_battle_target": "A",
  "bypass_enabled": true,
  "tavern_mode_enabled": false,
  "use_default_ids_if_mapping_not_found": true,
  "stream_response_timeout_seconds": 360,
  "enable_idle_restart": true,
  "idle_restart_timeout_seconds": -1,
  "api_key": "",
  "enable_auto_update": false
}'''

        # 2. 定义更健壮的键值对更新/追加函数
        def robust_upsert(text: str, key: str, value: str) -> str:
            """
            更健壮地更新或插入键值对：
            - 如果键存在，只替换值。
            - 如果键不存在，智能地在末尾追加，并正确处理逗号。
            """
            # 尝试替换已存在的键值
            pattern = re.compile(rf'("{key}"\s*:\s*")([^"]*?)(")', re.MULTILINE)
            match = pattern.search(text)
            if match:
                # 键已存在，直接替换值
                return pattern.sub(rf'\g<1>{value}\g<3>', text, count=1)
            else:
                # 键不存在，需要追加
                # 找到最后一个 '}' 的位置
                last_brace_pos = text.rfind('}')
                if last_brace_pos == -1:
                    # 文件格式已损坏，不进行任何操作
                    print(f"[ERR] 无法在 config.jsonc 中找到 '}}'，跳过更新 {key}")
                    return text

                # 检查 '}' 前的内容，判断是否需要加逗号
                before_brace = text[:last_brace_pos].rstrip()
                
                # 如果 '}' 前面只有一个 '{'，说明是空对象，不需要逗号
                if before_brace.endswith('{'):
                    prefix = ''
                else:
                    prefix = ','

                # 准备要插入的内容，保持格式美观
                # 假设文件末尾有换行符，我们插入到 '}' 的前一行
                insertion = f'{prefix}\n  "{key}": "{value}"'
                
                # 插入新内容
                return text[:last_brace_pos] + insertion + text[last_brace_pos:]

        # 3. 依次执行更新
        content = robust_upsert(content, "session_id", session_id)
        content = robust_upsert(content, "message_id", message_id)

        # 4. 写回文件
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)

        # 5. 更新内存中的配置并打印日志
        CONFIG["session_id"] = session_id
        CONFIG["message_id"] = message_id
        print(f"[INFO] ✅ 已更新 config.jsonc:")
        print(f"       session_id: ...{session_id[-8:]}")
        print(f"       message_id: ...{message_id[-8:]}")

    except Exception as e:
        print(f"[ERR] ❌ 写入配置文件失败: {e}")
        import traceback
        traceback.print_exc()

# ChatLogger
class ChatLogger:
    def __init__(self, base_dir: str): self.dir=base_dir; ensure_dir(self.dir)
    
    @staticmethod
    def _safe(s:str): return re.sub(r'[\\/:*?"<>|]+','_',s)
    
    def save(self, model: str, req: Dict[str, Any], reply: str, reason: str):
        ts = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        
        # 提取用户提问的摘要作为文件名的一部分
        prompt_snippet = "无提问"
        messages = req.get("messages", [])
        if messages and isinstance(messages, list):
            # 找到最后一个用户消息
            for msg in reversed(messages):
                if msg.get("role") == "user":
                    content = msg.get("content")
                    if isinstance(content, str):
                        prompt_snippet = content.strip()[:20] or "空提问"
                    elif isinstance(content, list): # 处理 vision model
                        for part in content:
                           if part.get("type") == "text":
                               prompt_snippet = part.get("text", "").strip()[:20] or "图片提问"
                               break
                    break
        
        safe_snippet = self._safe(prompt_snippet)
        base = f"{ts}_{self._safe(model or 'unknown')}_{safe_snippet}"
        
        jp=os.path.join(self.dir,f"{base}.json")
        mp=os.path.join(self.dir,f"{base}.md")
        rec={"timestamp":ts,"model":model,"finish_reason":reason,"request":req,"reply":reply}
        
        try:
            with open(jp,"w",encoding="utf-8") as f:
                json.dump(rec, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[WARN] 保存JSON日志失败: {e}")
        
        try:
            md_content = [
                f"# 模型: {model or 'unknown'}",
                f"- 时间: {ts}",
                f"- 结束原因: {reason}",
                "",
                "## 提问",
                "```json",
                json.dumps(req.get("messages",[]),ensure_ascii=False,indent=2),
                "```",
                "",
                "## 回复",
                reply or ""
            ]
            with open(mp, "w", encoding="utf-8") as f:
                f.write("\n".join(md_content))
        except Exception as e:
            print(f"[WARN] 保存Markdown日志失败: {e}")

CHAT_LOGGER = ChatLogger(SAVE_DIR)

# 处理OpenAI消息为 LMArena 模板
def _process_openai_message(m:dict)->dict:
    content=m.get("content"); role=m.get("role"); atts=[]; txt=""
    if isinstance(content,list):
        parts=[]
        for part in content:
            if part.get("type")=="text": parts.append(part.get("text",""))
            elif part.get("type")=="image_url":
                d=part.get("image_url",{}); url=d.get("url"); orig=d.get("detail")
                if url and isinstance(url,str) and url.startswith("data:"):
                    try:
                        ctype=url.split(';')[0].split(':')[1]
                        if orig and isinstance(orig,str): fname=orig
                        else:
                            if '/' in ctype: main,sub=ctype.split('/')
                            else: main,sub='application','octet-stream'
                            pref="image" if main=="image" else ("audio" if main=="audio" else "file")
                            ext=mimetypes.guess_extension(ctype); ext=(ext.lstrip('.') if ext else (sub if len(sub)<20 else 'bin'))
                            fname=f"{pref}_{uuid.uuid4()}.{ext}"
                        atts.append({"name":fname,"contentType":ctype,"url":url})
                    except Exception: pass
        txt="\n\n".join(parts)
    elif isinstance(content,str):
        txt=content
    if role=="user" and not (txt or "").strip():
        txt=" "
    return {"role":role,"content":txt,"attachments":atts}

def convert_openai_to_lmarena_payload(data:dict,session_id:str,message_id:str,mode_override:Optional[str]=None,battle_target_override:Optional[str]=None)->dict:
    msgs=data.get("messages",[])
    for msg in msgs:
        if msg.get("role")=="developer": msg["role"]="system"
    processed=[_process_openai_message(x.copy()) for x in msgs]

    if CONFIG.get("tavern_mode_enabled"):
        sysps=[m['content'] for m in processed if m['role']=='system']; others=[m for m in processed if m['role']!='system']
        merged="\n\n".join(sysps); final=[]
        if merged: final.append({"role":"system","content":merged,"attachments":[]})
        final.extend(others); processed=final

    model_name=data.get("model","")
    info=MODEL_NAME_TO_ID_MAP.get(model_name,{})
    target_id=info.get("id")

    templates=[{"role":m["role"],"content":m.get("content",""),"attachments":m.get("attachments",[])} for m in processed]

    if CONFIG.get("bypass_enabled") and info.get("type","text")=="text":
        templates.append({"role":"user","content":" ","participantPosition":"a","attachments":[]})

    mode=mode_override or CONFIG.get("id_updater_last_mode","direct_chat")
    target=(battle_target_override or CONFIG.get("id_updater_battle_target","A")).lower()
    for t in templates:
        if t['role']=='system':
            t['participantPosition']= (target if mode=='battle' else 'b')
        else:
            t['participantPosition']= (target if mode=='battle' else 'a')

    return {"message_templates":templates,"target_model_id":target_id,"session_id":session_id,"message_id":message_id,"is_image_request": info.get("type","text")=="image"}

# 非流式返回格式（OpenAI / LMStudio 混合兼容）
def format_openai_non_stream_response(content:str,model:str,rid:str,reason:str='stop')->dict:
    return {"id":rid,"object":"chat.completion","created":int(time.time()),"model":model,
            "choices":[{"index":0,"message":{"role":"assistant","content":content},"text":content,"finish_reason":reason}],
            "usage":{"prompt_tokens":0,"completion_tokens":len(content)//4,"total_tokens":len(content)//4}}

def format_lmstudio_non_stream_response(content:str,model:str,rid:str,reason:str='stop')->dict:
    # 混合兼容：LM Studio 的 text + OpenAI 的 message 都返回
    return {"id":rid,"object":"text_completion","created":int(time.time()),"model":model,
            "choices":[{"index":0,"text":content,"message":{"role":"assistant","content":content},"finish_reason":reason}],
            "usage":{"prompt_tokens":0,"completion_tokens":len(content)//4,"total_tokens":len(content)//4}}

# 解析浏览器流（非流式聚合，带统计）
async def process_lmarena_stream(request_id: str):
    queue: asyncio.Queue = RESPONSE_CHANNELS.get(request_id)
    if not queue:
        yield ('error','response channel not found'); return

    buffer=""; timeout=CONFIG.get("stream_response_timeout_seconds",360)
    text_pat=re.compile(r'[ab]0:"((?:\\.|[^"\\])*)"')
    img_pat =re.compile(r'[ab]2:(\[.*?\])')
    fin_pat =re.compile(r'[ab]d:(\{.*?"finishReason".*?\})')
    err_pat =re.compile(r'(\{\s*"error".*?\})', re.DOTALL)
    cf=[r'<title>Just a moment...</title>', r'Enable JavaScript and cookies to continue']

    t0=time.time(); first_chunk_ts=None; total_chunks=0; total_bytes=0

    try:
        while True:
            try: raw=await asyncio.wait_for(queue.get(),timeout=timeout)
            except asyncio.TimeoutError:
                yield ('error', f"Response timed out after {timeout} seconds."); return

            if isinstance(raw,dict) and 'error' in raw:
                err=raw.get('error','Unknown browser error')
                if isinstance(err,str):
                    if '413' in err or 'too large' in err.lower(): yield ('error',"上传失败：附件大小超过了服务器限制。"); return
                    if any(re.search(p,err,re.IGNORECASE) for p in cf): yield ('error',"检测到 Cloudflare 验证，请刷新 LMArena 页面并完成验证后重试。"); return
                yield ('error', str(err)); return

            if raw=="[DONE]": break

            s = "".join(str(x) for x in raw) if isinstance(raw,list) else str(raw)
            buffer += s
            if first_chunk_ts is None and s: first_chunk_ts = time.time()
            total_chunks += 1
            total_bytes  += len(s.encode('utf-8','ignore'))

            if any(re.search(p,buffer,re.IGNORECASE) for p in cf):
                yield ('error',"检测到 Cloudflare 验证，请刷新 LMArena 页面并完成验证后重试。"); return

            m=err_pat.search(buffer)
            if m:
                try: ej=json.loads(m.group(1)); yield ('error', ej.get("error","LMArena 未知错误")); return
                except: pass

            while True:
                mt=text_pat.search(buffer)
                if not mt: break
                try:
                    txt=json.loads(f'"{mt.group(1)}"')
                    if txt: yield ('content', txt)
                except: pass
                buffer=buffer[mt.end():]

            while True:
                mi=img_pat.search(buffer)
                if not mi: break
                try:
                    lst=json.loads(mi.group(1))
                    if isinstance(lst,list) and lst:
                        info=lst[0]
                        if info.get("type")=="image" and "image" in info: yield ('content', f"![Image]({info['image']})")
                except: pass
                buffer=buffer[mi.end():]

            mf=fin_pat.search(buffer)
            if mf:
                try: fd=json.loads(mf.group(1)); yield ('finish', fd.get("finishReason","stop"))
                except: pass
                buffer=buffer[mf.end():]
    finally:
        try:
            if LAST_DEBUG and LAST_DEBUG.get("request_id")==request_id:
                LAST_DEBUG["stats"] = {
                    "first_chunk_latency_ms": int(((first_chunk_ts or t0)-t0)*1000),
                    "chunks": total_chunks,
                    "bytes": total_bytes,
                    "duration_ms": int((time.time()-t0)*1000)
                }
        except: pass
        RESPONSE_CHANNELS.pop(request_id, None)

# CORS
@web.middleware
async def cors_middleware(request, handler):
    if request.method == "OPTIONS":
        h={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization"}
        return web.Response(status=200, headers=h)
    resp = await handler(request)
    if isinstance(resp, web.StreamResponse):
        resp.headers["Access-Control-Allow-Origin"]="*"
        resp.headers["Access-Control-Allow-Headers"]="Content-Type, Authorization"
        resp.headers["Access-Control-Allow-Methods"]="GET,POST,OPTIONS"
    return resp

# WebSocket
async def ws_handler(request: web.Request):
    global BROWSER_WS
    ws = web.WebSocketResponse(); await ws.prepare(request)
    if BROWSER_WS is not None:
        try: await BROWSER_WS.close()
        except: pass
    BROWSER_WS = ws
    print("[INFO] ✅ 油猴脚本已连接 WebSocket。")
    async for msg in ws:
        if msg.type == WSMsgType.TEXT:
            try:
                m=json.loads(msg.data); rid=m.get("request_id"); data=m.get("data")
                if not rid or data is None: continue
                if rid in RESPONSE_CHANNELS: await RESPONSE_CHANNELS[rid].put(data)
                else: pass
            except Exception as e: print(f"[ERR] WS消息处理异常: {e}")
        elif msg.type == WSMsgType.ERROR:
            print(f"[ERR] WS异常: {ws.exception()}")
    if BROWSER_WS is ws: BROWSER_WS = None
    for q in list(RESPONSE_CHANNELS.values()):
        try: await q.put({"error": "Browser disconnected"})
        except: pass
    print("[INFO] ❌ 油猴脚本已断开。")
    return ws

# 调试工具
def _record_debug(dbg: Dict[str,Any]):
    global LAST_DEBUG, DEBUG_HISTORY
    LAST_DEBUG = dbg
    DEBUG_HISTORY.append(dbg.copy())
    if len(DEBUG_HISTORY) > DEBUG_HISTORY_MAX:
        DEBUG_HISTORY = DEBUG_HISTORY[-DEBUG_HISTORY_MAX:]

async def status_page(request: web.Request): return web.Response(text=UI_HTML, content_type="text/html")
async def status_json(request: web.Request):
    return web.json_response({
        "version": SERVER_VERSION,
        "ws_connected": BROWSER_WS is not None and not BROWSER_WS.closed,
        "project_dir": PROJECT_DIR, "save_dir": SAVE_DIR,
        "config": {
            "session_id": CONFIG.get("session_id"),
            "message_id": CONFIG.get("message_id"),
            "id_updater_last_mode": CONFIG.get("id_updater_last_mode"),
            "id_updater_battle_target": CONFIG.get("id_updater_battle_target"),
            "bypass_enabled": CONFIG.get("bypass_enabled"),
            "tavern_mode_enabled": CONFIG.get("tavern_mode_enabled"),
        },
        "model_count": len(MODEL_NAME_TO_ID_MAP),
        "last_activity_at": LAST_ACTIVITY_AT
    })
async def debug_json(request: web.Request): return web.json_response(LAST_DEBUG or {})
async def debug_history(request: web.Request): return web.json_response(DEBUG_HISTORY)
async def debug_reset(request: web.Request):
    global LAST_DEBUG, DEBUG_HISTORY, LAST_PAYLOAD, LAST_RESPONSE
    LAST_DEBUG = {}; DEBUG_HISTORY = []; LAST_PAYLOAD = {}; LAST_RESPONSE = {}
    return web.json_response({"status":"cleared"})
async def debug_last_payload(request: web.Request): return web.json_response(LAST_PAYLOAD or {})
async def debug_last_response(request: web.Request): return web.json_response(LAST_RESPONSE or {})

# 模型与内部工具
async def get_models(request: web.Request):
    if not MODEL_NAME_TO_ID_MAP:
        return web.json_response({"error":"模型列表为空或未找到。"},status=404)
    data=[{"id": n, "object":"model", "created": int(time.time()), "owned_by":"LMArenaBridge"} for n in MODEL_NAME_TO_ID_MAP.keys()]
    return web.json_response({"object":"list","data":data})

def extract_models_from_html(html:str):
    models,names=[],set()
    for m in re.finditer(r'\{\\"id\\":\\"[a-f0-9-]+\\"',html):
        i=m.start(); ob=0; end=-1
        for k in range(i,min(len(html),i+10000)):
            if html[k]=='{': ob+=1
            elif html[k]=='}':
                ob-=1
                if ob==0: end=k+1; break
        if end!=-1:
            js=html[i:end].replace('\\"','"').replace('\\\\','\\')
            try:
                d=json.loads(js); pn=d.get('publicName') or d.get('name')
                if pn and pn not in names: names.add(pn); models.append(d)
            except: pass
    return models

def save_available_models(lst,filename="available_models.json"):
    p=os.path.join(PROJECT_DIR,filename)
    try:
        json.dump(lst,open(p,'w',encoding='utf-8'),ensure_ascii=False,indent=2)
        print(f"[INFO] 可用模型已写入 {p} ({len(lst)} 个)")
    except Exception as e: print(f"[ERR] 写入 {p} 失败: {e}")

async def internal_request_model_update(request: web.Request):
    if not BROWSER_WS: return web.json_response({"error":"Browser client not connected."},status=503)
    try: await BROWSER_WS.send_json({"command":"send_page_source"}); return web.json_response({"status":"success"})
    except Exception as e: return web.json_response({"error": str(e)}, status=500)

async def internal_update_available_models(request: web.Request):
    try: body=await request.text()
    except Exception: body=""
    if not body: return web.json_response({"status":"error","message":"No HTML content received."},status=400)
    models=extract_models_from_html(body)
    if models: save_available_models(models); return web.json_response({"status":"success"})
    return web.json_response({"status":"error","message":"Could not extract model data from HTML."},status=400)

async def internal_start_id_capture(request: web.Request):
    if not BROWSER_WS: return web.json_response({"error":"Browser client not connected."},status=503)
    try: await BROWSER_WS.send_json({"command":"activate_id_capture"}); return web.json_response({"status":"success"})
    except Exception as e: return web.json_response({"error": str(e)}, status=500)

async def internal_reload(request: web.Request):
    try: load_config(); load_model_map(); load_model_endpoint_map(); return web.json_response({"status":"reloaded"})
    except Exception as e: return web.json_response({"error": str(e)}, status=500)

async def internal_generate_models(request: web.Request):
    mode="merge"
    try: j=await request.json(); mode=j.get("mode","merge")
    except: pass
    ap=os.path.join(PROJECT_DIR,"available_models.json")
    if not os.path.exists(ap):
        return web.json_response({"error": 'available_models.json 不存在，请先执行"抓取可用模型"'}, status=400)
    try: avail=json.load(open(ap,"r",encoding="utf-8"))
    except Exception as e: return web.json_response({"error":f"读取 available_models.json 失败: {e}"},status=500)
    kws=["dall","banana","image","图片","文生图","flux","sd","stable","midjourney","kandinsky","ideogram","recraft","sdxl"]
    new={}
    for m in avail:
        name=(m.get("publicName") or m.get("name") or m.get("id") or "").strip(); mid=(m.get("id") or "").strip()
        if not name or not mid: continue
        is_img=any(k in name.lower() for k in kws); new[name]=f"{mid}:image" if is_img else mid
    out=os.path.join(PROJECT_DIR,"models.json")
    if mode=="merge" and os.path.exists(out):
        try: old=json.load(open(out,"r",encoding="utf-8"))
        except: old={}
        merged=dict(old); merged.update(new); json.dump(merged,open(out,"w",encoding="utf-8"),ensure_ascii=False,indent=2); cnt=len(merged)
    else:
        json.dump(new,open(out,"w",encoding="utf-8"),ensure_ascii=False,indent=2); cnt=len(new)
    return web.json_response({"status":"ok","count":cnt})

# SSE 工具
async def _sse_prepare(request: web.Request) -> web.StreamResponse:
    resp = web.StreamResponse(
        status=200,
        reason='OK',
        headers={
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        },
    )
    await resp.prepare(request)
    return resp

async def _sse_send(resp: web.StreamResponse, obj: Any):
    data = "data: " + (json.dumps(obj, ensure_ascii=False) if not isinstance(obj, str) else obj)
    data += "\n\n"
    await resp.write(data.encode("utf-8"))

async def _sse_done(resp: web.StreamResponse):
    try:
        await _sse_send(resp, "[DONE]")
    finally:
        try: await resp.write_eof()
        except: pass

# 主逻辑（支持 SSE + 非流式；按路径决定协议）
async def chat_completions(request: web.Request):
    global LAST_ACTIVITY_AT, LAST_PAYLOAD, LAST_RESPONSE, LAST_DEBUG
    LAST_ACTIVITY_AT = time.time()
    load_config()

    path = request.rel_url.path or ""
    if path.endswith("/v1/chat/completions"): compat_mode = 'openai'
    elif path.endswith("/v1/completions") or path.endswith("/completions"): compat_mode = 'lmstudio'
    else: compat_mode = 'openai'

    api_key = CONFIG.get("api_key")
    if api_key:
        auth = request.headers.get("Authorization", "")
        if not (auth.startswith("Bearer ") and auth.split(" ", 1)[1] == api_key):
            return web.json_response({"error": {"message": "未提供或提供了错误的 API Key"}}, status=401)

    if not BROWSER_WS: return web.json_response({"error": "油猴脚本未连接，请打开 LMArena 页面。"}, status=503)

    try: openai_req = await request.json()
    except Exception: return web.json_response({"error": "无效的 JSON 请求体"}, status=400)

    stream_param = bool(openai_req.get("stream", False))

    if compat_mode == 'lmstudio' and ("messages" not in openai_req):
        prompt = openai_req.get("prompt")
        openai_req["messages"] = [{"role": "user", "content": prompt if isinstance(prompt, str) else " "}]

    model_name = openai_req.get("model")
    info = MODEL_NAME_TO_ID_MAP.get(model_name, {})
    
    session_id, message_id, mode_override, battle_target_override, mapping_source = None, None, None, None, "default"
    if model_name and model_name in MODEL_ENDPOINT_MAP:
        ent = MODEL_ENDPOINT_MAP[model_name]
        ch = random.choice(ent) if isinstance(ent, list) and ent else (ent if isinstance(ent, dict) else None)
        if ch:
            session_id, message_id = ch.get("session_id"), ch.get("message_id")
            mode_override, battle_target_override = ch.get("mode"), ch.get("battle_target")
            mapping_source = "mapping"
    
    if not session_id:
        if CONFIG.get("use_default_ids_if_mapping_not_found", True):
            session_id, message_id, mapping_source = CONFIG.get("session_id"), CONFIG.get("message_id"), "default"
        else:
            return web.json_response({"error": f"模型 '{model_name}' 没有配置独立会话ID，且禁用了默认回退。"}, status=400)
    
    if not all([session_id, message_id]) or "YOUR_" in session_id or "YOUR_" in message_id:
        return web.json_response({"error": "最终会话ID或消息ID无效。请在 config.jsonc 或 model_endpoint_map.json 中正确配置，或运行ID捕获。"}, status=400)

    dbg = {
        "request_id": None, "ts": datetime.now().isoformat(timespec='seconds'),
        "server_version": SERVER_VERSION, "path": path, "compat_mode": compat_mode,
        "headers": {k: v[:180] for k, v in request.headers.items() if k in ["Accept", "Content-Type", "User-Agent"]},
        "openai_req_summary": {"stream_param": stream_param, "message_count": len(openai_req.get("messages",[]))},
        "model": {"name": model_name, "type": info.get("type","text"), "target_model_id": info.get("id")},
        "session": {"source": mapping_source, "session_tail": (session_id or "")[-8:], "message_tail": (message_id or "")[-8:]},
        "decide": {"format": compat_mode, "streaming": stream_param}, "stats": {}, "error": None
    }
    request_id = str(uuid.uuid4()); dbg["request_id"] = request_id
    
    RESPONSE_CHANNELS[request_id] = asyncio.Queue()
    try:
        payload = convert_openai_to_lmarena_payload(openai_req, session_id, message_id, mode_override, battle_target_override)
        LAST_PAYLOAD.clear(); LAST_PAYLOAD.update(payload)
        await BROWSER_WS.send_json({"request_id": request_id, "payload": payload})
    except Exception as e:
        RESPONSE_CHANNELS.pop(request_id, None); dbg["error"] = f"send_to_browser_failed: {e}"; _record_debug(dbg)
        return web.json_response({"error": f"发送到浏览器失败: {e}"}, status=500)

    final_parts, finish_reason = [], "stop"
    
    try:
        if stream_param:
            resp = await _sse_prepare(request)
            rid = f"chatcmpl-{uuid.uuid4()}"
            
            async for etype, data in process_lmarena_stream(request_id):
                if etype == 'content':
                    s = str(data); final_parts.append(s)
                    chunk = {"id": rid, "object": "chat.completion.chunk", "created": int(time.time()), "model": model_name or "unknown",
                             "choices": [{"index": 0, "delta": {"content": s}, "finish_reason": None}]} if compat_mode == 'openai' else \
                            {"id": rid, "object": "text_completion", "created": int(time.time()), "model": model_name or "unknown",
                             "choices": [{"index": 0, "text": s, "finish_reason": None}]}
                    await _sse_send(resp, chunk)
                
                elif etype == 'finish':
                    finish_reason = str(data or "stop")
                    end_chunk = {"id": rid, "object": "chat.completion.chunk", "created": int(time.time()), "model": model_name or "unknown",
                                 "choices": [{"index": 0, "delta": {}, "finish_reason": finish_reason}]} if compat_mode == 'openai' else \
                                {"id": rid, "object": "text_completion", "created": int(time.time()), "model": model_name or "unknown",
                                 "choices": [{"index": 0, "text": "", "finish_reason": finish_reason}]}
                    await _sse_send(resp, end_chunk); await _sse_done(resp)

                elif etype == 'error':
                    dbg["error"] = finish_reason = str(data); final_parts.append(f"\n[LMArena Bridge Error]: {data}")
                    err_txt = f"[LMArena Bridge Error]: {data}"
                    err_chunk = {"id": rid, "object": "chat.completion.chunk", "created": int(time.time()), "model": model_name or "unknown",
                                 "choices": [{"index": 0, "delta": {"content": err_txt}, "finish_reason": "error"}]} if compat_mode == 'openai' else \
                                {"id": rid, "object": "text_completion", "created": int(time.time()), "model": model_name or "unknown",
                                 "choices": [{"index": 0, "text": err_txt, "finish_reason": "error"}]}
                    await _sse_send(resp, err_chunk); await _sse_done(resp)
                    break
            
            dbg["stats"]["final_len"] = sum(len(p) for p in final_parts)
            return resp # SSE响应已发送，直接返回
        
        else: # 非流式
            async for etype, data in process_lmarena_stream(request_id):
                if etype == 'content': final_parts.append(str(data))
                elif etype == 'finish': finish_reason = data
                elif etype == 'error':
                    dbg["error"] = str(data)
                    status = 413 if "附件大小超过" in str(data) else 500
                    err = {"error":{"message":f"[LMArena Bridge Error]: {data}"}}
                    _record_debug(dbg); CHAT_LOGGER.save(model_name or "unknown", openai_req, f"[Error] {data}", "error")
                    return web.json_response(err, status=status)
            
            final_txt = "".join(final_parts); dbg["stats"]["final_len"] = len(final_txt)
            rid = f"chatcmpl-{uuid.uuid4()}"
            body = format_lmstudio_non_stream_response(final_txt, model_name or "unknown", rid, finish_reason) if compat_mode == 'lmstudio' else \
                   format_openai_non_stream_response(final_txt, model_name or "unknown", rid, finish_reason)
            LAST_RESPONSE.clear(); LAST_RESPONSE.update({"response": body})
            return web.json_response(body)

    except ConnectionResetError:
        dbg["error"] = "client_disconnected"; finish_reason = "client_disconnected"
        return web.Response(status=499, text="Client Closed Request")
    except Exception as e:
        dbg["error"] = f"main_handler_failed: {e}"; finish_reason = "error"
        return web.json_response({"error": str(e)}, status=500)
    finally:
        _record_debug(dbg)
        # 无论流式还是非流式，成功还是失败，只要有内容就保存
        final_txt = "".join(final_parts)
        if final_txt:
            CHAT_LOGGER.save(model_name or "unknown", openai_req, final_txt, finish_reason)


# ID 更新服务（5103）
async def id_update(request: web.Request):
    try:
        j=await request.json(); sid=j.get("sessionId"); mid=j.get("messageId")
        if not sid or not mid: return web.json_response({"error":"缺少 sessionId 或 messageId"}, status=400)
        save_config_ids(sid, mid); return web.json_response({"status":"ok"})
    except Exception as e: return web.json_response({"error": str(e)}, status=500)

# 路由注册
async def init_main_app():
    app = web.Application(middlewares=[cors_middleware])
    app.add_routes([
        web.get("/ws", ws_handler),
        web.get("/v1/models", get_models),
        web.get("/models", get_models),
        web.post("/v1/chat/completions", chat_completions),
        web.post("/v1/completions", chat_completions),
        web.post("/completions", chat_completions),
        web.get("/ui", status_page),
        web.get("/status", status_json),
        web.get("/debug", debug_json),
        web.get("/debug/history", debug_history),
        web.post("/debug/reset", debug_reset),
        web.get("/debug/last_payload", debug_last_payload),
        web.get("/debug/last_response", debug_last_response),
        web.post("/internal/request_model_update", internal_request_model_update),
        web.post("/internal/update_available_models", internal_update_available_models),
        web.post("/internal/start_id_capture", internal_start_id_capture),
        web.post("/internal/reload", internal_reload),
        web.post("/internal/generate_models", internal_generate_models),
    ])
    return app

async def init_id_app():
    app = web.Application(middlewares=[cors_middleware])
    app.add_routes([web.post("/update", id_update)])
    return app

def get_ipv6_address() -> Optional[str]:
    """尝试获取本机的公网IPv6地址"""
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None):
            if info[0] == socket.AF_INET6:
                ip = info[4][0]
                if not ip.startswith(('fe80:', '::1')) and (ip.startswith('2') or ip.startswith('3')):
                    return ip.split('%')[0]
    except Exception:
        return None
    return None

async def main():
    ipv6 = get_ipv6_address()

    print("========================================")
    print(f"  LMArena API Bridge (Mobile) 启动 - {SERVER_VERSION}")
    
    if ipv6:
        print(f"  ✅ 检测到公网IPv6地址: {ipv6}")
        print(f"  - 公网访问 (UI): http://[{ipv6}]:5102/ui")
        print(f"  - 公网API基地址: http://[{ipv6}]:5102")
    else:
        print("  ⚠️ 未检测到可用的公网IPv6地址。")

    print(f"  - 本地主服务: http://127.0.0.1:5102  (WS: /ws)")
    print(f"  - 本地UI页面: http://127.0.0.1:5102/ui")
    print(f"  - ID捕获服务: (本地: 127.0.0.1:5103)")
    print(f"  - 配置目录: {PROJECT_DIR}")
    print(f"  - 日志目录: {SAVE_DIR}")
    print("========================================")
    
    ensure_dir(SAVE_DIR); load_config(); load_model_map(); load_model_endpoint_map()
    
    app = await init_main_app(); runner = web.AppRunner(app); await runner.setup()
    site = web.TCPSite(runner,"0.0.0.0",5102); await site.start()
    
    id_app = await init_id_app(); id_runner = web.AppRunner(id_app); await id_runner.setup()
    id_site = web.TCPSite(id_runner,"0.0.0.0",5103); await id_site.start()
    
    print("[INFO] 所有服务已启动。按 Ctrl+C 停止。")
    while True: await asyncio.sleep(3600)

if __name__=="__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[INFO] 已停止。")
