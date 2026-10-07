import { JSON_CONTENT_TYPE } from './contentTypes.js';

const NO_CONTENT_STATUS = 204;

export const parseResponseBody = async (response: Response): Promise<unknown> => {
  if (response.status === NO_CONTENT_STATUS) {
    return undefined;
  }
  const contentType = response.headers.get('content-type') ?? '';
  return contentType.includes(JSON_CONTENT_TYPE) ? ((await response.json()) as unknown) : response.text();
};
