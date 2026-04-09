import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

import { azureAd } from "../config.js";

const issuer = `https://login.microsoftonline.com/${azureAd.tenantId}/v2.0`;

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(
        `https://login.microsoftonline.com/${azureAd.tenantId}/discovery/v2.0/keys`
      )
    );
  }
  return jwks;
}

export interface EntraUserClaims {
  uid: string;
  email: string;
  name: string;
}

export async function verifyBearerToken(
  token: string
): Promise<EntraUserClaims> {
  const { payload } = await jwtVerify(token, getJwks(), {
    issuer,
    audience: azureAd.audience,
  });
  return mapPayload(payload);
}

function mapPayload(payload: JWTPayload): EntraUserClaims {
  const oid = (payload.oid as string) ?? (payload.sub as string);
  if (!oid) {
    throw new Error("Token missing oid/sub");
  }
  const email =
    (payload.preferred_username as string) ??
    (payload.email as string) ??
    "";
  const name =
    (payload.name as string) ??
    email.split("@")[0] ??
    "User";
  return { uid: oid, email, name };
}
