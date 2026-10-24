import { AwsClient } from "aws4fetch";
import { decode } from "base64-arraybuffer";

const R2_ACCESS_KEY_ID = (process.env.EXPO_PUBLIC_R2_ACCESS_KEY_ID || "").trim();
const R2_SECRET_ACCESS_KEY = (process.env.EXPO_PUBLIC_R2_SECRET_ACCESS_KEY || "").trim();
const R2_ENDPOINT = (process.env.EXPO_PUBLIC_R2_ENDPOINT || "").trim().replace(/\/+$/, "");
const R2_PUBLIC_URL = (process.env.EXPO_PUBLIC_R2_PUBLIC_URL || "").trim().replace(/\/+$/, "");

const getCleanPublicUrl = (fileName: string): string => {
  const cleanPath = fileName.replace(/^\/+/, "");
  return `${R2_PUBLIC_URL}/${cleanPath}`;
};

const getCleanUploadUrl = (bucketName: string, fileName: string): URL => {
  let cleanEndpoint = R2_ENDPOINT.replace(/\/+$/, "");
  if (cleanEndpoint.endsWith(`/${bucketName}`)) {
    cleanEndpoint = cleanEndpoint.slice(0, -(bucketName.length + 1));
  }
  const cleanFileName = fileName.replace(/^\/+/, "");
  return new URL(`${cleanEndpoint}/${bucketName}/${cleanFileName}`);
};

const aws = new AwsClient({
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});

export const uploadAvatarToR2 = async (userId: string, base64Data: string, mimeType: string): Promise<string> => {
  return uploadImageToR2(`avatars/${userId}-${Date.now()}`, base64Data, mimeType);
};

export const uploadChatAvatarToR2 = async (chatId: string, userId: string, base64Data: string, mimeType: string): Promise<string> => {
  return uploadImageToR2(`chat-avatars/${chatId}/${userId}-${Date.now()}`, base64Data, mimeType);
};

export const uploadChatImageToR2 = async (chatId: string, base64Data: string, mimeType: string): Promise<string> => {
  return uploadImageToR2(`chat-images/${chatId}-${Date.now()}`, base64Data, mimeType);
};

export const getThumbnailUrl = (url: string, width = 250, height = 250, quality = 75): string => {
  if (!url || typeof url !== "string") return "";
  if (
    url.startsWith("data:") ||
    url.startsWith("blob:") ||
    url.startsWith("file://") ||
    url.includes("your-public-r2-domain.com") ||
    url.includes("your-bucket-name") ||
    url.includes("localhost") ||
    url.includes("127.0.0.1") ||
    url.includes("wsrv.nl")
  ) {
    return url;
  }
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
  const cleanMime = mimeType.split(";")[0].trim();
  let rawExt = cleanMime.split("/")[1] || "jpeg";
  if (rawExt.includes("quicktime") || rawExt.includes("mov")) rawExt = "mov";
  if (rawExt.includes("webm")) rawExt = "webm";
  if (rawExt.includes("mp4")) rawExt = "mp4";
  if (rawExt.includes("ogg")) rawExt = "ogg";
  const fileName = `${pathPrefix}.${rawExt}`;
  const bucketName = process.env.EXPO_PUBLIC_R2_BUCKET_NAME || "alatext";
  const uploadUrl = getCleanUploadUrl(bucketName, fileName);
  const arrayBuffer = decode(base64Data);
  const response = await aws.fetch(uploadUrl.toString(), {
    method: "PUT",
    body: arrayBuffer,
    headers: { "Content-Type": cleanMime },
  });
  if (!response.ok) throw new Error(`Upload failed: ${response.statusText}`);
  return getCleanPublicUrl(fileName);
};

export const uploadAudioToR2 = async (chatId: string, base64Data: string, mimeType: string): Promise<string> => {
  const cleanMime = mimeType.split(";")[0].trim() || "audio/webm";
  return uploadImageToR2(`voice-messages/${chatId}-${Date.now()}`, base64Data, cleanMime);
};

export const uploadCustomChimeToR2 = async (userId: string, base64Data: string, mimeType: string): Promise<string> => {
  const cleanMime = mimeType.split(";")[0].trim() || "audio/mpeg";
  return uploadImageToR2(`custom-chimes/${userId}-${Date.now()}`, base64Data, cleanMime);
};

export const uploadVideoToR2 = async (chatId: string, base64Data: string, mimeType: string): Promise<string> => {
  const cleanMime = mimeType.split(";")[0].trim() || "video/mp4";
  return uploadImageToR2(`chat-videos/${chatId}-${Date.now()}`, base64Data, cleanMime);
};

export const deleteFileFromR2ByUrl = async (publicUrl: string) => {
  if (!R2_ACCESS_KEY_ID || !R2_ENDPOINT || !publicUrl.startsWith(R2_PUBLIC_URL)) return;
  const fileName = publicUrl.replace(`${R2_PUBLIC_URL}/`, '');
  const bucketName = process.env.EXPO_PUBLIC_R2_BUCKET_NAME || "alatext";
  const deleteUrl = getCleanUploadUrl(bucketName, fileName);
  try {
    await aws.fetch(deleteUrl.toString(), { method: "DELETE" });
  } catch (e) {
    console.error("Failed to delete from R2:", e);
  }
};

const getArrayBufferFromBlob = async (blob: any): Promise<ArrayBuffer> => {
  if (blob && typeof blob.arrayBuffer === "function") {
    try {
      return await blob.arrayBuffer();
    } catch (e) {
      // Fallback
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
        } else if (typeof reader.result === "string") {
          const clean = reader.result.includes(",") ? reader.result.split(",")[1] : reader.result;
          resolve(decode(clean));
        } else {
          reject(new Error("Unable to convert blob to buffer"));
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error || new Error("FileReader error"));
    try {
      reader.readAsDataURL(blob);
    } catch (e) {
      reject(e);
    }
  });
};

export const uploadBlobToR2 = async (
  pathPrefix: string,
  blob: any,
  onProgress?: (percent: number) => void
): Promise<string> => {
  if (!R2_ACCESS_KEY_ID || !R2_ENDPOINT) throw new Error("R2 credentials missing");
  const fileExt = (blob.type || "").split("/")[1] || "webp";
  const fileName = `${pathPrefix}.${fileExt}`;
  const bucketName = process.env.EXPO_PUBLIC_R2_BUCKET_NAME || "alatext";
  const uploadUrl = getCleanUploadUrl(bucketName, fileName);

  const cleanMime = blob.type ? blob.type.split(";")[0].trim() : "image/jpeg";
  const arrayBuffer = await getArrayBufferFromBlob(blob);

  if (typeof XMLHttpRequest !== "undefined") {
    return new Promise(async (resolve, reject) => {
      try {
        const signedReq = await aws.sign(uploadUrl.toString(), {
          method: "PUT",
          headers: { "Content-Type": cleanMime },
          body: arrayBuffer,
        });

        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl.toString());

        signedReq.headers.forEach((val, key) => {
          xhr.setRequestHeader(key, val);
        });

        if (xhr.upload && onProgress) {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && e.total > 0) {
              const pct = Math.round((e.loaded / e.total) * 100);
              onProgress(pct);
            }
          };
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(getCleanPublicUrl(fileName));
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(arrayBuffer);
      } catch (err) {
        reject(err);
      }
    });
  }

  const response = await aws.fetch(uploadUrl.toString(), {
    method: "PUT",
    body: arrayBuffer,
    headers: { "Content-Type": cleanMime },
  });
  if (!response.ok) throw new Error(`Upload failed: ${response.statusText}`);
  if (onProgress) onProgress(100);
  return getCleanPublicUrl(fileName);
};

export const uploadAnniversaryVideoToR2 = async (
  slot: "video1" | "video2",
  blob: Blob,
  onProgress?: (percent: number) => void
): Promise<string> => {
  return uploadBlobToR2(`anniversary/videos/${slot}-${Date.now()}`, blob, onProgress);
};

