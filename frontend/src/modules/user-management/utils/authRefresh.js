export function mergeRefreshedAuth(current, data) {
  return {
    ...current,
    ...data.user,
    accessToken: data.accessToken,
    canAccessPatientIdentity: data.user.canAccessPatientIdentity === true,
  };
}
