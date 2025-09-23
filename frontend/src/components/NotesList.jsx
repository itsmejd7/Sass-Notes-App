export default function NotesList({ notes, onSelect, onDelete }) {
  if (!notes?.length) {
    return <p>No notes yet. Create your first note!</p>
  }

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, textAlign: 'left' }}>
      {notes.map((note) => (
        <li key={note.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #333' }}>
          <button onClick={() => onSelect(note)} style={{ background: 'transparent', border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
            <div style={{ fontWeight: 600 }}>{note.title || 'Untitled'}</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>{note.updatedAt ? new Date(note.updatedAt).toLocaleString() : ''}</div>
          </button>
          {onDelete && (
            <button onClick={() => onDelete(note.id)} style={{ marginLeft: 12 }}>Delete</button>
          )}
        </li>
      ))}
    </ul>
  )
}


