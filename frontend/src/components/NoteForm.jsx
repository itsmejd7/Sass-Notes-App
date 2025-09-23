import { useEffect, useState } from 'react';

export default function NoteForm({ selectedNote, onSave, onCancel }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    setTitle(selectedNote?.title || '');
    setContent(selectedNote?.content || '');
  }, [selectedNote]);

  const handleSubmit = async e => {
    e.preventDefault();
    const payload = selectedNote?.id ? { ...selectedNote, title, content } : { title, content };
    await onSave(payload);
    setTitle('');
    setContent('');
  };

  return (
    <form onSubmit={handleSubmit}>
      <input placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />
      <textarea placeholder="Content" value={content} onChange={e=>setContent(e.target.value)} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit">{selectedNote ? 'Save' : 'Add Note'}</button>
        {selectedNote && <button type="button" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
