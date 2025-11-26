import { localDB } from '../data/localData';
import type { DIDDocument } from '../data/localData';

export async function resolveDID(did: string): Promise<DIDDocument | null> {
  return localDB.getDIDDocumentByDID(did);
}

export function parseDID(did: string): {
  method: string;
  domain: string;
  path: string;
} {
  const parts = did.split(':');
  return {
    method: parts[1] || '',
    domain: parts[2] || '',
    path: parts.slice(3).join(':') || '',
  };
}
