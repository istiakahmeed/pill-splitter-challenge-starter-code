export const generateId = () =>
  Math.random().toString(36).substring(2) + Date.now().toString(36);

export const randomFromArray = <T>(list: T[]) =>
  list[Math.floor(Math.random() * list.length)];
