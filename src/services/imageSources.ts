// Images in course markdown are either on the web (left alone: Canvas loads
// them from there, mermaid diagrams included) or a path under the app's public
// directory, which has to be uploaded to the course's Canvas files first.
export const isLocalImageSource = (src: string) =>
  !/^(https?:|data:|blob:|\/\/)/i.test(src.trim());
