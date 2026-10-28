import type { SupabaseClient } from "@supabase/supabase-js";

type Identity = { privateKey: CryptoKey; publicJwk: JsonWebKey };
type KeyRow = { public_key_jwk: JsonWebKey };

const DB_NAME = "aashrayacare-secure-messages";
const STORE_NAME = "identities";
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const publishedIdentities = new Set<string>();

function openKeyStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser does not support secure local key storage."));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open local key storage."));
  });
}

async function readIdentity(userId: string): Promise<Identity | null> {
  const db = await openKeyStore();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(userId);
      req.onsuccess = () => resolve((req.result as Identity | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error("Unable to read the local encryption key."));
    });
  } finally {
    db.close();
  }
}

async function writeIdentity(userId: string, identity: Identity): Promise<void> {
  const db = await openKeyStore();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(identity, userId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Unable to save the local encryption key."));
      tx.onabort = () => reject(tx.error ?? new Error("Saving the local encryption key was aborted."));
    });
  } finally {
    db.close();
  }
}

export async function ensureMessageIdentity(
  client: SupabaseClient,
  userId: string,
): Promise<void> {
  if (!globalThis.crypto?.subtle) throw new Error("Web Crypto is unavailable. Use a current browser over HTTPS.");
  let identity = await readIdentity(userId);
  if (!identity) {
    const pair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey"],
    ) as CryptoKeyPair;
    const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
    const privatePkcs8 = await crypto.subtle.exportKey("pkcs8", pair.privateKey);
    const nonExtractablePrivateKey = await crypto.subtle.importKey(
      "pkcs8",
      privatePkcs8,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveKey"],
    );
    identity = { privateKey: nonExtractablePrivateKey, publicJwk };
    await writeIdentity(userId, identity);
  }
  if (!publishedIdentities.has(userId)) {
    const { error } = await client.from("user_message_keys").upsert({
      user_id: userId,
      public_key_jwk: identity.publicJwk,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) throw new Error("Unable to publish your public message key: " + error.message);
    publishedIdentities.add(userId);
  }
}

async function sharedKey(
  client: SupabaseClient,
  currentUserId: string,
  otherUserId: string,
): Promise<CryptoKey> {
  const ownIdentity = await readIdentity(currentUserId);
  if (!ownIdentity) {
    await ensureMessageIdentity(client, currentUserId);
  }
  const identity = await readIdentity(currentUserId);
  if (!identity) throw new Error("This device has no local encryption key. Sign in again and retry.");
  const { data, error } = await client
    .from("user_message_keys")
    .select("public_key_jwk")
    .eq("user_id", otherUserId)
    .maybeSingle();
  if (error) throw new Error("Unable to load the other participant's public key: " + error.message);
  const keyRow = data as KeyRow | null;
  if (!keyRow?.public_key_jwk) {
    throw new Error("The other participant has not initialized secure messaging yet. Ask them to sign in and open Messages.");
  }
  const remotePublicKey = await crypto.subtle.importKey(
    "jwk",
    keyRow.public_key_jwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: remotePublicKey },
    identity.privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}
function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

type MessageEnvelope = { ciphertext: string; iv: string };
type DualEnvelopePayload = { version: 2; envelopes: Record<string, MessageEnvelope> };

async function encryptForKey(key: CryptoKey, plaintext: string): Promise<MessageEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext),
  );
  return { ciphertext: toBase64(new Uint8Array(encrypted)), iv: toBase64(iv) };
}

export async function encryptMessage(
  client: SupabaseClient,
  senderUserId: string,
  recipientUserId: string,
  plaintext: string,
): Promise<{ ciphertext: string; iv: string }> {
  await ensureMessageIdentity(client, senderUserId);

  // Encrypt one envelope for the sender's own device/account and one for the peer.
  // The same plaintext is never stored in the database.
  const [senderKey, recipientKey] = await Promise.all([
    sharedKey(client, senderUserId, senderUserId),
    sharedKey(client, senderUserId, recipientUserId),
  ]);
  const [senderEnvelope, recipientEnvelope] = await Promise.all([
    encryptForKey(senderKey, plaintext),
    encryptForKey(recipientKey, plaintext),
  ]);

  const envelopes: Record<string, MessageEnvelope> = {
    [senderUserId]: senderEnvelope,
    [recipientUserId]: recipientEnvelope,
  };
  const payload: DualEnvelopePayload = { version: 2, envelopes };
  // Existing schema requires both columns. The actual per-user IVs live inside
  // the versioned envelope; "v2" marks this format without exposing plaintext.
  return { ciphertext: JSON.stringify(payload), iv: "v2" };
}

export async function decryptMessage(
  client: SupabaseClient,
  recipientUserId: string,
  senderUserId: string,
  ciphertext: string,
  iv: string,
): Promise<string> {
  await ensureMessageIdentity(client, recipientUserId);

  // New messages contain independently encrypted copies for each participant.
  // For the sender's copy use the sender's own key; for a received copy use
  // the sender/recipient ECDH shared key. Older single-envelope records remain
  // supported where the current device has the appropriate key.
  let payload: unknown;
  try {
    payload = JSON.parse(ciphertext);
  } catch {
    payload = null;
  }
  if (
    payload &&
    typeof payload === "object" &&
    "version" in payload &&
    (payload as { version?: unknown }).version === 2 &&
    "envelopes" in payload
  ) {
    const envelopes = (payload as DualEnvelopePayload).envelopes;
    const envelope = envelopes?.[recipientUserId];
    if (!envelope?.ciphertext || !envelope?.iv) {
      throw new Error("This message has no encrypted copy for the signed-in participant.");
    }
    const peerUserId = recipientUserId === senderUserId ? recipientUserId : senderUserId;
    const key = await sharedKey(client, recipientUserId, peerUserId);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(envelope.iv) },
      key,
      fromBase64(envelope.ciphertext),
    );
    return decoder.decode(plaintext);
  }

  // Backward compatibility for the original single-recipient envelope format.
  const key = await sharedKey(client, recipientUserId, senderUserId);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(iv) },
    key,
    fromBase64(ciphertext),
  );
  return decoder.decode(plaintext);
}
