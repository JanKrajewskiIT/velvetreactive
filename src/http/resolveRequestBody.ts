import { JSON_CONTENT_TYPE } from './contentTypes.js';

export interface ResolvedRequestBody {
  body: BodyInit | undefined;
  contentType: string | undefined;
}

const isPassThroughBody = (body: unknown): body is FormData | URLSearchParams | Blob | string =>
  typeof body === 'string' || body instanceof FormData || body instanceof URLSearchParams || body instanceof Blob;

export const resolveRequestBody = (body: unknown): ResolvedRequestBody => {
  if (body === undefined || body === null) {
    return { body: undefined, contentType: undefined };
  }
  if (isPassThroughBody(body)) {
    return { body, contentType: undefined };
  }
  return { body: JSON.stringify(body), contentType: JSON_CONTENT_TYPE };
};
