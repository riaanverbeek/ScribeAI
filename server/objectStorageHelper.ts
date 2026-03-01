import { ObjectStorageService, objectStorageClient } from "./replit_integrations/object_storage";
import { randomUUID } from "crypto";

const objectStorageService = new ObjectStorageService();

function parseObjectPath(fullPath: string): { bucketName: string; objectName: string } {
  if (!fullPath.startsWith("/")) fullPath = `/${fullPath}`;
  const parts = fullPath.split("/");
  if (parts.length < 3) throw new Error("Invalid path");
  return { bucketName: parts[1], objectName: parts.slice(2).join("/") };
}

export async function uploadBufferToObjectStorage(
  buffer: Buffer,
  ext: string,
  contentType: string
): Promise<string> {
  const privateDir = objectStorageService.getPrivateObjectDir();
  const objectId = `${randomUUID()}${ext}`;
  const fullPath = `${privateDir}/uploads/${objectId}`;
  const { bucketName, objectName } = parseObjectPath(fullPath);
  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(objectName);
  await file.save(buffer, { contentType });
  return `/objects/uploads/${objectId}`;
}

export async function downloadBufferFromObjectStorage(objectPath: string): Promise<Buffer> {
  const file = await objectStorageService.getObjectEntityFile(objectPath);
  const [contents] = await file.download();
  return contents;
}

export async function streamObjectToResponse(objectPath: string, res: any, req?: any): Promise<void> {
  const file = await objectStorageService.getObjectEntityFile(objectPath);
  await objectStorageService.downloadObject(file, res, 3600, req);
}

export { objectStorageService };
