const WS_HOST = process?.env?.NEXT_PUBLIC_WS_HOST ?? 'localhost:42069';
const BASE_PATH = process?.env?.NEXT_PUBLIC_BASE_PATH ?? '';

export {
  WS_HOST,
  BASE_PATH,
};