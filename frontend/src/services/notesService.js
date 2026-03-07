const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

class NotesService {
  static async listMyNotes() {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/api/notes/mine`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    if (!res.ok) throw new Error(`Failed to fetch my notes (${res.status})`);
    return res.json();
  }

  static async listByCompany(companyId) {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/api/notes/company/${companyId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    if (!res.ok) throw new Error(`Failed to fetch notes (${res.status})`);
    return res.json();
  }

  static async create(note) {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/api/notes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(note)
    });
    if (!res.ok) throw new Error(`Failed to create note (${res.status})`);
    return res.json();
  }

  static async update(noteId, note) {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/api/notes/${noteId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(note)
    });
    if (!res.ok) throw new Error(`Failed to update note (${res.status})`);
    return res.json();
  }

  static async delete(noteId) {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/api/notes/${noteId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    if (!res.ok) throw new Error(`Failed to delete note (${res.status})`);
    return res.json();
  }
}

export default NotesService;


