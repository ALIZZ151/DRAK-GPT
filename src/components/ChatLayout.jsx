import ChatHeader from './ChatHeader.jsx';
import ChatSidebar from './ChatSidebar.jsx';
import ChatInput from './ChatInput.jsx';
import EmptyState from './EmptyState.jsx';
import MessageBubble from './MessageBubble.jsx';

export default function ChatLayout({
  chat,
  chats,
  model,
  onModelChange,
  sidebarOpen,
  setSidebarOpen,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  onRenameChat,
  onClearAll,
  themeId,
  onThemeChange,
  online,
  storageMode,
  attachments,
  setAttachments,
  onSend,
  onRetry,
  notice,
  onNotice
}) {
  return (
    <div className="app-shell">
      <div className="visual-bg" aria-hidden="true">
        <video className="bg-video" src="/bg-video.mp4" autoPlay muted loop playsInline onError={(event) => event.currentTarget.classList.add('video-missing')} />
      </div>

      <ChatSidebar
        open={sidebarOpen}
        chats={chats}
        activeChatId={chat?.id}
        onClose={() => setSidebarOpen(false)}
        onNewChat={onNewChat}
        onSelectChat={onSelectChat}
        onDeleteChat={onDeleteChat}
        onRenameChat={onRenameChat}
        onClearAll={onClearAll}
        themeId={themeId}
        onThemeChange={onThemeChange}
        storageMode={storageMode}
      />

      <main className="chat-main">
        <ChatHeader
          model={model}
          onModelChange={onModelChange}
          onMenu={() => setSidebarOpen(true)}
          online={online}
          storageMode={storageMode}
        />

        {notice && <div className="notice-bar" role="status">{notice}</div>}

        <section className="messages-panel" aria-live="polite">
          {chat?.messages?.length ? (
            chat.messages.map((message) => (
              <MessageBubble key={message.id} message={message} onRetry={() => onRetry(message)} />
            ))
          ) : (
            <EmptyState onPrompt={onSend} />
          )}
        </section>

        <ChatInput
          disabled={!online}
          attachments={attachments}
          setAttachments={setAttachments}
          onSend={onSend}
          onNotice={onNotice}
        />
      </main>
    </div>
  );
}
