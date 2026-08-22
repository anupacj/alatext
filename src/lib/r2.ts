import { AwsClient } from 'aws4fetch';
import { decode } from 'base64-arraybuffer';

const R2_ACCESS_KEY_ID = process.env.EXPO_PUBLIC_R2_ACCESS_KEY_ID as string;
const R2_SECRET_ACCESS_KEY = process.env.EXPO_PUBLIC_R2_SECRET_ACCESS_KEY as string;
const R2_ENDPOINT = process.env.EXPO_PUBLIC_R2_ENDPOINT as string;
const R2_PUBLIC_URL = process.env.EXPO_PUBLIC_R2_PUBLIC_URL as string;

const aws = new AwsClient({
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  service: 's3',
  region: 'auto',
});

export const uploadAvatarToR2 = async (userId: string, base64Data: string, mimeType: string): Promise<string> => {
  if (!R2_ACCESS_KEY_ID || !R2_ENDPOINT) {
    throw new Error('R2 credentials are not configured in .env');
  }

  const fileExt = mimeType.split('/')[1] || 'jpeg';
  const fileName = `avatars/${userId}-${Date.now()}.${fileExt}`;
  
  // Format the endpoint correctly (e.g., https://<accountid>.r2.cloudflarestorage.com/avatars/filename.jpg)
  const bucketName = 'avatars';
  const uploadUrl = new URL(`${R2_ENDPOINT}/${bucketName}/${fileName}`);
  
  const arrayBuffer = decode(base64Data);

  const response = await aws.fetch(uploadUrl.toString(), {
    method: 'PUT',
    body: arrayBuffer,
    headers: {
      'Content-Type': mimeType,
    },
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  return `${R2_PUBLIC_URL}/${fileName}`;
};
