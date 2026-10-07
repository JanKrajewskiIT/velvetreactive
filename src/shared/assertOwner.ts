import { getOwner } from 'solid-js';

export const assertOwner = (primitiveName: string): void => {
  if (getOwner() === null) {
    throw new Error(`${primitiveName} must be created inside a reactive owner such as a component or createRoot.`);
  }
};
