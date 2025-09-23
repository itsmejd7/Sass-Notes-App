import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import NoteForm from '../components/NoteForm.jsx';
import api from '../api/api';

export default function Notes() {
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [showUpgrade, setShowUpgrade] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadNotes() {
      setIsLoading(true);
      setErrorMessage('');
      try {
        const data = await api.get('/notes');
        if (isMounted) setNotes(data);
      } catch (error) {
        if (isMounted) setErrorMessage(error.message);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadNotes();
    return () => { isMounted = false; };
  }, []);

  async function handleSave(notePayload) {
    try {
      const saved = notePayload.id
        ? await api.put(`/notes/${notePayload.id}`, notePayload)
        : await api.post('/notes', notePayload);
      setNotes((prev) => {
        const exists = prev.some((n) => n.id === saved.id);
        return exists ? prev.map((n) => (n.id === saved.id ? saved : n)) : [saved, ...prev];
      });
      if (notePayload.id) {
        setSelectedNote(saved);
      } else {
        setSelectedNote(null);
      }
    } catch (error) {
      setErrorMessage(error.message);
      if (error.message && error.message.toLowerCase().includes('limit')) {
        setShowUpgrade(true);
      }
    }
  }

  async function handleDelete(noteId) {
    try {
      await api.delete(`/notes/${noteId}`);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      if (selectedNote?.id === noteId) setSelectedNote(null);
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleUpgrade() {
    setErrorMessage('');
    try {
      const slug = localStorage.getItem('tenantSlug');
      await api.post(`/tenants/${slug}/upgrade`);
      setShowUpgrade(false);
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  return (
    <div>
      <Navbar />
      <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 32, alignItems: 'start' }}>
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Notes</h2>
          {isLoading ? (
            <p>Loading...</p>
          ) : notes.length ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, textAlign: 'left', display: 'grid', gap: 12 }}>
              {notes.map((note) => (
                <li key={note.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: '1px solid #1f2937', borderRadius: 8, background: '#0f172a' }}>
                  <button onClick={() => setSelectedNote(note)} style={{ background: 'transparent', border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                    <div style={{ fontWeight: 600 }}>{note.title || 'Untitled'}</div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>{note.updatedAt ? new Date(note.updatedAt).toLocaleString() : ''}</div>
                  </button>
                  <button onClick={() => handleDelete(note.id)} style={{ marginLeft: 12 }}>Delete</button>
                </li>
              ))}
            </ul>
          ) : (
            <p>No notes yet. Create your first note!</p>
          )}
          {errorMessage && <div style={{ color: '#ff6b6b', marginTop: 8 }}>{errorMessage}</div>}
        </div>
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>{selectedNote ? 'Edit Note' : 'New Note'}</h2>
          <NoteForm selectedNote={selectedNote} onSave={handleSave} onCancel={() => setSelectedNote(null)} />
        {showUpgrade && (
          <div style={{ marginTop: 12 }}>
            <div style={{ color: '#ffb703', marginBottom: 8 }}>Free plan limit reached. Upgrade to Pro to create more notes.</div>
            <button onClick={handleUpgrade}>Upgrade to Pro</button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}


