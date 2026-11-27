declare module "*?code" {
  const source: import("./lib/content.ts").SourceFile;
  export default source;
}

declare module "*?doc" {
  const page: import("./lib/content.ts").DocPage;
  export default page;
}
