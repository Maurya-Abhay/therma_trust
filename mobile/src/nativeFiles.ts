import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

function arrayBufferToBase64(buffer: ArrayBuffer) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Could not read the downloaded file.'));
        return;
      }
      resolve(reader.result.split(',')[1]);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the downloaded file.'));
    reader.readAsDataURL(new Blob([buffer]));
  });
}

export async function saveAndShareFile(data: ArrayBuffer, filename: string, mimeType: string, dialogTitle: string) {
  if (!FileSystem.cacheDirectory) throw new Error('A temporary file location is unavailable.');
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, await arrayBufferToBase64(data), {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, { mimeType, dialogTitle });
  return true;
}
