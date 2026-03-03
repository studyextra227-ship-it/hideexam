// Deno global type declarations for VS Code
// These tell VS Code that Deno APIs exist without needing the Deno extension

declare const Deno: {
    env: {
        get(key: string): string | undefined;
    };
    serve?: (handler: (req: Request) => Response | Promise<Response>) => void;
};

// Allow HTTPS URL module imports (used by Supabase edge functions)
declare module "https://*" {
    const content: any;
    export = content;
    export default content;
}

declare module "http://*" {
    const content: any;
    export = content;
    export default content;
}

declare module "npm:*" {
    const content: any;
    export = content;
    export default content;
}
