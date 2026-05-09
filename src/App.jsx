import { useCallback, useEffect, useMemo, useState } from 'react';
import { APP_CONFIG, getModelById, getThemeById } from './database.js';
import LoadingScreen from './components/LoadingScreen.jsx';
import LoginGate from './components/LoginGate.jsx';
import ChatLayout from './components/ChatLayout.jsx';
import { canSendNow } from './utils/rateLimit.js';
import { attachmentsToPromptContext, hasImageAttachment } from './utils/fileReader.js';
import { clampText, createId, safeTitle } from './utils/sanitize.js';
import {
  clearAllChats,
  deleteChat,
  getLastChatId,
  getSessionId,
  getStorageMode,
  loadChats,
  loadPreferences,
  saveChat,
  savePreferences,
  setLastChatId
} from './utils/storage.js';

function makeChat(model = 'instant') {
  const now = new Date().toISOString();
  return {
    id: createId('chat'),
    title: 'Chat Baru',
    model,
    createdAt: now,
    updatedAt: now,
    messages: []
  };
}

function makeMessage(role, content, extra = {}) {
  return {
    id: createId('msg'),
    role,
    content,
    createdAt: new Date().toISOString(),
    attachments: [],
    ...extra
  };
}

function helpText() {
  return [
    'Command DRAK-GPT:',
    '',
    '- `/help` tampilkan bantuan ini',
    '- `/new` buat chat baru',
    '- `/clear` bersihkan chat aktif',
    '- `/theme red|blue|purple|dark` ganti tema',
    '- `/coding` aktifkan mode Coding',
    '- `/thinking` aktifkan mode Thinking',
    '- `/pro` aktifkan mode Pro',
    '- `/image` info fitur gambar'
  ].join('\n');
}

function trimHistoryForPrompt(messages = [], maxMessages = 10, maxChars = APP_CONFIG.limits.maxContextChars) {
  const relevant = [...messages]
    .filter((message) => !message.loading && (message.role === 'user' || message.role === 'assistant'))
    .slice(-maxMessages)
    .map((message) => ({
      role: message.role,
      content: clampText(message.content || '', 1200),
      createdAt: message.createdAt
    }));

  let used = 0;
  const trimmed = [];
  for (const item of [...relevant].reverse()) {
    const cost = item.content.length + 24;
    if (used + cost > maxChars) break;
    used += cost;
    trimmed.unshift(item);
  }
  return trimmed;
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(() => !APP_CONFIG.accessGate.enabled || window.localStorage.getItem(APP_CONFIG.accessGate.storageKey) === 'true');
  const [sessionId] = useState(() => getSessionId());
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [model, setModel] = useState(() => loadPreferences().model || APP_CONFIG.models[0].id);
  const [themeId, setThemeId] = useState(() => loadPreferences().theme || APP_CONFIG.defaultTheme);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [notice, setNotice] = useState('');
  const [online, setOnline] = useState(() => navigator.onLine);

  const activeChat = useMemo(() => chats.find((chat) => chat.id === activeChatId) || null, [chats, activeChatId]);
  const storageMode = getStorageMode();

  const showNotice = useCallback((message) => {
    setNotice(message);
    window.clearTimeout(showNotice.timer);
    showNotice.timer = window.setTimeout(() => setNotice(''), 3600);
  }, []);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    const theme = getThemeById(themeId);
    const root = document.documentElement;
    root.dataset.theme = theme.id;
    root.style.setProperty('--accent', theme.accent);
    root.style.setProperty('--accent-2', theme.accent2);
    root.style.setProperty('--accent-glow', theme.glow);
    root.style.setProperty('--theme-bg', theme.bg);
    savePreferences({ theme: themeId, model });
  }, [themeId, model]);

  useEffect(() => {
    let mounted = true;
    loadChats(sessionId).then((loaded) => {
      if (!mounted) return;
      const sorted = [...loaded].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      if (sorted.length) {
        const last = getLastChatId();
        setChats(sorted);
        setActiveChatId(sorted.some((chat) => chat.id === last) ? last : sorted[0].id);
      } else {
        const fresh = makeChat(model);
        setChats([fresh]);
        setActiveChatId(fresh.id);
        setLastChatId(fresh.id);
      }
    });
    return () => {
      mounted = false;
    };
  }, [sessionId]);

  const persistChat = useCallback(async (chat) => {
    const next = await saveChat(chat, sessionId);
    setChats(next);
    setActiveChatId(chat.id);
    setLastChatId(chat.id);
  }, [sessionId]);

  const updateActiveChat = useCallback(async (updater) => {
    const base = activeChat || makeChat(model);
    const nextChat = typeof updater === 'function' ? updater(base) : updater;
    await persistChat(nextChat);
    return nextChat;
  }, [activeChat, model, persistChat]);

  const newChat = useCallback(() => {
    const fresh = makeChat(model);
    setChats((prev) => [fresh, ...prev.filter((chat) => chat.messages.length)]);
    setActiveChatId(fresh.id);
    setLastChatId(fresh.id);
    setSidebarOpen(false);
    setAttachments([]);
  }, [model]);

  const selectChat = useCallback((chatId) => {
    setActiveChatId(chatId);
    setLastChatId(chatId);
    setSidebarOpen(false);
  }, []);

  const removeChat = useCallback(async (chatId) => {
    if (!window.confirm('Hapus chat ini?')) return;
    const next = await deleteChat(chatId, sessionId);
    if (!next.length) {
      const fresh = makeChat(model);
      setChats([fresh]);
      setActiveChatId(fresh.id);
      setLastChatId(fresh.id);
    } else {
      setChats(next);
      if (chatId === activeChatId) {
        setActiveChatId(next[0].id);
        setLastChatId(next[0].id);
      }
    }
  }, [activeChatId, model, sessionId]);

  const renameChat = useCallback(async (chatId) => {
    const current = chats.find((chat) => chat.id === chatId);
    if (!current) return;
    const title = window.prompt('Nama baru chat:', current.title || 'Chat Baru');
    if (!title) return;
    const renamed = { ...current, title: safeTitle(title), updatedAt: new Date().toISOString() };
    await persistChat(renamed);
  }, [chats, persistChat]);

  const clearAll = useCallback(async () => {
    if (!window.confirm('Hapus semua riwayat local chat?')) return;
    await clearAllChats(sessionId);
    const fresh = makeChat(model);
    setChats([fresh]);
    setActiveChatId(fresh.id);
    setLastChatId(fresh.id);
  }, [model, sessionId]);

  const changeModel = useCallback((nextModel) => {
    setModel(nextModel);
    showNotice(`Mode ${getModelById(nextModel).label} aktif.`);
  }, [showNotice]);

  const appendAssistant = useCallback(async (content, extra = {}) => {
    await updateActiveChat((chat) => ({
      ...chat,
      model,
      updatedAt: new Date().toISOString(),
      messages: [...chat.messages, makeMessage('assistant', content, extra)]
    }));
  }, [model, updateActiveChat]);

  const handleCommand = useCallback(async (raw) => {
    const command = raw.trim().toLowerCase();
    if (!command.startsWith('/')) return false;

    if (command === '/help') {
      await appendAssistant(helpText());
      return true;
    }
    if (command === '/new') {
      newChat();
      return true;
    }
    if (command === '/clear') {
      if (!activeChat) return true;
      if (window.confirm('Bersihkan pesan di chat aktif?')) {
        await persistChat({ ...activeChat, messages: [], updatedAt: new Date().toISOString(), title: 'Chat Baru' });
      }
      return true;
    }
    if (command.startsWith('/theme')) {
      const nextTheme = command.split(/\s+/)[1];
      if (APP_CONFIG.themes[nextTheme]) {
        setThemeId(nextTheme);
        await appendAssistant(`Tema diganti ke ${APP_CONFIG.themes[nextTheme].label}.`);
      } else {
        await appendAssistant('Tema tersedia: red, blue, purple, dark. Contoh: `/theme red`');
      }
      return true;
    }
    if (command === '/coding') {
      changeModel('coding');
      await appendAssistant('Mode Coding aktif. Kirim error atau potongan kode yang mau dibantu.');
      return true;
    }
    if (command === '/thinking') {
      changeModel('thinking');
      await appendAssistant('Mode Thinking aktif. Cocok buat analisis yang lebih pelan dan rapi.');
      return true;
    }
    if (command === '/pro') {
      changeModel('pro');
      await appendAssistant('Mode Pro aktif. DRAK-GPT akan coba provider terbaik dengan fallback.');
      return true;
    }
    if (command === '/image') {
      await appendAssistant('Ketik prompt gambar setelah command, Bos. Contoh: `/image naga merah cyber di langit malam`. Kalau cuma upload foto, itu masuk mode baca gambar, bukan generate gambar.');
      return true;
    }
    if (command.startsWith('/image ')) {
      return false;
    }

    await appendAssistant('Command belum dikenal. Ketik `/help` buat daftar command.');
    return true;
  }, [activeChat, appendAssistant, changeModel, newChat, persistChat]);

  const sendToApi = useCallback(async ({ text, chatId, currentModel, currentAttachments, history }) => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        model: currentModel,
        chatId,
        history,
        attachments: currentAttachments.map((attachment) => ({
          id: attachment.id,
          type: attachment.kind || attachment.type,
          kind: attachment.kind,
          name: attachment.name,
          mime: attachment.mime || attachment.type,
          size: attachment.size,
          width: attachment.width,
          height: attachment.height,
          compressed: attachment.compressed,
          thumbnailUrl: attachment.thumbnailUrl,
          dataUrl: attachment.dataUrl || attachment.previewUrl || (attachment.kind === 'image' ? attachment.preview : undefined)
        }))
      })
    });

    const data = await response.json().catch(() => null);
    if (!data) throw new Error('DRAK-GPT lagi susah konek ke provider. Coba ulangi sebentar lagi.');
    return data;
  }, []);

  const sendMessage = useCallback(async (rawText) => {
    const currentAttachments = attachments;
    const fallbackAttachmentText = hasImageAttachment(currentAttachments) ? 'Tolong analisis gambar ini.' : 'Tolong cek lampiran ini.';
    const text = clampText(rawText || (currentAttachments.length ? fallbackAttachmentText : ''), APP_CONFIG.limits.maxMessageLength);

    if (!text && !currentAttachments.length) return;
    if (!canSendNow(APP_CONFIG.limits.clientCooldownMs)) {
      showNotice('Tunggu sebentar sebelum kirim lagi.');
      return;
    }

    if (await handleCommand(text)) return;
    if (!online) {
      showNotice('Internet offline. Riwayat masih bisa dibuka, kirim chat ditahan dulu.');
      return;
    }

    const now = new Date().toISOString();
    const chatBase = activeChat || makeChat(model);
    const userMessage = makeMessage('user', text || fallbackAttachmentText, { attachments: currentAttachments });
    const loadingMessage = makeMessage('assistant', '', { loading: true });
    const firstUserText = chatBase.messages.find((message) => message.role === 'user')?.content || text;
    const nextTitle = chatBase.messages.length ? chatBase.title : safeTitle(firstUserText || currentAttachments[0]?.name || 'Chat Baru');
    const chatWithUser = {
      ...chatBase,
      title: nextTitle,
      model,
      updatedAt: now,
      messages: [...chatBase.messages, userMessage, loadingMessage]
    };

    setAttachments([]);
    await persistChat(chatWithUser);

    const promptContext = attachmentsToPromptContext(currentAttachments);
    const finalPrompt = `${text}${promptContext}`.slice(0, APP_CONFIG.limits.maxMessageLength + 12000);

    try {
      const data = await sendToApi({
        text: finalPrompt,
        chatId: chatWithUser.id,
        currentModel: model,
        currentAttachments,
        history: trimHistoryForPrompt(chatBase.messages)
      });

      const reply = data.reply || `Provider AI lagi ngambek, Bos. Coba ulang bentar lagi.\n\nKalau error terus, chat ${APP_CONFIG.owner.name}: ${APP_CONFIG.owner.whatsappUrl}`;
      await persistChat({
        ...chatWithUser,
        updatedAt: new Date().toISOString(),
        messages: chatWithUser.messages.map((message) => message.id === loadingMessage.id ? makeMessage('assistant', reply, { error: !data.success, provider: data.provider }) : message)
      });
    } catch {
      await persistChat({
        ...chatWithUser,
        updatedAt: new Date().toISOString(),
        messages: chatWithUser.messages.map((message) => message.id === loadingMessage.id ? makeMessage('assistant', `DRAK-GPT lagi susah konek ke provider. Coba ulangi sebentar lagi.\n\nKalau error terus, chat ${APP_CONFIG.owner.name}: ${APP_CONFIG.owner.whatsappUrl}`, { error: true }) : message)
      });
    }
  }, [activeChat, attachments, handleCommand, model, online, persistChat, sendToApi, showNotice]);

  const retryMessage = useCallback(async () => {
    if (!activeChat) return;
    const messages = activeChat.messages;
    const lastUser = [...messages].reverse().find((message) => message.role === 'user');
    if (!lastUser) return;
    await sendMessage(lastUser.content);
  }, [activeChat, sendMessage]);

  const logoutAccessGate = useCallback(() => {
    window.localStorage.removeItem(APP_CONFIG.accessGate.storageKey);
    setSidebarOpen(false);
    setHasAccess(false);
  }, []);

  if (loading) return <LoadingScreen onDone={() => setLoading(false)} />;
  if (!hasAccess) return <LoginGate onUnlock={() => setHasAccess(true)} />;

  return (
    <ChatLayout
      chat={activeChat}
      chats={chats}
      model={model}
      onModelChange={changeModel}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      onNewChat={newChat}
      onSelectChat={selectChat}
      onDeleteChat={removeChat}
      onRenameChat={renameChat}
      onClearAll={clearAll}
      onLogout={logoutAccessGate}
      themeId={themeId}
      onThemeChange={setThemeId}
      online={online}
      storageMode={storageMode}
      attachments={attachments}
      setAttachments={setAttachments}
      onSend={sendMessage}
      onRetry={retryMessage}
      notice={notice}
      onNotice={showNotice}
    />
  );
}
