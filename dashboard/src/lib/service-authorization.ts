import { requireAllowedUser } from "./auth";

export const SERVICE_AUTHORIZATION = Symbol("sushicode-service-authorization");

export async function authorizeMutation(
  authorization?: typeof SERVICE_AUTHORIZATION,
): Promise<void> {
  if (authorization === SERVICE_AUTHORIZATION) return;
  await requireAllowedUser();
}
