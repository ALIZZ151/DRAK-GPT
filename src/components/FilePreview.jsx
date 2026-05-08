export default function FilePreview({ attachments = [], onRemove }) {
  if (!attachments.length) return null;

  return (
    <div className="file-preview-list" aria-label="Lampiran aktif">
      {attachments.map((item) => (
        <article className="file-preview" key={item.id}>
          {item.kind === 'image' ? (
            <img src={item.preview} alt={item.name} />
          ) : (
            <span className="file-icon">{item.kind === 'text' ? 'TXT' : 'PDF'}</span>
          )}
          <div>
            <strong>{item.name}</strong>
            <small>{item.sizeLabel}</small>
          </div>
          <button type="button" onClick={() => onRemove(item.id)} aria-label={`Hapus ${item.name}`}>
            ×
          </button>
        </article>
      ))}
    </div>
  );
}
