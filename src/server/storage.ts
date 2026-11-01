import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "@/server/env";

/** Object storage: local ./uploads in dev, Cloudflare R2 (S3 API) in prod. Keys are server-generated. */
type Store = {
  put(key: string, body: Uint8Array, type: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
};

const LOCAL_ROOT = path.resolve(process.cwd(), "uploads");

/** Resolve inside the uploads folder only; any key that escapes it is refused. */
function jail(key: string) {
  const file = path.resolve(LOCAL_ROOT, key);
  if (!file.startsWith(LOCAL_ROOT + path.sep)) throw new Error("storage key escapes the uploads folder");
  return file;
}

const local: Store = {
  async put(key, body) {
    const file = jail(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
  },
  async get(key) {
    try {
      return await readFile(jail(key));
    } catch {
      return null;
    }
  },
};

function r2(): Store {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET)
    throw new Error("STORAGE_DRIVER=r2 needs R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET");
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });
  return {
    async put(key, body, type) {
      await s3.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: body, ContentType: type }));
    },
    async get(key) {
      try {
        const res = await s3.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
        return res.Body ? await res.Body.transformToByteArray() : null;
      } catch {
        return null;
      }
    },
  };
}

export const storage: Store = env.STORAGE_DRIVER === "r2" ? r2() : local;
