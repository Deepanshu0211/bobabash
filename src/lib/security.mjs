export function safeNext(value) {
  return typeof value === 'string' && /^\/(?![\/\\])/.test(value) && !/[\\\u0000-\u001f]/.test(value) ? value : '/dashboard';
}
export function imageKind(bytes) {
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)) return {mime:'image/png',ext:'png'};
  if (bytes.length >= 3 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return {mime:'image/jpeg',ext:'jpg'};
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4))==='RIFF' && String.fromCharCode(...bytes.slice(8,12))==='WEBP') return {mime:'image/webp',ext:'webp'};
  return null;
}
export function checkImage(bytes, declaredType) {
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error('Images must be between 1 byte and 5 MB.');
  const kind=imageKind(bytes);
  if (!kind || kind.mime !== declaredType) throw new Error('Choose a valid PNG, JPEG or WebP image.');
  return kind;
}
