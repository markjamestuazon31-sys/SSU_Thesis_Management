import { APP_CONFIG } from '../config/app.config.js';
import {
  createKey,
  getKeyRange,
  getValue,
  removeValue,
  setValue,
  updateValue,
} from './db.service.js';

// Eight 128 KB binary chunks become about 1.34 MB of base64 data. This stays
// comfortably below the Firebase Web SDK's single-write limit while avoiding
// hundreds of individual upload requests for a large manuscript.
const UPLOAD_BATCH_CHUNKS = 8;

// Downloading fileChunks/{fileId} in one Firebase snapshot forces the browser
// to receive and JSON-parse the complete base64 manuscript before it can report
// useful progress. Read bounded key ranges instead so large downloads remain
// responsive for students, Research Instructors, Program Chairs, and administrators.
const DOWNLOAD_BATCH_CHUNKS = 16;
const DOWNLOAD_CONCURRENCY = 2;
const DOWNLOAD_RETRIES = 2;

function toBase64(bytes) {
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + step, bytes.length)));
  }
  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function maxFileSizeMb() {
  return Math.round(APP_CONFIG.maxFileSizeBytes / (1024 * 1024));
}

function chunkKey(index) {
  return String(index).padStart(5, '0');
}

function abortError() {
  const error = new Error('File download was cancelled.');
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw abortError();
}

function delay(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    throwIfAborted(signal);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, milliseconds);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function notify(onProgress, payload) {
  try {
    onProgress(payload);
  } catch (error) {
    // A UI progress callback must never break a valid manuscript transfer.
    console.warn('Manuscript progress callback failed.', error);
  }
}

function friendlyReadError(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '');
  if (code.includes('permission-denied') || /permission denied/i.test(message)) {
    return new Error('Your account cannot read this manuscript file. Confirm that you are the student, assigned Research Instructor, Program Chair, or administrator for this thesis and deploy the current Realtime Database rules.');
  }
  if (code.includes('network') || /network|offline|failed to fetch/i.test(message)) {
    return new Error('The file could not be downloaded because the network connection was interrupted. Check the internet connection and retry.');
  }
  return error instanceof Error ? error : new Error('The manuscript file could not be downloaded.');
}

async function retry(task, { signal, attempts = DOWNLOAD_RETRIES + 1 } = {}) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    throwIfAborted(signal);
    try {
      return await task();
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      lastError = error;
      if (attempt >= attempts - 1) break;
      await delay(350 * (attempt + 1), signal);
    }
  }
  throw friendlyReadError(lastError);
}

async function readChunkBatch(fileId, startIndex, endIndex, signal) {
  const startKey = chunkKey(startIndex);
  const endKey = chunkKey(endIndex);
  let rangeData = null;
  let rangeError = null;

  try {
    rangeData = await getKeyRange(`fileChunks/${fileId}`, startKey, endKey);
  } catch (error) {
    // Very old Firebase configurations may reject a key-range query. Keep a
    // direct-child fallback so existing projects still open their files.
    rangeError = error;
  }

  const entries = [];
  const missing = [];
  for (let index = startIndex; index <= endIndex; index += 1) {
    const key = chunkKey(index);
    const encoded = rangeData?.[key];
    if (typeof encoded === 'string' && encoded.length) entries.push([index, encoded]);
    else missing.push(index);
  }

  if (missing.length) {
    try {
      const recovered = await Promise.all(missing.map(async (index) => {
        throwIfAborted(signal);
        let value = await getValue(`fileChunks/${fileId}/${chunkKey(index)}`);
        // Compatibility with early prototypes that used unpadded numeric keys.
        if ((typeof value !== 'string' || !value.length) && chunkKey(index) !== String(index)) {
          value = await getValue(`fileChunks/${fileId}/${index}`);
        }
        return [index, value];
      }));
      for (const [index, value] of recovered) {
        if (typeof value !== 'string' || !value.length) {
          throw new Error(`Manuscript chunk ${index + 1} is missing.`);
        }
        entries.push([index, value]);
      }
    } catch (error) {
      if (rangeError && !rangeData) throw friendlyReadError(rangeError);
      throw error;
    }
  }

  entries.sort((left, right) => left[0] - right[0]);
  return entries.map(([index, encoded]) => [index, fromBase64(encoded)]);
}

async function checkSignature(file) {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (ext === 'pdf' && String.fromCharCode(...head.slice(0, 4)) !== '%PDF') {
    throw new Error('The selected file is not a valid PDF.');
  }
  if (ext === 'docx' && !(head[0] === 0x50 && head[1] === 0x4b)) {
    throw new Error('The selected file is not a valid DOCX.');
  }
}

export async function validateThesisFile(file) {
  if (!(file instanceof File)) throw new Error('Select a manuscript file.');
  if (file.size <= 0) throw new Error('The selected file is empty.');
  if (file.size > APP_CONFIG.maxFileSizeBytes) {
    throw new Error(`The manuscript must not exceed ${maxFileSizeMb()} MB.`);
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!APP_CONFIG.acceptedExtensions.includes(ext)) {
    throw new Error('Only PDF and DOCX files are accepted.');
  }

  await checkSignature(file);
  return true;
}

export async function uploadFileToRealtimeDatabase(
  file,
  {
    ownerUid,
    thesisId,
    onProgress = () => {},
    purpose = 'student_manuscript',
    sourceFileId = '',
    sourceVersion = null,
  },
) {
  await validateThesisFile(file);

  const fileId = createKey('files');
  const chunkCount = Math.ceil(file.size / APP_CONFIG.fileChunkBytes);
  const metadata = {
    ownerUid,
    thesisId,
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    chunkCount,
    chunkBytes: APP_CONFIG.fileChunkBytes,
    encoding: 'base64-chunks-v1',
    purpose: String(purpose || 'student_manuscript'),
    ...(sourceFileId ? { sourceFileId: String(sourceFileId) } : {}),
    ...(Number.isInteger(Number(sourceVersion)) && Number(sourceVersion) > 0 ? { sourceVersion: Number(sourceVersion) } : {}),
    status: 'uploading',
    published: false,
    createdAt: Date.now(),
  };

  await setValue(`files/${fileId}`, metadata);

  try {
    for (let batchStart = 0; batchStart < chunkCount; batchStart += UPLOAD_BATCH_CHUNKS) {
      const batchEnd = Math.min(batchStart + UPLOAD_BATCH_CHUNKS, chunkCount);
      const chunkUpdates = {};

      for (let index = batchStart; index < batchEnd; index += 1) {
        const start = index * APP_CONFIG.fileChunkBytes;
        const end = Math.min(start + APP_CONFIG.fileChunkBytes, file.size);
        const bytes = new Uint8Array(await file.slice(start, end).arrayBuffer());
        chunkUpdates[chunkKey(index)] = toBase64(bytes);
      }

      await updateValue(`fileChunks/${fileId}`, chunkUpdates);
      onProgress(Math.round((batchEnd / chunkCount) * 100));
    }

    await updateValue(`files/${fileId}`, {
      status: 'ready',
      completedAt: Date.now(),
    });
    return { fileId, ...metadata, status: 'ready' };
  } catch (error) {
    // Failed partial files can consume significant RTDB quota, so remove their
    // chunks before keeping the failed metadata record for troubleshooting.
    await removeValue(`fileChunks/${fileId}`).catch(() => {});
    await updateValue(`files/${fileId}`, {
      status: 'failed',
      failedAt: Date.now(),
    }).catch(() => {});
    throw error;
  }
}

export async function getFileMetadata(fileId) {
  if (!String(fileId || '').trim()) return null;
  return getValue(`files/${fileId}`);
}

/**
 * Rebuilds the exact uploaded bytes from Realtime Database without modifying,
 * converting, cropping, or replacing the original manuscript. The optional
 * progress callback receives transfer stages for download buttons and progress UI.
 */
export async function reconstructFile(
  fileId,
  { onProgress = () => {}, signal = null } = {},
) {
  const normalizedFileId = String(fileId || '').trim();
  if (!normalizedFileId) throw new Error('No manuscript file is linked to this thesis record.');
  throwIfAborted(signal);

  notify(onProgress, {
    phase: 'metadata',
    percent: 1,
    loadedBytes: 0,
    totalBytes: 0,
    fileId: normalizedFileId,
  });

  const rawMetadata = await retry(
    () => getFileMetadata(normalizedFileId),
    { signal },
  );
  if (!rawMetadata) throw new Error('File metadata was not found.');
  const inferredName = rawMetadata.name || rawMetadata.fileName || 'student-manuscript';
  const inferredType = rawMetadata.type
    || rawMetadata.mimeType
    || (String(inferredName).toLowerCase().endsWith('.pdf')
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  const metadata = {
    ...rawMetadata,
    name: inferredName,
    type: inferredType,
    size: Number(rawMetadata.size ?? rawMetadata.fileSize),
    chunkCount: Number(rawMetadata.chunkCount ?? rawMetadata.totalChunks),
  };
  const uploadStatus = String(metadata.status || (metadata.chunkCount > 0 && metadata.size > 0 ? 'ready' : ''));
  if (uploadStatus !== 'ready') {
    throw new Error(uploadStatus === 'failed'
      ? 'This manuscript file upload failed. Upload the file again.'
      : 'This manuscript file is still uploading. Wait for the upload to finish, then retry.');
  }

  const chunkCount = Number(metadata.chunkCount);
  const totalBytes = Number(metadata.size);
  if (!Number.isInteger(chunkCount) || chunkCount <= 0) {
    throw new Error('The manuscript metadata has an invalid chunk count.');
  }
  if (!Number.isFinite(totalBytes) || totalBytes <= 0) {
    throw new Error('The manuscript metadata has an invalid file size.');
  }

  notify(onProgress, {
    phase: 'download',
    percent: 4,
    loadedBytes: 0,
    totalBytes,
    metadata,
    fileId: normalizedFileId,
  });

  const pieces = new Array(chunkCount);
  const batches = [];
  for (let startIndex = 0; startIndex < chunkCount; startIndex += DOWNLOAD_BATCH_CHUNKS) {
    batches.push({
      startIndex,
      endIndex: Math.min(chunkCount - 1, startIndex + DOWNLOAD_BATCH_CHUNKS - 1),
    });
  }

  let nextBatchIndex = 0;
  let completedChunks = 0;
  let loadedBytes = 0;

  const worker = async () => {
    while (true) {
      throwIfAborted(signal);
      const batchIndex = nextBatchIndex;
      nextBatchIndex += 1;
      if (batchIndex >= batches.length) return;

      const batch = batches[batchIndex];
      const decoded = await retry(
        () => readChunkBatch(
          normalizedFileId,
          batch.startIndex,
          batch.endIndex,
          signal,
        ),
        { signal },
      );

      for (const [index, bytes] of decoded) {
        pieces[index] = bytes;
        loadedBytes += bytes.byteLength;
      }
      completedChunks += decoded.length;

      const transferRatio = Math.min(1, completedChunks / chunkCount);
      notify(onProgress, {
        phase: 'download',
        percent: Math.min(94, 4 + Math.round(transferRatio * 90)),
        loadedBytes: Math.min(loadedBytes, totalBytes),
        totalBytes,
        completedChunks,
        chunkCount,
        metadata,
        fileId: normalizedFileId,
      });
    }
  };

  const workerCount = Math.min(DOWNLOAD_CONCURRENCY, batches.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  throwIfAborted(signal);

  const missingIndex = pieces.findIndex((piece) => !(piece instanceof Uint8Array));
  if (missingIndex !== -1) {
    throw new Error(`The manuscript file is incomplete. Chunk ${missingIndex + 1} could not be recovered.`);
  }

  notify(onProgress, {
    phase: 'assemble',
    percent: 97,
    loadedBytes: totalBytes,
    totalBytes,
    metadata,
    fileId: normalizedFileId,
  });

  const blob = new Blob(pieces, { type: metadata.type || 'application/octet-stream' });
  if (blob.size !== totalBytes) {
    throw new Error(`The reconstructed file size does not match the uploaded file (${blob.size} of ${totalBytes} bytes). Upload the file again.`);
  }

  notify(onProgress, {
    phase: 'ready',
    percent: 100,
    loadedBytes: totalBytes,
    totalBytes,
    metadata,
    fileId: normalizedFileId,
  });

  return { metadata, blob };
}

export async function deleteRealtimeFile(fileId) {
  const normalizedFileId = String(fileId || '').trim();
  if (!normalizedFileId) return;
  // Delete chunks first. Their security rule relies on the file metadata to
  // verify ownership, so removing metadata concurrently can make cleanup fail.
  await removeValue(`fileChunks/${normalizedFileId}`).catch(() => {});
  await removeValue(`files/${normalizedFileId}`);
}
