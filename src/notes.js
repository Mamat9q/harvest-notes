// Note storage: Cloud Firestore when Firebase is configured, localStorage
// otherwise (demo mode). Same interface either way.
//
// Firestore note: { title, body, crop, ownerUid, createdAt }.
// The list query filters by ownerUid only and sorts client-side, so no
// composite index is needed in the Firebase console.
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";

const LOCAL_KEY = "harvest-notes-v1";

function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveLocal(notes) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(notes));
}

export function createNoteStore(env) {
  const useCloud = env.configured && env.db && env.uid;

  if (!useCloud) {
    return {
      backend: "local",
      async list() {
        return loadLocal().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      },
      async add({ title, body, crop }) {
        const notes = loadLocal();
        const note = {
          id: "local-" + Date.now(),
          title,
          body,
          crop,
          createdAt: Date.now(),
        };
        notes.push(note);
        saveLocal(notes);
        return note;
      },
      async remove(id) {
        saveLocal(loadLocal().filter((n) => n.id !== id));
      },
    };
  }

  const col = collection(env.db, "notes");
  return {
    backend: "firestore",
    async list() {
      const q = query(col, where("ownerUid", "==", env.uid));
      const snap = await getDocs(q);
      return snap.docs
        .map((d) => ({
          id: d.id,
          ...d.data(),
          createdAt: d.data().createdAt?.toMillis?.() || Date.now(),
        }))
        .sort((a, b) => b.createdAt - a.createdAt);
    },
    async add({ title, body, crop }) {
      const ref = await addDoc(col, {
        title,
        body,
        crop,
        ownerUid: env.uid,
        createdAt: serverTimestamp(),
      });
      return { id: ref.id, title, body, crop, createdAt: Date.now() };
    },
    async remove(id) {
      await deleteDoc(doc(env.db, "notes", id));
    },
  };
}
