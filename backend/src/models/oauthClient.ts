import { db } from '../db/mongo';

export interface OAuthClient {
  clientId: string;
  clientSecretHash: string;
  clientName: string;
  redirectUris: string[];
  grantTypes: string[];
  createdAt: Date;
}

export const OAUTH_CLIENTS_COLLECTION = 'oauth_clients';

export async function createOAuthClientIndexes() {
  const collection = db.collection(OAUTH_CLIENTS_COLLECTION)
  try {
    const indexes = await collection.indexes()

    const clientIdExists = indexes.some(idx => idx.name === 'clientId_1')
    if (!clientIdExists) {
      await collection.createIndex({ clientId: 1 }, { unique: true, name: 'clientId_1' })
    }
  } catch (err: any) {
    if (err.codeName !== 'NamespaceNotFound') {
      console.warn('[OAuthClient] createOAuthClientIndexes:', err.message)
    }
  }
}

export async function saveOAuthClient(client: OAuthClient): Promise<OAuthClient> {
  const collection = db.collection<OAuthClient>(OAUTH_CLIENTS_COLLECTION)
  await collection.insertOne(client)
  return client
}

export async function getOAuthClientByClientId(clientId: string): Promise<OAuthClient | null> {
  const collection = db.collection<OAuthClient>(OAUTH_CLIENTS_COLLECTION)
  return collection.findOne({ clientId })
}

export async function deleteOAuthClient(clientId: string): Promise<void> {
  const collection = db.collection<OAuthClient>(OAUTH_CLIENTS_COLLECTION)
  await collection.deleteOne({ clientId })
}
