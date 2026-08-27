import { AwsClient } from "aws4fetch";
import { decode } from "base64-arraybuffer";

const R2_ACCESS_KEY_ID = process.env.EXPO_PUBLIC_R2_ACCESS_KEY_ID as string;
const R2_SECRET_ACCESS_KEY = process.env.EXPO_PUBLIC_R2_SECRET_ACCESS_KEY as string;
const R2_ENDPOINT = process.env.EXPO_PUBLIC_R2_ENDPOINT as string;
const R2_PUBLIC_URL = process.env.EXPO_PUBLIC_R2_PUBLIC_URL as string;

const aws = new AwsClient({
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});

export const uploadAvatarToR2 = async (userId: string, base64Data: string, mimeType: string): Promise<string> => {
  return uploadImageToR2(`avatars/${userId}-${Date.now()}`, base64Data, mimeType);
};

export const uploadChatImageToR2 = async (chatId: string, base64Data: string, mimeType: string): Promise<string> => {
  return uploadImageToR2(`chat-images/${chatId}-${Date.now()}`, base64Data, mimeType);
};

export const getThumbnailUrl = (url: string, width = 250, height = 250, quality = 75): string => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) {
    // wsrv.nl globally compresses and converts high-res images to tiny lightweight WebP thumbnails
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${width}&h=${height}&fit=cover&q=${quality}&output=webp`;
  }
  return url;
};

export const uploadImageToR2 = async (pathPrefix: string, base64Data: string, mimeType: string): Promise<string> => {
  if (!R2_ACCESS_KEY_ID || !R2_ENDPOINT) {
    throw new Error("R2 credentials are not configured in .env");
  }
  const fileExt = mimeType.split("/")[1] || "jpeg";
  const fileName = `${pathPrefix}.${fileExt}`;
  const bucketName = process.env.EXPO_PUBLIC_R2_BUCKET_NAME || "alatext";
  const uploadUrl = new URL(`${R2_ENDPOINT}/${bucketName}/${fileName}`);
  const arrayBuffer = decode(base64Data);
  const response = await aws.fetch(uploadUrl.toString(), {
    method: "PUT",
    body: arrayBuffer,
    headers: { "Content-Type": mimeType },
  });
  if (!response.ok) throw new Error(`Upload failed: ${response.statusText}`);
  return `${R2_PUBLIC_URL}/${fileName}`;
};

export const uploadAudioBlobToR2 = async (chatId: string, blob: Blob, mimeType: string): Promise<string> => {
  if (!R2_ACCESS_KEY_ID || !R2_ENDPOINT) {
    throw new Error("R2 credentials are not configured in .env");
  }
  const ext = mimeType.includes("webm") ? "webm" : (mimeType.includes("mp4") ? "mp4" : "ogg");
  const fileName = `voice-messages/${chatId}-${Date.now()}.${ext}`;
  const bucketName = process.env.EXPO_PUBLIC_R2_BUCKET_NAME || "alatext";
  const uploadUrl = new URL(`${R2_ENDPOINT}/${bucketName}/${fileName}`);
  const arrayBuffer = await blob.arrayBuffer();
  const response = await aws.fetch(uploadUrl.toString(), {
    method: "PUT",
    body: arrayBuffer,
    headers: { "Content-Type": mimeType },
  });
  if (!response.ok) throw new Error(`Audio upload failed: ${response.statusText}`);
  return `${R2_PUBLIC_URL}/${fileName}`;
};

export const deleteFileFromR2ByUrl = async (publicUrl: string) => {
  if (!R2_ACCESS_KEY_ID || !R2_ENDPOINT || !publicUrl.startsWith(R2_PUBLIC_URL)) return;
  const fileName = publicUrl.replace(`${R2_PUBLIC_URL}/`, '');
  const bucketName = process.env.EXPO_PUBLIC_R2_BUCKET_NAME || "alatext";
  const deleteUrl = new URL(`${R2_ENDPOINT}/${bucketName}/${fileName}`);
  try {
    await aws.fetch(deleteUrl.toString(), { method: "DELETE" });
  } catch (e) {
    console.error("Failed to delete from R2:", e);
  }
};

export const uploadBlobToR2 = async (pathPrefix: string, blob: Blob): Promise<string> => {
  if (!R2_ACCESS_KEY_ID || !R2_ENDPOINT) throw new Error("R2 credentials missing");
  const fileExt = blob.type.split("/")[1] || "webp";
  const fileName = `${pathPrefix}.${fileExt}`;
  const bucketName = process.env.EXPO_PUBLIC_R2_BUCKET_NAME || "alatext";
  const uploadUrl = new URL(`${R2_ENDPOINT}/${bucketName}/${fileName}`);
  const arrayBuffer = await blob.arrayBuffer();
  const response = await aws.fetch(uploadUrl.toString(), {
    method: "PUT",
    body: arrayBuffer,
    headers: { "Content-Type": blob.type },
  });
  if (!response.ok) throw new Error(`Upload failed: ${response.statusText}`);
  return `${R2_PUBLIC_URL}/${fileName}`;
};
