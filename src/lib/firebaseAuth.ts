import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export const SHEETS_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
];

const provider = new GoogleAuthProvider();
for (const scope of SHEETS_SCOPES) {
  provider.addScope(scope);
}

let isSigningIn = false;
// Access token strictly cached in memory only (never localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let cachedGoogleUser: User | null = null;

export function formatGoogleAuthError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : '';
  const message = err instanceof Error ? err.message : String(err || '');

  if (code === 'auth/unauthorized-domain' || message.includes('unauthorized-domain')) {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'โดเมนนี้';
    return `โดเมน "${host}" ยังไม่ได้รับอนุญาตใน Firebase Auth (auth/unauthorized-domain) — กรุณาเพิ่ม "${host}" ใน Firebase Console → Authentication → Settings → Authorized domains หรือเชื่อมต่อผ่านวิธี Google Apps Script ด้านล่างแทนได้ทันที`;
  }
  if (code === 'auth/popup-blocked') {
    return 'เบราว์เซอร์บล็อกหน้าต่าง Pop-up กรุณากดอนุญาต Pop-up สำหรับเว็บไซต์นี้แล้วลองใหม่อีกครั้ง';
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'ปิดหน้าต่างลงชื่อเข้าใช้ Google ก่อนเสร็จสิ้น กรุณากดเชื่อมต่อใหม่อีกครั้ง';
  }
  if (code === 'auth/network-request-failed') {
    return 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ Google ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่';
  }
  return message || 'ไม่สามารถลงชื่อเข้าใช้ Google ได้ กรุณาลองใหม่อีกครั้ง';
}

export function initGoogleSheetsAuth(
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user && cachedAccessToken) {
      cachedGoogleUser = user;
      onAuthSuccess?.(user, cachedAccessToken);
    } else if (!isSigningIn) {
      cachedAccessToken = null;
      cachedGoogleUser = null;
      onAuthFailure?.();
    }
  });
}

export async function signInWithGoogleSheets(): Promise<{
  user: User;
  accessToken: string;
}> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('ไม่สามารถรับสิทธิ์เข้าถึง Google Sheets ได้ กรุณาลองใหม่อีกครั้ง');
    }
    cachedAccessToken = credential.accessToken;
    cachedGoogleUser = result.user;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (err) {
    throw new Error(formatGoogleAuthError(err));
  } finally {
    isSigningIn = false;
  }
}

export function getGoogleAccessToken(): string | null {
  return cachedAccessToken;
}

export function getGoogleUser(): User | null {
  return cachedGoogleUser;
}

export async function signOutGoogleSheets(): Promise<void> {
  cachedAccessToken = null;
  cachedGoogleUser = null;
  await auth.signOut();
}
