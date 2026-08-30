// Clerk JWT verification. Without this file `ctx.auth.getUserIdentity()` is
// always null. Set CLERK_JWT_ISSUER_DOMAIN with `npx convex env set`.
const authConfig = {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};

export default authConfig;
