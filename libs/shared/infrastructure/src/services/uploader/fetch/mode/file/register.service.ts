import { convert, $file, has } from '@shared/domain';
import { environment } from '@socialgest/env';

export type RegisterOutput = { uploadURL: string[]; uploadId: string; filename: string };

const url = `${environment.apiUrlV1}registerupload_temp?`;

export const register = async (file: File): Promise<RegisterOutput> => {
  has($file.ext.has(file)).mapRight(() => url.concat(`ext=${$file.ext.get(file)}`));
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('AccessToken')}`,
    },
    body: JSON.stringify({ type: file.type, parts: Math.ceil(file.size / convert.mb(10).to.byte()) }),
  });
  return (await response.json()).data;
};
