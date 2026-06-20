import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";
import { DBState } from "./types";

const firebaseConfig = {
  apiKey: "AIzaSyCVq-g9PrmyhO3Sfw_ezOTBbnSIwNXFK1A",
  authDomain: "encoded-plateau-6f4nj.firebaseapp.com",
  projectId: "encoded-plateau-6f4nj",
  storageBucket: "encoded-plateau-6f4nj.firebasestorage.app",
  messagingSenderId: "545099088849",
  appId: "1:545099088849:web:467184b0b69eadcc0d16f0"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, "ai-studio-8f328f13-3f0e-4ffe-9c1a-0ddc23ab37c2");

const REF_PATH = doc(db, "app", "datos");

export function pruneOldPhotos(state: DBState): DBState {
  const data = JSON.parse(JSON.stringify(state)) as DBState;

  // Prune older camera photos from stock exits to fit within Firestore's 1MB document limit
  if (data.salidasStock && Array.isArray(data.salidasStock)) {
    let photoCount = 0;
    for (let i = 0; i < data.salidasStock.length; i++) {
      if (data.salidasStock[i].fotoB64) {
        photoCount++;
        // Keep ONLY the single most recent photo in history (index 0 / first one found) to avoid hitting 1MB document limit
        if (photoCount > 1) {
          data.salidasStock[i].fotoB64 = null;
        }
      }
    }
  }

  // Also prune older scanned docs to keep ONLY the single most recent doc photo
  if (data.docs && Array.isArray(data.docs)) {
    let docPhotoCount = 0;
    for (let i = 0; i < data.docs.length; i++) {
      if (data.docs[i].b64) {
        docPhotoCount++;
        // Keep ONLY the single most recent scanned document photo in history
        if (docPhotoCount > 1) {
          data.docs[i].b64 = null;
        }
      }
    }
  }

  return data;
}

export function saveToFirebase(state: DBState): Promise<void> {
  // Prune state to stay under Firestore's 1MB limit
  const prunedData = pruneOldPhotos(state);
  return setDoc(REF_PATH, prunedData);
}

export function listenToFirebase(
  onUpdate: (state: DBState) => void,
  onNotFound: () => void,
  onError?: (err: any) => void
) {
  return onSnapshot(REF_PATH, (snap) => {
    if (snap.exists()) {
      onUpdate(snap.data() as DBState);
    } else {
      onNotFound();
    }
  }, (err) => {
    if (onError) onError(err);
  });
}

export async function getFromFirebase(): Promise<DBState | null> {
  try {
    const snap = await getDoc(REF_PATH);
    if (snap.exists()) {
      return snap.data() as DBState;
    }
  } catch (e) {
    console.warn("Could not fetch data from Firebase server, using offline offline cache: ", e);
  }
  return null;
}
