import type { DecodedIdToken } from 'firebase-admin/auth';
import { getAdminAuth } from './_firebase-admin.js';
import { HttpError } from './_http.js';

type HeaderValue = string | string[] | undefined;
type HeaderMap = Record<string, HeaderValue>;
type HeadersLike = {
  get(name: string): string | null;
};
type RequestLike = {
  headers?: HeaderMap | HeadersLike;
};

const AUTH_REQUIRED_MESSAGE = 'Authentication required.';

function readHeader(headers: HeaderMap | HeadersLike | undefined, name: string) {
  if (!headers) return undefined;

  if (typeof (headers as HeadersLike).get === 'function') {
    return (headers as HeadersLike).get(name) ?? undefined;
  }

  const headerMap = headers as HeaderMap;
  const headerKey = Object.keys(headerMap).find(key => key.toLowerCase() === name.toLowerCase());
  return headerKey ? headerMap[headerKey] : undefined;
}

function normalizeHeaderValue(value: HeaderValue | null) {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

export function readBearerToken(input?: string | null | RequestLike) {
  let authorization: string | null | undefined;
  if (typeof input === 'string') {
    authorization = input;
  } else if (input == null) {
    authorization = null;
  } else {
    authorization = normalizeHeaderValue(readHeader(input.headers, 'authorization'));
  }

  if (!authorization) return null;

  const match = authorization.match(/^\s*bearer\s+(\S+)\s*$/i);
  return match?.[1] ?? null;
}

export async function requireTutor(req: RequestLike): Promise<DecodedIdToken> {
  const token = readBearerToken(req);

  if (!token) {
    throw new HttpError(401, AUTH_REQUIRED_MESSAGE);
  }

  try {
    return await getAdminAuth().verifyIdToken(token);
  } catch {
    throw new HttpError(401, AUTH_REQUIRED_MESSAGE);
  }
}
