import { useCallback, useEffect, useMemo, useState } from 'react';
import { APP_CONFIG, getModelById, getThemeById } from './database.js';
import LoadingScreen from './components/LoadingScreen.jsx';
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

export default function App() {
  const [loading, setLoading] = useState(true);
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
      await appendAssistant('Fitur gambar sedang disiapkan. Mode chat dan coding sudah aktif.');
      return true;
    }

    await appendAssistant('Command belum dikenal. Ketik `/help` buat daftar command.');
    return true;
  }, [activeChat, appendAssistant, changeModel, newChat, persistChat]);

  const sendToApi = useCallback(async ({ text, chatId, currentModel, currentAttachments }) => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, model: currentModel, chatId, attachments: currentAttachments.map(({ preview, content, ...safe }) => safe) })
    });

    const data = await response.json().catch(() => null);
    if (!data) throw new Error('DRAK-GPT lagi susah konek ke provider. Coba ulangi sebentar lagi.');
    return data;
  }, []);

  const sendMessage = useCallback(async (rawText) => {
    const text = clampText(rawText, APP_CONFIG.limits.maxMessageLength);
    const currentAttachments = attachments;

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
    const userMessage = makeMessage('user', text || '[Lampiran]', { attachments: currentAttachments });
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

    if (hasImageAttachment(currentAttachments) && !APP_CONFIG.features.vision) {
      const reply = 'Gambar sudah diterima, tapi provider aktif belum support vision. Coba ganti model kalau nanti endpoint vision sudah ditambah, atau jelaskan gambarnya manual.';
      await persistChat({
        ...chatWithUser,
        updatedAt: new Date().toISOString(),
        messages: chatWithUser.messages.map((message) => message.id === loadingMessage.id ? makeMessage('assistant', reply) : message)
      });
      return;
    }

    const promptContext = attachmentsToPromptContext(currentAttachments);
    const finalPrompt = `${text}${promptContext}`.slice(0, APP_CONFIG.limits.maxMessageLength + 12000);

    try {
      const data = await sendToApi({
        text: finalPrompt,
        chatId: chatWithUser.id,
        currentModel: model,
        currentAttachments
      });

      const reply = data.reply || (data.success ? 'DRAK-GPT sudah merespons, tapi isi jawaban kosong.' : 'DRAK-GPT lagi susah konek ke provider. Coba ulangi sebentar lagi.');
      await persistChat({
        ...chatWithUser,
        updatedAt: new Date().toISOString(),
        messages: chatWithUser.messages.map((message) => message.id === loadingMessage.id ? makeMessage('assistant', reply, { error: !data.success, provider: data.provider }) : message)
      });
    } catch {
      await persistChat({
        ...chatWithUser,
        updatedAt: new Date().toISOString(),
        messages: chatWithUser.messages.map((message) => message.id === loadingMessage.id ? makeMessage('assistant', 'DRAK-GPT lagi susah konek ke provider. Coba ulangi sebentar lagi.\n\nKalau error terus, hubungi owner.', { error: true }) : message)
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

  if (loading) return <LoadingScreen onDone={() => setLoading(false)} />;

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
